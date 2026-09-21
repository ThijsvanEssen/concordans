import { recordInstrument, ensureInstrumentMeta } from '$lib/api/instrument-cache';
import {
	graphNodeId,
	nodeToGraphNode,
	detectNodeKind,
	classifyEdgeKind,
	SCAFFOLDING_RELATIONS
} from '../types';
import { DEFAULT_FILTERS, SOFT_NODE_CAP } from './types';
import { get, writable } from 'svelte/store';
import type { NodeGraphResponse, Neighbor } from '$lib/api/types';
import type { GraphEdge, GraphNode } from '../types';
import type { GraphFilters, GraphExpansionOptions, LoadingState, GraphMode } from './types';

/**
 * Shared mutable state and the primitives every loader builds on: node and
 * edge maps, the writable stores that mirror them, history, LRU trimming and
 * the synthetic-node passes. Loader modules receive this object and never
 * create their own copies.
 */
export function createGraphContext() {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, GraphEdge>();
	const cache = new Map<string, NodeGraphResponse>();
	const history: string[] = [];
	const pinned = new Set<string>();
	// Scalars shared with the loader modules. Kept on one object because a
	// destructured `let` would freeze its value at the time of destructuring.
	const state = { seq: 0, historyIndex: -1, proxiesEnabled: false, additiveLayerIndex: 0 };
	// Insertion sequence per node — drives the LRU trim. Reset on bulk loads.
	const insertedAt = new Map<string, number>();

	const nodesStore = writable<GraphNode[]>([]);
	const edgesStore = writable<GraphEdge[]>([]);
	const selectionStore = writable<GraphNode | null>(null);
	const pinnedStore = writable<Set<string>>(new Set());
	const breadcrumbsStore = writable<GraphNode[]>([]);
	const canGoBackStore = writable<boolean>(false);
	const canGoForwardStore = writable<boolean>(false);
	const filtersStore = writable<GraphFilters>({
		...DEFAULT_FILTERS,
		nodeTypeToggles: { ...DEFAULT_FILTERS.nodeTypeToggles },
		activeInstruments: new Set<string>()
	});
	const loadingStore = writable<LoadingState>({ kind: 'idle' });
	const graphModeStore = writable<GraphMode>('expansion');
	const potentialCountsStore = writable<Record<string, number>>({});
	const trimmedCountStore = writable<number>(0);
	// bwb_id of the wet whose article set currently fills the canvas (set by
	// loadInstrument). null in every other mode — including additive Lagen
	// overviews and per-article expansion. The Lagen handlers in the route
	// read this to route to wet-scoped vs global endpoints.
	const currentInstrumentBwbStore = writable<string | null>(null);

	// Synthesize instrument proxy nodes for every article whose wet isn't
	// represented by a real instrument node. Lets the Wetten view collapse
	// articles into their parent wet even when the user hasn't explicitly
	// loaded the Wetten layer. Proxies look exactly like real instruments to
	// the rest of the system (mutual exclusion, synth edges, layout) — just
	// marked with props.synth so we can identify them on cleanup.
	const SYNTH_INSTRUMENT_PREFIX = 'synth:instrument:';
	// View-level flag: synth instrument proxies are *only* materialised when
	// the user is in Wetten view (collapseToLaws). In Artikelen view they
	// serve no user-facing purpose but their hidden presence still drags the
	// FA2 layout and camera bounding box. GraphView calls setCollapseToLaws
	// when its Detail-niveau toggle flips.
	const synthesizeDerivedNodes = () => {
		// Always drop existing proxies first — keeps a clean slate when the flag
		// flips off and when articles are pruned away.
		for (const id of [...nodes.keys()]) {
			if (id.startsWith(SYNTH_INSTRUMENT_PREFIX)) {
				nodes.delete(id);
				insertedAt.delete(id);
			}
		}
		if (!state.proxiesEnabled) return;

		// Map real instruments by bwb so we don't double up.
		const realBwbs = new Set<string>();
		for (const n of nodes.values()) {
			if (n.kind !== 'instrument') continue;
			const p = n.raw?.props as Record<string, unknown> | undefined;
			const bwb = String(p?.['bwb_id'] ?? n.key ?? '').toLowerCase();
			if (bwb) realBwbs.add(bwb);
		}
		// One proxy per unique article bwb that has no real instrument loaded.
		const seenBwb = new Set<string>();
		for (const n of nodes.values()) {
			if (n.kind !== 'article') continue;
			const p = n.raw?.props as Record<string, unknown> | undefined;
			const bwb = String(p?.['bwb_id'] ?? p?.['celex'] ?? '').toLowerCase();
			if (!bwb || realBwbs.has(bwb) || seenBwb.has(bwb)) continue;
			seenBwb.add(bwb);
			const id = `${SYNTH_INSTRUMENT_PREFIX}${bwb}`;
			const proxy: GraphNode = {
				id,
				key: bwb,
				collection: 'instruments',
				kind: 'instrument',
				label: bwb,
				raw: {
					id,
					key: bwb,
					collection: 'instruments',
					type: 'instrument',
					display_name: bwb,
					labels: ['Wet'],
					props: { bwb_id: bwb, synth: true }
				}
			};
			nodes.set(id, proxy);
			insertedAt.set(id, ++state.seq);
		}
	};

	// Wet-scoped layer totals fetched from /api/instruments/{bwb}/{layer}
	// endpoints — populated by prefetchInstrumentLayerCounts after loadInstrument
	// commits. Merged into potentialCountsStore so the sidebar's "+N" badge
	// surfaces them. Cleared when the wet view ends (clearGraph,
	// prepareBulkLoad non-additive).
	const wetLayerTotals: Record<string, number> = {};

	// Compute the per-kind tally of cached neighbours that aren't on canvas
	// yet — i.e. what would arrive if the user clicked the relevant Lagen
	// button right now. Walks every loaded node's cached /api/nodes response,
	// buckets unseen neighbours by kind, dedups by node id across responses.
	// Wet-layer totals (set after loadInstrument) override per-kind tallies
	// so the sidebar reads the authoritative backend count instead of the
	// cached-neighbour-derived one.
	const recomputePotentialCounts = () => {
		const presentIds = new Set(nodes.keys());
		const seenPerKind = new Map<string, Set<string>>();
		for (const [nodeId, response] of cache) {
			if (!presentIds.has(nodeId)) continue;
			const all: Neighbor[] = response.neighbors.all ?? [
				...(response.neighbors.strict ?? []),
				...(response.neighbors.semantic ?? [])
			];
			for (const n of all) {
				const id = graphNodeId(n.collection, n.key);
				if (presentIds.has(id)) continue;
				const kind = detectNodeKind(n);
				let set = seenPerKind.get(kind);
				if (!set) {
					set = new Set();
					seenPerKind.set(kind, set);
				}
				set.add(id);
			}
		}
		const counts: Record<string, number> = {};
		for (const [k, ids] of seenPerKind) counts[k] = ids.size;
		for (const [k, n] of Object.entries(wetLayerTotals)) counts[k] = n;
		potentialCountsStore.set(counts);
	};

	const clearWetLayerTotals = () => {
		for (const k of Object.keys(wetLayerTotals)) delete wetLayerTotals[k];
	};

	const updateNodes = () => {
		synthesizeDerivedNodes();
		nodesStore.set([...nodes.values()]);
		recomputePotentialCounts();
	};

	// Derived edges — synthesized from props/transitive paths so cross-layer
	// relationships show up without having to traverse intermediate hops. Pure
	// derivation: drop and rebuild on every emit so prunes/deloads stay
	// consistent. All synth edges are keyed `synth:{pattern}:...` so we can
	// sweep them cleanly each pass.
	const SYNTH_PREFIX = 'synth:';
	const synthesizeDerivedEdges = () => {
		for (const id of [...edges.keys()]) {
			if (id.startsWith(SYNTH_PREFIX)) edges.delete(id);
		}

		// ── Index instruments by bwb_id and fracties by afkorting/key ─────────
		const instrumentsByBwb = new Map<string, string>();
		const fractiesByKey = new Map<string, string>();
		for (const n of nodes.values()) {
			if (n.kind === 'instrument') {
				const p = n.raw?.props as Record<string, unknown> | undefined;
				const bwb = String(p?.['bwb_id'] ?? n.key ?? '').toLowerCase();
				if (bwb) instrumentsByBwb.set(bwb, n.id);
			} else if (n.kind === 'fractie') {
				const p = n.raw?.props as Record<string, unknown> | undefined;
				const afk = String(p?.['afkorting'] ?? '').toLowerCase();
				if (afk) fractiesByKey.set(afk, n.id);
				const naam = String(p?.['naam'] ?? '').toLowerCase();
				if (naam) fractiesByKey.set(naam, n.id);
				fractiesByKey.set(n.key.toLowerCase(), n.id);
			}
		}

		// Helper: emit a synth edge once per (src, tgt, label) triple.
		const emit = (tag: string, source: string, target: string, label: string, relation: string) => {
			const id = `${SYNTH_PREFIX}${tag}:${source}->${target}`;
			if (edges.has(id)) return;
			edges.set(id, {
				id,
				source,
				target,
				kind: 'parliamentary',
				label,
				directed: true,
				relation
			});
		};

		// ── A→Article→Instrument bridges ─────────────────────────────────────
		// dossier   → article → instrument  ⇒ "raakt wet"
		// judgment  → article → instrument  ⇒ "citeert wet"
		// tkstuk    → article → instrument  ⇒ "wijzigt wet"
		if (instrumentsByBwb.size > 0) {
			const BRIDGE_KINDS: Array<{
				kind: 'dossier' | 'judgment' | 'tkstuk';
				tag: string;
				label: string;
				relation: string;
			}> = [
				{ kind: 'dossier', tag: 'dossier-instrument', label: 'raakt wet', relation: 'raakt_wet' },
				{
					kind: 'judgment',
					tag: 'judgment-instrument',
					label: 'citeert wet',
					relation: 'citeert_wet'
				},
				{ kind: 'tkstuk', tag: 'tkstuk-instrument', label: 'wijzigt wet', relation: 'wijzigt_wet' }
			];
			for (const cfg of BRIDGE_KINDS) {
				for (const source of nodes.values()) {
					if (source.kind !== cfg.kind) continue;
					const reached = new Set<string>();
					for (const e of edges.values()) {
						const otherId =
							e.source === source.id ? e.target : e.target === source.id ? e.source : null;
						if (!otherId) continue;
						const article = nodes.get(otherId);
						if (!article || article.kind !== 'article') continue;
						const p = article.raw?.props as Record<string, unknown> | undefined;
						const bwb = String(p?.['bwb_id'] ?? '').toLowerCase();
						if (!bwb) continue;
						const instId = instrumentsByBwb.get(bwb);
						if (!instId || reached.has(instId)) continue;
						reached.add(instId);
						emit(cfg.tag, source.id, instId, cfg.label, cfg.relation);
					}
				}
			}
		}

		// ── Article → Instrument (PART_OF_INSTRUMENT proxy) ──────────────────
		// When both an article and its wet are on the canvas, draw the
		// containment line. The backend emits PART_OF_INSTRUMENT only as a
		// neighbour of the instrument node — so an article loaded standalone
		// (via search/expansion) never carries it. Without this, adding the
		// Wetten layer leaves articles visually orphaned from their wet.
		if (instrumentsByBwb.size > 0) {
			for (const article of nodes.values()) {
				if (article.kind !== 'article') continue;
				const p = article.raw?.props as Record<string, unknown> | undefined;
				const bwb = String(p?.['bwb_id'] ?? p?.['celex'] ?? '').toLowerCase();
				if (!bwb) continue;
				const instId = instrumentsByBwb.get(bwb);
				if (!instId) continue;
				emit('article-instrument', article.id, instId, 'deel van', 'part_of_instrument');
			}
		}

		// ── Lid → Fractie via lid.partij prop ────────────────────────────────
		// Loaders emit lid_van_fractie when both come from the same call. When
		// they arrive from separate Lagen loads (e.g. Leden first, Fracties
		// later), the link is missing. lid.partij carries the fractie afkorting
		// → match it to a fractie node we already have.
		if (fractiesByKey.size > 0) {
			for (const lid of nodes.values()) {
				if (lid.kind !== 'lid') continue;
				const p = lid.raw?.props as Record<string, unknown> | undefined;
				const partij = String(p?.['partij'] ?? '').toLowerCase();
				if (!partij) continue;
				const fractieId = fractiesByKey.get(partij);
				if (!fractieId) continue;
				emit('lid-fractie', lid.id, fractieId, 'lid van fractie', 'lid_van_fractie');
			}
		}
	};

	const updateEdges = () => {
		synthesizeDerivedEdges();
		edgesStore.set([...edges.values()]);
	};

	const updateBreadcrumbs = () => {
		const start = Math.max(0, state.historyIndex - 4);
		const slice = history.slice(start, state.historyIndex + 1);
		const crumbs = slice
			.map((id) => nodes.get(id))
			.filter((node): node is GraphNode => Boolean(node));
		breadcrumbsStore.set(crumbs);
		canGoBackStore.set(state.historyIndex > 0);
		canGoForwardStore.set(state.historyIndex < history.length - 1);
	};

	const recordHistory = (nodeId: string) => {
		if (state.historyIndex < history.length - 1) {
			history.splice(state.historyIndex + 1);
		}
		history.push(nodeId);
		state.historyIndex = history.length - 1;
		canGoBackStore.set(state.historyIndex > 0);
		canGoForwardStore.set(false);
		updateBreadcrumbs();
	};

	const clearGraph = () => {
		nodes.clear();
		edges.clear();
		cache.clear();
		insertedAt.clear();
		state.seq = 0;
		history.length = 0;
		state.historyIndex = -1;
		selectionStore.set(null);
		breadcrumbsStore.set([]);
		graphModeStore.set('expansion');
		currentInstrumentBwbStore.set(null);
		trimmedCountStore.set(0);
		clearWetLayerTotals();
		updateNodes();
		updateEdges();
	};

	// Record insertion timestamp for new nodes only; refreshes keep their seq.
	const touchNode = (id: string, node: GraphNode) => {
		if (!nodes.has(id)) insertedAt.set(id, ++state.seq);
		nodes.set(id, node);
	};

	// Shared bookkeeping used by every bulk loader. In replace mode (the
	// default) it wipes the graph; in additive mode it preserves existing
	// nodes/edges so the layer blends into the current context.
	const prepareBulkLoad = (additive: boolean) => {
		if (!additive) {
			nodes.clear();
			edges.clear();
			cache.clear();
			insertedAt.clear();
			state.seq = 0;
			history.length = 0;
			state.historyIndex = -1;
			// Any non-additive bulk load is, by definition, no longer a wet view.
			// (loadInstrument re-sets this flag after its own clear.)
			currentInstrumentBwbStore.set(null);
			clearWetLayerTotals();
		}
	};

	// Each additive layer load lands in its own region around the existing
	// graph. We rotate through angles so consecutive loads stack at 60° apart
	// instead of all piling up to the right.
	const placeAdditiveLayer = (seqBefore: number) => {
		// Find max distance of *previously existing* nodes from origin.
		let maxR = 0;
		for (const [id, n] of nodes.entries()) {
			if ((insertedAt.get(id) ?? 0) > seqBefore) continue;
			const x = (n as GraphNode & { x?: number }).x ?? 0;
			const y = (n as GraphNode & { x?: number; y?: number }).y ?? 0;
			const r = Math.sqrt(x * x + y * y);
			if (r > maxR) maxR = r;
		}
		// No existing content → leave new nodes at origin; FA2 sorts them out.
		if (maxR < 1) return;

		// Direction for this layer: rotate around in 60° steps so subsequent
		// additive loads land in different sectors.
		const angle = state.additiveLayerIndex++ * (Math.PI / 3) + Math.PI / 4;
		const cx = Math.cos(angle) * (maxR + 180);
		const cy = Math.sin(angle) * (maxR + 180);

		// Scatter newly-added nodes around (cx, cy). FA2 will then settle them
		// into a clean shape inside this region without crossing into the old
		// graph. Deterministic-ish offsets keep it stable across re-renders.
		let i = 0;
		const newIds: string[] = [];
		for (const [id, s] of insertedAt.entries()) {
			if (s > seqBefore) newIds.push(id);
		}
		const N = newIds.length;
		const SCATTER_R = Math.max(40, Math.sqrt(N) * 12);
		for (const id of newIds) {
			const n = nodes.get(id);
			if (!n) continue;
			const a = (i / Math.max(N, 1)) * Math.PI * 2;
			const r = SCATTER_R * (0.4 + 0.6 * Math.random());
			(n as GraphNode & { x?: number; y?: number }).x = cx + Math.cos(a) * r;
			(n as GraphNode & { x?: number; y?: number }).y = cy + Math.sin(a) * r;
			i++;
		}
	};

	// Drop oldest non-pinned non-focused non-level-1 nodes until we're under the
	// cap. Edges incident to dropped nodes are removed too.
	const trimToCap = () => {
		if (nodes.size <= SOFT_NODE_CAP) return;
		const sel = get(selectionStore);
		const protect = new Set<string>(pinned);
		if (sel) {
			protect.add(sel.id);
			for (const e of edges.values()) {
				if (e.source === sel.id) protect.add(e.target);
				if (e.target === sel.id) protect.add(e.source);
			}
		}
		const candidates = [...nodes.keys()]
			.filter((id) => !protect.has(id))
			.sort((a, b) => (insertedAt.get(a) ?? 0) - (insertedAt.get(b) ?? 0));
		let toDrop = nodes.size - SOFT_NODE_CAP;
		const dropped = toDrop;
		for (const id of candidates) {
			if (toDrop <= 0) break;
			nodes.delete(id);
			insertedAt.delete(id);
			toDrop -= 1;
		}
		if (dropped > 0) trimmedCountStore.update((n) => n + dropped);
		for (const [id, e] of [...edges.entries()]) {
			if (!nodes.has(e.source) || !nodes.has(e.target)) edges.delete(id);
		}
	};

	const mergeResponse = (response: NodeGraphResponse, opts: Required<GraphExpansionOptions>) => {
		const f = get(filtersStore);
		const centerNode = nodeToGraphNode(response.node);
		touchNode(centerNode.id, centerNode);

		const allNeighbors: Neighbor[] = response.neighbors.all ?? [
			...(response.neighbors.strict ?? []),
			...(response.neighbors.semantic ?? [])
		];

		const neighborEntries = allNeighbors
			.filter(
				(neighbor) => f.showScaffolding || !SCAFFOLDING_RELATIONS.has(neighbor.relation ?? '')
			)
			.map((neighbor) => ({
				neighbor,
				kind: classifyEdgeKind(
					neighbor.relation,
					centerNode.kind,
					neighbor.collection === 'judgments' ? 'judgment' : undefined
				)
			}));

		const eligible = opts.outboundOnly
			? neighborEntries.filter((e) => e.neighbor.direction === 'outbound')
			: neighborEntries;

		const pinnedNeighbors = eligible.filter((entry) =>
			pinned.has(graphNodeId(entry.neighbor.collection, entry.neighbor.key))
		);
		const nonPinnedNeighbors = eligible.filter(
			(entry) => !pinned.has(graphNodeId(entry.neighbor.collection, entry.neighbor.key))
		);

		const allowedNeighbors: typeof nonPinnedNeighbors = [];
		let addedCount = 0;

		for (const entry of nonPinnedNeighbors) {
			if (addedCount >= opts.neighborLimit) {
				break;
			}
			if (
				entry.kind === 'citation' &&
				entry.neighbor.confidence != null &&
				entry.neighbor.confidence < opts.semanticConfidenceThreshold
			) {
				continue;
			}
			allowedNeighbors.push(entry);
			addedCount += 1;
		}

		const finalNeighbors = [...pinnedNeighbors, ...allowedNeighbors];

		for (const entry of finalNeighbors) {
			// Instrument nodes (NL laws, EU directives) are never shown as explicit
			// graph nodes — they are represented only as visual clusters with labels.
			// Still cache the metadata so the cluster labels can resolve the friendly
			// name (e.g. directive title or "Sr" abbreviation).
			if (detectNodeKind(entry.neighbor) === 'instrument') {
				const p = entry.neighbor.props as Record<string, unknown> | null;
				recordInstrument({
					key: entry.neighbor.key,
					bwb_id: (p?.['bwb_id'] as string | null) ?? null,
					display_name: entry.neighbor.display_name,
					title: (p?.['title'] as string | null) ?? null,
					citation_title: (p?.['citation_title'] as string | null) ?? null,
					short_title: (p?.['short_title'] as string | null) ?? null
				});
				continue;
			}

			const neighborNode = nodeToGraphNode(entry.neighbor);
			touchNode(neighborNode.id, neighborNode);

			// Seed the instrument cache from article neighbours so the hover popup
			// can render the law's full name instead of the raw bwb id when articles
			// from a different wet appear as cross-references.
			//
			// Two-step strategy:
			//   1. Synchronously parse the article's display_name for the short
			//      title — gives us "Sr" / "Sv" / "Awb" instantly so the cache is
			//      never empty for that bwb.
			//   2. Asynchronously fetch /api/nodes/instruments/{bwb} for any bwb we
			//      haven't enriched yet — replaces the short-title-only entry with
			//      full citation_title + title + short_title. Once-per-bwb so a wet
			//      with hundreds of cross-references doesn't fire hundreds of calls.
			if (entry.neighbor.collection === 'instrument_articles') {
				const np = entry.neighbor.props as Record<string, unknown> | null;
				const bwb = (np?.['bwb_id'] as string | null) ?? null;
				const dn = entry.neighbor.display_name ?? '';
				const m = dn.match(/^Artikel\s+\S+\s+(.+?)\.?\s*$/);
				if (bwb && m) {
					recordInstrument({ bwb_id: bwb, short_title: m[1] });
					ensureInstrumentMeta(bwb);
				}
			}

			const isOutbound = entry.neighbor.direction === 'outbound';
			const source = isOutbound ? centerNode.id : neighborNode.id;
			const target = isOutbound ? neighborNode.id : centerNode.id;
			const rel = entry.neighbor.relation;
			const label = rel || entry.kind;
			const edgeId = `${source}->${target}:${rel ?? entry.kind}`;

			// The backend NeighborDTO grew a meta field for AUTEUR_VAN (rol) and
			// STEMT (stem, aantal_zetels). Not in the openapi-types snapshot yet
			// — read defensively until the schema regen.
			const neighborMeta =
				(entry.neighbor as { meta?: Record<string, unknown> | null }).meta ?? null;

			edges.set(edgeId, {
				id: edgeId,
				source,
				target,
				kind: entry.kind,
				label,
				directed: true,
				confidence: entry.neighbor.confidence,
				relation: rel,
				meta: neighborMeta
			});
		}

		// Enforce the soft cap before emitting so subscribers see one consistent
		// state instead of an overshoot followed by a trim.
		trimToCap();

		// Emit one batch update — not once per node/edge.
		updateNodes();
		updateEdges();
	};

	const focusInternal = (nodeId: string, opts?: { recordHistory?: boolean }) => {
		const target = nodes.get(nodeId);
		if (!target) {
			return null;
		}
		selectionStore.set(target);
		if (opts?.recordHistory ?? true) {
			recordHistory(nodeId);
		}
		return target;
	};

	return {
		nodes,
		edges,
		cache,
		history,
		pinned,
		insertedAt,
		nodesStore,
		edgesStore,
		selectionStore,
		pinnedStore,
		breadcrumbsStore,
		canGoBackStore,
		canGoForwardStore,
		filtersStore,
		loadingStore,
		graphModeStore,
		potentialCountsStore,
		trimmedCountStore,
		currentInstrumentBwbStore,
		SYNTH_INSTRUMENT_PREFIX,
		synthesizeDerivedNodes,
		wetLayerTotals,
		recomputePotentialCounts,
		clearWetLayerTotals,
		updateNodes,
		SYNTH_PREFIX,
		synthesizeDerivedEdges,
		updateEdges,
		updateBreadcrumbs,
		recordHistory,
		clearGraph,
		touchNode,
		prepareBulkLoad,
		placeAdditiveLayer,
		trimToCap,
		mergeResponse,
		focusInternal,
		state
	};
}

export type GraphContext = ReturnType<typeof createGraphContext>;

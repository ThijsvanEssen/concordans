import { ensureInstrumentMeta, recordInstrument } from '$lib/api/instrument-cache';
import type { Schema } from '$lib/api/types';
import { getLawIdFromProps } from '$lib/util/law-id';
import { isCollection, nodeId, type Relation } from '$lib/vocabulary';
import { get, writable } from 'svelte/store';
import {
	edgeCategory,
	kindOfCollection,
	nodeToGraphNode,
	relationOf,
	syntheticNode,
	type BaseNode,
	type GraphEdge,
	type GraphNode,
	type GraphNodeKind
} from '../types';
import {
	DEFAULT_FILTERS,
	SOFT_NODE_CAP,
	type GraphFilters,
	type GraphMode,
	type LoadingState
} from './types';

const SYNTH = 'synth:';
const SYNTH_INSTRUMENT = 'synth:instrument:';

const edgeId = (source: string, target: string, relation: Relation) =>
	`${source}->${target}:${relation}`;

/** Lower-case id of the law a node belongs to: its own for an instrument, its instrument's for an article. */
function lawIdOf(node: GraphNode): string | null {
	const id =
		getLawIdFromProps(node.raw?.props ?? undefined, node.key) ??
		(node.kind === 'instrument' ? node.key : null);
	return id?.toLowerCase() ?? null;
}

/**
 * Shared mutable state and the primitives every loader builds on: node and
 * edge maps, the writable stores that mirror them, history, trimming and the
 * derived nodes and edges. Loader modules receive this object and never
 * create their own copies.
 */
export function createGraphContext() {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, GraphEdge>();
	/** Expansion responses by node id. */
	const cache = new Map<string, Schema<'NodeGraphResponse'>>();
	const history: string[] = [];
	const pinned = new Set<string>();
	// On one object because a destructured `let` would freeze its value.
	const state = { seq: 0, historyIndex: -1, proxiesEnabled: false, additiveLayerIndex: 0 };
	// Insertion sequence per node: the order in which the soft cap trims.
	const insertedAt = new Map<string, number>();

	const nodesStore = writable<GraphNode[]>([]);
	const edgesStore = writable<GraphEdge[]>([]);
	const selectionStore = writable<GraphNode | null>(null);
	const pinnedStore = writable<Set<string>>(new Set());
	const canGoBackStore = writable(false);
	const canGoForwardStore = writable(false);
	const filtersStore = writable<GraphFilters>({
		...DEFAULT_FILTERS,
		nodeTypeToggles: { ...DEFAULT_FILTERS.nodeTypeToggles },
		activeInstruments: new Set<string>()
	});
	const loadingStore = writable<LoadingState>({ kind: 'idle' });
	const graphModeStore = writable<GraphMode>('expansion');
	const potentialCountsStore = writable<Record<string, number>>({});
	const trimmedCountStore = writable(0);
	const currentInstrumentBwbStore = writable<string | null>(null);

	// ── Requests in flight ────────────────────────────────────────────────────
	// A load that replaces the canvas cancels every request that would still
	// write into the old one.
	let controller = new AbortController();
	const signal = () => controller.signal;
	const supersede = () => {
		controller.abort();
		controller = new AbortController();
		return controller.signal;
	};

	/**
	 * Runs a loader, optionally under a loading state. Null when it failed or was
	 * superseded.
	 */
	async function run<T>(
		requestSignal: AbortSignal,
		load: () => Promise<T>,
		loading?: LoadingState
	) {
		if (loading) loadingStore.set(loading);
		try {
			return await load();
		} catch (err) {
			if (!requestSignal.aborted) console.warn('[graph-store] load failed', err);
			return null;
		} finally {
			if (loading && !requestSignal.aborted) loadingStore.set({ kind: 'idle' });
		}
	}

	// ── Derived nodes ─────────────────────────────────────────────────────────
	// In the collapsed view every law with articles on the canvas needs an
	// instrument node to collapse into. Proxies stand in for laws that have no
	// real instrument node. They only exist in that view: elsewhere they are
	// invisible and still pull on the layout and the camera bounds.
	const synthesizeDerivedNodes = () => {
		for (const id of [...nodes.keys()]) {
			if (id.startsWith(SYNTH_INSTRUMENT)) {
				nodes.delete(id);
				insertedAt.delete(id);
			}
		}
		if (!state.proxiesEnabled) return;

		const known = new Set<string>();
		for (const n of nodes.values()) if (n.kind === 'instrument') known.add(lawIdOf(n) ?? '');
		for (const n of [...nodes.values()]) {
			const law = n.kind === 'article' ? lawIdOf(n) : null;
			if (!law || known.has(law)) continue;
			known.add(law);
			const id = SYNTH_INSTRUMENT + law;
			nodes.set(id, {
				...syntheticNode('instruments', law, law, { bwb_id: law, synth: true }),
				id
			});
			insertedAt.set(id, ++state.seq);
		}
	};

	// Layer totals from the wet endpoints. They replace the per-kind tallies of
	// cached neighbours, being the authoritative count.
	const wetLayerTotals: Record<string, number> = {};

	// What arrives when a Lagen button is pressed: per kind, the neighbours in
	// cached expansions that are not on the canvas.
	const recomputePotentialCounts = () => {
		const perKind = new Map<GraphNodeKind, Set<string>>();
		for (const [id, response] of cache) {
			if (!nodes.has(id)) continue;
			for (const n of response.neighbors.all ?? []) {
				if (nodes.has(n.id) || !relationOf(n.relation)) continue;
				const kind = isCollection(n.collection) ? kindOfCollection(n.collection) : 'other';
				perKind.set(kind, (perKind.get(kind) ?? new Set()).add(n.id));
			}
		}
		const counts: Record<string, number> = {};
		for (const [kind, ids] of perKind) counts[kind] = ids.size;
		potentialCountsStore.set({ ...counts, ...wetLayerTotals });
	};

	// ── Derived edges ─────────────────────────────────────────────────────────
	// Rebuilt from scratch on every emit, so prunes and deloads stay consistent.
	// Each one stands for an API relation the loaded nodes imply but the loaded
	// edges do not show.
	const addEdge = (
		source: string,
		target: string,
		relation: Relation,
		extra: Partial<Pick<GraphEdge, 'label' | 'confidence' | 'status' | 'meta'>> = {},
		prefix = ''
	) => {
		const id = prefix + edgeId(source, target, relation);
		edges.set(id, { id, source, target, relation, label: '', directed: true, ...extra });
	};

	const synthesizeDerivedEdges = () => {
		for (const id of [...edges.keys()]) if (id.startsWith(SYNTH)) edges.delete(id);

		const instrumentOfLaw = new Map<string, string>();
		for (const n of nodes.values()) {
			const law = n.kind === 'instrument' ? lawIdOf(n) : null;
			if (law) instrumentOfLaw.set(law, n.id);
		}

		// The instrument nodes are hidden in the article view and hold the
		// articles together in the collapsed view. A document or judgment that
		// relates to an article relates to its law: AMENDS, REFERS_TO, ...
		if (instrumentOfLaw.size > 0) {
			for (const e of [...edges.values()]) {
				const from = nodes.get(e.source);
				const article = nodes.get(e.target);
				if (!from || (from.kind !== 'document' && from.kind !== 'judgment')) continue;
				if (article?.kind !== 'article') continue;
				const law = lawIdOf(article);
				const instrument = law && instrumentOfLaw.get(law);
				if (!instrument) continue;
				addEdge(
					e.source,
					instrument,
					e.relation,
					{ label: 'via artikel', status: e.status, confidence: e.confidence },
					SYNTH
				);
			}
			// The API gives this edge only as a neighbour of the instrument, so an
			// article loaded on its own does not carry it.
			for (const n of nodes.values()) {
				const law = n.kind === 'article' ? lawIdOf(n) : null;
				const instrument = law && instrumentOfLaw.get(law);
				if (instrument) addEdge(n.id, instrument, 'PART_OF', {}, SYNTH);
			}
		}

		// Members and factions loaded by separate layers carry the link in the
		// member's dated faction memberships.
		for (const n of nodes.values()) {
			if (n.kind !== 'member') continue;
			const memberships = (n.raw?.props?.faction_memberships ??
				[]) as Schema<'FactionMembershipDTO'>[];
			for (const m of memberships) {
				const faction = nodeId('factions', m.faction_key);
				if (nodes.has(faction)) addEdge(n.id, faction, 'MEMBER_OF', {}, SYNTH);
			}
		}
	};

	const emit = () => {
		synthesizeDerivedNodes();
		nodesStore.set([...nodes.values()]);
		recomputePotentialCounts();
		synthesizeDerivedEdges();
		edgesStore.set([...edges.values()]);
	};

	// ── History ───────────────────────────────────────────────────────────────
	const updateHistoryFlags = () => {
		canGoBackStore.set(state.historyIndex > 0);
		canGoForwardStore.set(state.historyIndex < history.length - 1);
	};

	const recordHistory = (id: string) => {
		history.splice(state.historyIndex + 1);
		history.push(id);
		state.historyIndex = history.length - 1;
		updateHistoryFlags();
	};

	const focusInternal = (id: string, opts?: { recordHistory?: boolean }) => {
		const target = nodes.get(id);
		if (!target) return null;
		selectionStore.set(target);
		if (opts?.recordHistory ?? true) recordHistory(id);
		return target;
	};

	// ── Canvas lifecycle ──────────────────────────────────────────────────────
	const clearCanvas = () => {
		nodes.clear();
		edges.clear();
		cache.clear();
		insertedAt.clear();
		history.length = 0;
		state.seq = 0;
		state.historyIndex = -1;
		currentInstrumentBwbStore.set(null);
		trimmedCountStore.set(0);
		for (const k of Object.keys(wetLayerTotals)) delete wetLayerTotals[k];
		updateHistoryFlags();
	};

	const reset = () => {
		supersede();
		clearCanvas();
		pinned.clear();
		pinnedStore.set(new Set());
		selectionStore.set(null);
		graphModeStore.set('expansion');
		emit();
	};

	/** Start of a bulk loader: a replacing load empties the canvas, an additive one keeps it. */
	const prepareBulkLoad = (additive: boolean) => {
		if (!additive) clearCanvas();
	};

	// Each additive layer lands in its own sector around what is there,
	// 60 degrees after the previous one, and the force layout settles it.
	const placeAdditiveLayer = (seqBefore: number) => {
		const added = [...insertedAt].filter(([, seq]) => seq > seqBefore).map(([id]) => id);
		if (added.length === 0) return;
		let maxR = 0;
		for (const [id, n] of nodes) {
			if ((insertedAt.get(id) ?? 0) > seqBefore) continue;
			maxR = Math.max(maxR, Math.hypot(n.x ?? 0, n.y ?? 0));
		}
		if (maxR < 1) return; // empty canvas: the layout starts from the origin

		const angle = state.additiveLayerIndex++ * (Math.PI / 3) + Math.PI / 4;
		const cx = Math.cos(angle) * (maxR + 180);
		const cy = Math.sin(angle) * (maxR + 180);
		const scatter = Math.max(40, Math.sqrt(added.length) * 12);
		added.forEach((id, i) => {
			const n = nodes.get(id);
			if (!n) return;
			const a = (i / added.length) * Math.PI * 2;
			const r = scatter * (0.4 + 0.6 * Math.random());
			n.x = cx + Math.cos(a) * r;
			n.y = cy + Math.sin(a) * r;
		});
	};

	/** End of a bulk loader. A replacing load also selects `select` and switches to bulk mode. */
	const finishBulk = (additive: boolean, seqBefore: number, select?: GraphNode) => {
		if (additive) {
			placeAdditiveLayer(seqBefore);
		} else {
			selectionStore.set(select ?? null);
			graphModeStore.set('bulk');
		}
		emit();
	};

	/** Adds a node, or replaces it and keeps its place in the trim order. */
	const touchNode = (id: string, node: GraphNode) => {
		if (!nodes.has(id)) insertedAt.set(id, ++state.seq);
		nodes.set(id, node);
	};

	const trimToCap = () => {
		if (nodes.size <= SOFT_NODE_CAP) return;
		const selected = get(selectionStore);
		const protect = new Set(pinned);
		if (selected) {
			protect.add(selected.id);
			for (const e of edges.values()) {
				if (e.source === selected.id) protect.add(e.target);
				if (e.target === selected.id) protect.add(e.source);
			}
		}
		const drop = nodes.size - SOFT_NODE_CAP;
		const oldest = [...nodes.keys()]
			.filter((id) => !protect.has(id))
			.sort((a, b) => (insertedAt.get(a) ?? 0) - (insertedAt.get(b) ?? 0))
			.slice(0, drop);
		for (const id of oldest) {
			nodes.delete(id);
			insertedAt.delete(id);
		}
		trimmedCountStore.update((n) => n + oldest.length);
		for (const [id, e] of [...edges]) {
			if (!nodes.has(e.source) || !nodes.has(e.target)) edges.delete(id);
		}
	};

	// ── Nodes and edges from API responses ────────────────────────────────────
	/**
	 * The node to draw for an API node. Instruments are drawn as clusters, so
	 * they are only recorded; null for them and for collections this app does
	 * not know.
	 */
	const drawable = (node: BaseNode): GraphNode | null => {
		const p = node.props ?? {};
		if (node.collection === 'instruments') {
			recordInstrument({
				key: node.key,
				bwb_id: p.bwb_id,
				display_name: node.display_name,
				title: p.title,
				citation_title: p.citation_title,
				short_title: p.short_title
			});
			return null;
		}
		const graphNode = nodeToGraphNode(node);
		const law = graphNode?.kind === 'article' ? getLawIdFromProps(p, node.key) : null;
		if (law) {
			recordInstrument({ bwb_id: law, citation_title: p.instrument_citation_title });
			ensureInstrumentMeta(law);
		}
		return graphNode;
	};

	/** Whether an edge passes the semantic threshold; only semantic edges carry a confidence worth checking. */
	const passesThreshold = (
		relation: Relation,
		sourceKind: GraphNodeKind,
		confidence: number | null | undefined
	) =>
		confidence == null ||
		edgeCategory(relation, sourceKind) !== 'semantic' ||
		confidence >= get(filtersStore).semanticThreshold;

	/** Puts a node and its neighbours on the canvas. Returns the id of the node. */
	const mergeResponse = (response: Schema<'NodeGraphResponse'>): string | null => {
		const center = nodeToGraphNode(response.node);
		if (!center) return null;
		touchNode(center.id, center);

		for (const neighbor of response.neighbors.all ?? []) {
			const relation = relationOf(neighbor.relation);
			const other = relation && drawable(neighbor);
			if (!relation || !other) continue;
			const [source, target] =
				neighbor.direction === 'outbound' ? [center, other] : [other, center];
			if (!passesThreshold(relation, source.kind, neighbor.confidence)) continue;
			touchNode(other.id, other);
			addEdge(source.id, target.id, relation, { confidence: neighbor.confidence });
		}

		trimToCap();
		emit();
		return center.id;
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
		canGoBackStore,
		canGoForwardStore,
		filtersStore,
		loadingStore,
		graphModeStore,
		potentialCountsStore,
		trimmedCountStore,
		currentInstrumentBwbStore,
		wetLayerTotals,
		state,
		signal,
		supersede,
		run,
		emit,
		addEdge,
		drawable,
		passesThreshold,
		mergeResponse,
		touchNode,
		prepareBulkLoad,
		finishBulk,
		reset,
		recomputePotentialCounts,
		updateHistoryFlags,
		focusInternal
	};
}

export type GraphContext = ReturnType<typeof createGraphContext>;

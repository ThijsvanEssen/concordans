import { textOf } from '$lib/text/words';
import { officialNumber } from '$lib/bron/dossier-naam';
import { primeInstrumentNames, recordInstrument } from '$lib/api/instrument-cache';
import { neighborsOf } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import {
	containerIdFor,
	containerKindOf,
	focusKindOf,
	createContainerGroups,
	type ContainerKind
} from '../container-membership';
import { isCollection, nodeId, type Collection, type Relation } from '$lib/vocabulary';
import { COLLECTION_ROLE } from '../collection-role';
import { get, writable } from 'svelte/store';
import {
	buildNodeLabel,
	drawClassOf,
	lawIdOf,
	nodeToGraphNode,
	relationOf,
	type BaseNode,
	type GraphEdge,
	type GraphNode
} from '../types';
import { DEFAULT_FILTERS, SOFT_NODE_CAP, type GraphFilters } from './types';
import { canvasClusters, hullOfLaw, isCanvasNode } from '../canvas-clusters';
import { isDrawn } from '../collection-role';
import { planTrim } from './budget';
import { isPublication, periodOf, placeConnection, type End } from './placement';

/**
 * The names of a container's hull: short on the hull, in full on hover. A dossier by its number
 * as a citation writes it (`36600 VIII`, #95), a commissie or fractie by its abbreviation.
 */
export function containerNames(node: BaseNode, containerKind: ContainerKind) {
	const p = node.props ?? {};
	if (containerKind === 'dossier') {
		const number = textOf(p.label);
		const short = number ? officialNumber(number) : '';
		return { short, full: [short, textOf(p.title)].filter(Boolean).join(', ') };
	}
	const short =
		textOf(p.abbreviation) ?? buildNodeLabel(node, drawClassOf(node.collection as Collection));
	return { short: short ?? '', full: textOf(p.name) ?? textOf(node.display_name) ?? '' };
}

const edgeId = (source: string, target: string, relation: Relation) =>
	`${source}->${target}:${relation}`;

/**
 * Shared mutable state and the primitives every loader builds on: node and
 * edge maps, the writable stores that mirror them, trimming and the
 * derived nodes and edges. Loader modules receive this object and never
 * create their own copies.
 */
export function createGraphContext() {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, GraphEdge>();
	/** Expansion responses by node id. */
	const cache = new Map<string, Schema<'NodeGraphResponse'>>();
	const pinned = new Set<string>();
	// On one object because a destructured `let` would freeze its value.
	const state = { seq: 0 };
	// What the last composition said of the netwerk, for the budget's clusters.
	const netwerk: { core: ReadonlySet<string> | null; surroundings: boolean } = {
		core: null,
		surroundings: false
	};
	// Insertion sequence per node: the order in which the soft cap trims.
	const insertedAt = new Map<string, number>();
	// The hulls around the bronnen a suppressed container holds.
	const containers = createContainerGroups();

	const nodesStore = writable<GraphNode[]>([]);
	const edgesStore = writable<GraphEdge[]>([]);
	const selectionStore = writable<GraphNode | null>(null);
	const pinnedStore = writable<Set<string>>(new Set());
	const filtersStore = writable<GraphFilters>({
		...DEFAULT_FILTERS,
		hiddenLines: new Set(DEFAULT_FILTERS.hiddenLines),
		hiddenAnnexes: DEFAULT_FILTERS.hiddenAnnexes,
		hiddenGroups: new Set(DEFAULT_FILTERS.hiddenGroups)
	});
	const trimmedCountStore = writable(0);

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

	// ── Derived edges ─────────────────────────────────────────────────────────
	// Rebuilt from scratch on every emit, so prunes and deloads stay consistent.
	// Each one stands for an API relation the loaded nodes imply but the loaded
	// edges do not show. Where a verbinding lands is `placeConnection`'s to say.
	const addEdge = (
		source: string,
		target: string,
		relation: Relation,
		extra: Partial<Pick<GraphEdge, 'label' | 'confidence' | 'status' | 'meta'>> = {}
	) => {
		const id = edgeId(source, target, relation);
		// A neighbourhood edge carries no meta; it does not wipe what a node response said.
		const meta = extra.meta ?? edges.get(id)?.meta;
		edges.set(id, { id, source, target, relation, label: '', directed: true, ...extra, meta });
	};

	const emit = () => {
		nodesStore.set([...nodes.values()]);
		edgesStore.set([...edges.values()]);
		containers.prune(new Set(nodes.keys()));
	};

	const focusInternal = (id: string) => {
		const target = nodes.get(id);
		if (!target) return null;
		selectionStore.set(target);
		return target;
	};

	// ── Canvas lifecycle ──────────────────────────────────────────────────────
	const clearCanvas = () => {
		nodes.clear();
		edges.clear();
		cache.clear();
		insertedAt.clear();
		state.seq = 0;
		trimmedCountStore.set(0);
	};

	const reset = () => {
		supersede();
		clearCanvas();
		containers.clear();
		pinned.clear();
		pinnedStore.set(new Set());
		netwerk.core = null;
		netwerk.surroundings = false;
		selectionStore.set(null);
		emit();
	};

	/** Takes nodes off the canvas, and every edge that loses an end with them. Does not emit. */
	const removeNodes = (ids: Iterable<string>) => {
		for (const id of ids) {
			nodes.delete(id);
			insertedAt.delete(id);
		}
		for (const [id, e] of [...edges]) {
			if (!nodes.has(e.source) || !nodes.has(e.target)) edges.delete(id);
		}
	};

	/** Adds a node, or replaces it and keeps its place in the trim order. */
	const touchNode = (id: string, node: GraphNode) => {
		if (!nodes.has(id)) insertedAt.set(id, ++state.seq);
		nodes.set(id, node);
	};

	/**
	 * Within the soft cap, by the budget (`budget.ts`): every chosen bron its equal share, a folded
	 * cluster one place, the oldest first. `keep`: the bron a response was just merged for, not yet
	 * selected but never the one to go.
	 */
	const trimToCap = (keep?: string) => {
		// A cluster only lowers the cost: no more nodes than the cap is within it already.
		if (nodes.size <= SOFT_NODE_CAP) return;
		const selected = get(selectionStore);
		const groups = containers.current();
		const view = [...nodes.values()];
		const drawn = [...edges.values()].filter((e) => isDrawn(e.relation));
		const clusters = canvasClusters(
			{
				nodes: view.filter(isCanvasNode),
				edges: drawn,
				focus: selected?.id ?? null,
				pinned,
				core: netwerk.core,
				surroundings: netwerk.surroundings,
				groups,
				nodeOf: (id) => nodes.get(id)
			},
			new Set()
		);
		const protect = new Set(pinned);
		if (keep) protect.add(keep);
		if (selected) {
			protect.add(selected.id);
			// A selected container has no edges of its own to protect its children by
			// (they are containment, not peer edges): protect its current hull instead.
			const selectedContainerKind = selected.raw && focusKindOf(selected.raw.collection);
			const selectedContainerId =
				selected.raw && selectedContainerKind && containerIdFor(selected.raw);
			const group = selectedContainerId ? groups.get(selectedContainerId) : undefined;
			if (group) for (const id of group.members) protect.add(id);
			for (const e of edges.values()) {
				if (e.source === selected.id) protect.add(e.target);
				if (e.target === selected.id) protect.add(e.source);
			}
		}
		const dropped = planTrim({
			ids: [...nodes.keys()],
			edges: drawn,
			order: (id) => insertedAt.get(id) ?? 0,
			cap: SOFT_NODE_CAP,
			chosen: [...pinned],
			hullOf: (id) => hullOfLaw(nodes.get(id), groups),
			core: netwerk.core,
			protect,
			clusters
		});
		if (dropped.length === 0) return;
		removeNodes(dropped);
		trimmedCountStore.update((n) => n + dropped.length);
	};

	// ── Nodes and edges from API responses ────────────────────────────────────
	/**
	 * Records a container's own name (an instrument's through `instrumentMetaStore`,
	 * the rest through `containers.recordMeta`) so the hull around its children has a
	 * label, whether the container is a neighbour or the bron navigated to.
	 */
	const recordContainerFor = (node: BaseNode, containerKind: ContainerKind) => {
		const p = node.props ?? {};
		if (containerKind === 'instrument') {
			recordInstrument({
				key: node.key,
				bwb_id: p.bwb_id,
				display_name: node.display_name,
				title: p.title,
				citation_title: p.citation_title,
				short_title: p.short_title,
				abbreviation: p.abbreviation
			});
		} else {
			const { short, full } = containerNames(node, containerKind);
			containers.recordMeta(containerKind, containerIdFor(node), short, full);
		}
	};

	/**
	 * The node to draw for an API node. A container (a wet, fractie, commissie or
	 * dossier) is drawn as a hull around its children instead of as a bron, so it
	 * is only recorded; null for it and for collections this app does not know.
	 */
	const drawable = (node: BaseNode): GraphNode | null => {
		// Not a zaak or a version (COLLECTION_ROLE.neighbour): 37014's one Zaak is the bill.
		if (!isCollection(node.collection) || !COLLECTION_ROLE[node.collection].neighbour) return null;
		const p = node.props ?? {};
		const containerKind = containerKindOf(node.collection);
		if (containerKind) {
			recordContainerFor(node, containerKind);
			return null;
		}
		const graphNode = nodeToGraphNode(node);
		const law = graphNode?.drawClass === 'article' ? lawIdOf(p) : null;
		if (law) {
			recordInstrument({
				bwb_id: law,
				citation_title: p.instrument_citation_title,
				abbreviation: p.instrument_abbreviation
			});
			primeInstrumentNames();
			containers.recordMember('instrument', law, graphNode!.id);
		}
		return graphNode;
	};

	/** The end of a verbinding as `placeConnection` reads it. */
	const endOf = (
		collection: string,
		node: GraphNode | null | undefined,
		props?: Record<string, unknown> | null
	): End => ({
		publication: isPublication({ collection, props }),
		hull: containerKindOf(collection),
		drawn: !!node,
		drawClass: node?.drawClass ?? 'other'
	});

	/** The semantic threshold of the filters: only semantic edges carry a confidence worth checking. */
	const threshold = () => get(filtersStore).semanticThreshold;

	/**
	 * Puts a node and its neighbours on the canvas. Returns the id of the node.
	 *
	 * The centre is always recorded, even when it is itself a container (a wet,
	 * fractie, commissie or dossier navigated to directly): the bron stays
	 * selectable for the reader and the Verbonden panel, but `GraphView` never
	 * draws a container as a canvas node, so its children are what a hull groups.
	 */
	const mergeResponse = (
		response: Schema<'NodeGraphResponse'>,
		draw = Number.POSITIVE_INFINITY
	): string | null => {
		const id = mergeInto(response, draw);
		if (!id) return null;
		// The centre went in first, so it is the oldest: without this, a wet with more
		// articles than the cap trimmed itself and its link said it was not in the dataset.
		trimToCap(id);
		emit();
		return id;
	};

	/**
	 * `mergeResponse` without the trim and the emit, and limited to the neighbours
	 * `keep` accepts by node id: a composed netwerk draws only what ties its bronnen.
	 */
	const mergeInto = (
		response: Schema<'NodeGraphResponse'>,
		draw = Number.POSITIVE_INFINITY,
		keep?: (id: string) => boolean
	): string | null => {
		const center = nodeToGraphNode(response.node);
		if (!center) return null;
		const centerContainerKind = focusKindOf(response.node.collection);
		// A fractie, commissie, dossier or wet is its hull, and its anchor the point what is
		// not in it ties to (VVD's stemmingen, "100 stemmingen"): without it those lines had
		// no end and their bronnen went unseen.
		if (centerContainerKind) {
			center.anchor = true;
			recordContainerFor(response.node, centerContainerKind);
			containers.recordMember(centerContainerKind, containerIdFor(response.node), center.id);
		}
		touchNode(center.id, center);

		const near = {
			...endOf(response.node.collection, center, response.node.props),
			hull: centerContainerKind,
			drawn: true
		};
		for (const neighbor of neighborsOf(response).slice(0, draw)) {
			const id = nodeId(neighbor.collection, neighbor.key);
			if (keep && !keep(id)) continue;
			const relation = relationOf(neighbor.relation);
			if (!relation) continue;
			const other = drawable(neighbor);
			const far = endOf(neighbor.collection, other, neighbor.props);
			const outbound = neighbor.direction === 'outbound';
			const placement = placeConnection({
				relation,
				source: outbound ? near : far,
				target: outbound ? far : near,
				confidence: neighbor.confidence,
				threshold: threshold()
			});
			// The neighbour is the only end that is ever drawn as an anchor here.
			const point = placement.anchor ? anchorContainer(neighbor) : null;
			if (placement.anchor && !point) continue;
			if (placement.place === 'member') {
				const period = placement.seat ? periodOf(neighbor.meta) : null;
				const inFocus = placement.hull === (outbound ? 'source' : 'target');
				// In the focus's hull goes the neighbour, drawn; in the neighbour's, the focus.
				if (inFocus && other) touchNode(other.id, other);
				if (inFocus && other && near.hull)
					containers.recordMember(
						near.hull,
						containerIdFor(response.node),
						other.id,
						relation,
						period
					);
				if (!inFocus && far.hull)
					containers.recordMember(far.hull, containerIdFor(neighbor), center.id, relation, period);
				continue;
			}
			if (placement.place === 'none') continue;
			// The line ends at the neighbour's anchor, or at the neighbour, drawn.
			const end = point ?? other;
			if (!end) continue;
			if (end === other) touchNode(other.id, other);
			const [source, target] = outbound ? [center, end] : [end, center];
			addEdge(source.id, target.id, relation, {
				confidence: neighbor.confidence,
				status: neighbor.status,
				meta: placement.meta ? neighbor.meta : undefined
			});
		}
		return center.id;
	};

	/**
	 * Draws a container (a wet, fractie, commissie or dossier) as the point its hull is
	 * drawn around, as for a wet a stuk changes (`placeConnection`): a chosen container
	 * stays on the canvas with nothing of its own drawn around it yet.
	 */
	const anchorContainer = (node: BaseNode): GraphNode | null => {
		const kind = focusKindOf(node.collection);
		const anchor = kind && nodeToGraphNode(node);
		if (!kind || !anchor) return null;
		anchor.anchor = true;
		recordContainerFor(node, kind);
		containers.recordMember(kind, containerIdFor(node), anchor.id);
		touchNode(anchor.id, anchor);
		return anchor;
	};

	/** Drops every node not in `keepIds`, and the edges that touched it. Does not emit. */
	const pruneToIds = (keepIds: ReadonlySet<string>) =>
		removeNodes([...nodes.keys()].filter((id) => !keepIds.has(id)));

	return {
		nodes,
		edges,
		cache,
		pinned,
		containers,
		nodesStore,
		edgesStore,
		selectionStore,
		pinnedStore,
		filtersStore,
		trimmedCountStore,
		signal,
		supersede,
		emit,
		addEdge,
		drawable,
		recordContainerFor,
		endOf,
		threshold,
		mergeResponse,
		mergeInto,
		anchorContainer,
		trimToCap,
		pruneToIds,
		removeNodes,
		touchNode,
		netwerk,
		reset,
		focusInternal
	};
}

export type GraphContext = ReturnType<typeof createGraphContext>;

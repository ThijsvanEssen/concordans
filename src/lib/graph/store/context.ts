import { primeInstrumentNames, recordInstrument } from '$lib/api/instrument-cache';
import { neighborsOf } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import {
	containerIdFor,
	containerKindOf,
	getContainerGroup,
	isContainerMembership,
	pruneContainerMembers,
	recordContainerMember,
	recordContainerMeta,
	type ContainerKind
} from '../container-membership';
import { getLawIdFromProps } from '$lib/util/law-id';
import type { Collection, Relation } from '$lib/vocabulary';
import { get, writable } from 'svelte/store';
import {
	buildNodeLabel,
	edgeCategory,
	isVersionCollection,
	kindOfCollection,
	nodeToGraphNode,
	relationOf,
	type BaseNode,
	type GraphEdge,
	type GraphNode,
	type GraphNodeKind
} from '../types';
import { DEFAULT_FILTERS, SOFT_NODE_CAP, type GraphFilters } from './types';

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
	// Insertion sequence per node: the order in which the soft cap trims.
	const insertedAt = new Map<string, number>();

	const nodesStore = writable<GraphNode[]>([]);
	const edgesStore = writable<GraphEdge[]>([]);
	const selectionStore = writable<GraphNode | null>(null);
	const pinnedStore = writable<Set<string>>(new Set());
	const filtersStore = writable<GraphFilters>({
		...DEFAULT_FILTERS,
		hiddenRelations: new Set(DEFAULT_FILTERS.hiddenRelations)
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
	// edges do not show.
	const addEdge = (
		source: string,
		target: string,
		relation: Relation,
		extra: Partial<Pick<GraphEdge, 'label' | 'confidence' | 'status' | 'meta'>> = {}
	) => {
		const id = edgeId(source, target, relation);
		edges.set(id, { id, source, target, relation, label: '', directed: true, ...extra });
	};

	const emit = () => {
		nodesStore.set([...nodes.values()]);
		edgesStore.set([...edges.values()]);
		pruneContainerMembers(new Set(nodes.keys()));
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
		pinned.clear();
		pinnedStore.set(new Set());
		selectionStore.set(null);
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
			// A selected container has no edges of its own to protect its children by
			// (they are containment, not peer edges): protect its current hull instead.
			const selectedContainerKind = selected.raw && containerKindOf(selected.raw.collection);
			const selectedContainerId =
				selected.raw && selectedContainerKind && containerIdFor(selected.raw);
			const group = selectedContainerId ? getContainerGroup(selectedContainerId) : undefined;
			if (group) for (const id of group.members) protect.add(id);
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
	 * Records a container's own name (an instrument's through `instrumentMetaStore`,
	 * the rest through `recordContainerMeta`) so the hull around its children has a
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
				short_title: p.short_title
			});
		} else {
			recordContainerMeta(
				containerKind,
				containerIdFor(node),
				buildNodeLabel(node, kindOfCollection(node.collection as Collection))
			);
		}
	};

	/**
	 * The node to draw for an API node. A container (a wet, fractie, commissie or
	 * dossier) is drawn as a hull around its children instead of as a bron, so it
	 * is only recorded; null for it and for collections this app does not know.
	 */
	const drawable = (node: BaseNode): GraphNode | null => {
		if (isVersionCollection(node.collection)) return null;
		const p = node.props ?? {};
		const containerKind = containerKindOf(node.collection);
		if (containerKind) {
			recordContainerFor(node, containerKind);
			return null;
		}
		const graphNode = nodeToGraphNode(node);
		const law = graphNode?.kind === 'article' ? getLawIdFromProps(p, node.key) : null;
		if (law) {
			recordInstrument({ bwb_id: law, citation_title: p.instrument_citation_title });
			primeInstrumentNames();
			recordContainerMember('instrument', law, graphNode!.id);
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
		const center = nodeToGraphNode(response.node);
		if (!center) return null;
		touchNode(center.id, center);
		const centerContainerKind = containerKindOf(response.node.collection);
		if (centerContainerKind) recordContainerFor(response.node, centerContainerKind);

		for (const neighbor of neighborsOf(response).slice(0, draw)) {
			const relation = relationOf(neighbor.relation);
			const other = relation && drawable(neighbor);

			const neighborContainerKind = relation && containerKindOf(neighbor.collection);
			if (
				relation &&
				neighborContainerKind &&
				isContainerMembership(neighborContainerKind, relation)
			) {
				recordContainerMember(neighborContainerKind, containerIdFor(neighbor), center.id);
				continue;
			}
			if (
				relation &&
				other &&
				centerContainerKind &&
				isContainerMembership(centerContainerKind, relation)
			) {
				touchNode(other.id, other);
				recordContainerMember(centerContainerKind, containerIdFor(response.node), other.id);
				continue;
			}

			if (!relation || !other) continue;
			const [source, target] =
				neighbor.direction === 'outbound' ? [center, other] : [other, center];
			if (!passesThreshold(relation, source.kind, neighbor.confidence)) continue;
			touchNode(other.id, other);
			addEdge(source.id, target.id, relation, {
				confidence: neighbor.confidence,
				status: neighbor.status
			});
		}

		trimToCap();
		emit();
		return center.id;
	};

	/** Drops every node not in `keepIds`, and the edges that touched it. Does not emit. */
	const pruneToIds = (keepIds: Set<string>) => {
		for (const id of [...nodes.keys()]) {
			if (keepIds.has(id)) continue;
			nodes.delete(id);
			insertedAt.delete(id);
		}
		for (const [id, e] of [...edges]) {
			if (!keepIds.has(e.source) || !keepIds.has(e.target)) edges.delete(id);
		}
	};

	return {
		nodes,
		edges,
		cache,
		pinned,
		insertedAt,
		nodesStore,
		edgesStore,
		selectionStore,
		pinnedStore,
		filtersStore,
		trimmedCountStore,
		state,
		signal,
		supersede,
		emit,
		addEdge,
		drawable,
		recordContainerFor,
		passesThreshold,
		mergeResponse,
		pruneToIds,
		touchNode,
		reset,
		focusInternal
	};
}

export type GraphContext = ReturnType<typeof createGraphContext>;

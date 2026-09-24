import type { Readable } from 'svelte/store';
import type { Schema } from '$lib/api/types';
import type { Collection, Relation } from '$lib/vocabulary';
import type { GraphNode, GraphEdge } from '../types';

/** A bron a group of the panel Verbonden puts on the canvas. */
export type CanvasRow = {
	ref: { collection: Collection; key: string };
	title: string;
	relation: Relation;
	direction: 'inbound' | 'outbound';
	proposed?: boolean;
	props?: Record<string, unknown>;
};

export type GraphFilters = {
	/** Relations the legend switched off; their edges are not drawn. */
	hiddenRelations: Set<Relation>;
	/** Semantic edges with a lower confidence are left out. */
	semanticThreshold: number;
	/** Neighbours requested per expanded node. */
	neighborLimit: number;
	/** The canvas fades nodes outside the focus and its neighbours. */
	dimStaleContext: boolean;
};

export type GraphExpansionOptions = {
	/** Neighbours of the response that are drawn; the response itself is always whole. */
	neighborLimit?: number;
	/** Fetch again although the neighbours of the node are cached. */
	force?: boolean;
};

export const DEFAULT_FILTERS: GraphFilters = {
	hiddenRelations: new Set<Relation>(),
	semanticThreshold: 0.6,
	neighborLimit: 30,
	dimStaleContext: false
};

// Soft cap to keep the canvas responsive during additive exploration. A merge
// that would pass it drops the oldest nodes that are not pinned, selected or
// next to the selection.
export const SOFT_NODE_CAP = 400;

export type GraphStore = {
	nodes: Readable<GraphNode[]>;
	edges: Readable<GraphEdge[]>;
	selection: Readable<GraphNode | null>;
	pinned: Readable<Set<string>>;
	filters: Readable<GraphFilters>;
	/** Nodes removed by the soft cap since the last reset. */
	trimmedCount: Readable<number>;
	/** The node response of a bron, from the cache or the API. Nothing is drawn. */
	nodeResponse: (
		collection: Collection,
		key: string,
		opts?: GraphExpansionOptions
	) => Promise<Schema<'NodeGraphResponse'>>;
	expandNode: (
		collection: Collection,
		key: string,
		opts?: GraphExpansionOptions
	) => Promise<GraphNode | null>;
	/**
	 * Every node and edge within `depth` hops of a node, in one request; it replaces the
	 * canvas's context. Narrowed to `relations` (and `nodeTypes`), it only adds.
	 */
	expandNeighborhood: (
		collection: Collection,
		key: string,
		opts?: { depth?: number; cap?: number; relations?: Relation[]; nodeTypes?: string[] }
	) => Promise<GraphNode | null>;
	setSelection: (nodeId: string | null) => void;
	togglePin: (nodeId: string) => void;
	unpinNode: (nodeId: string) => void;
	focusNode: (nodeId: string) => GraphNode | null;
	/** Draws bronnen next to `focusId`, each with the verbinding that ties it to the focus. */
	showRows: (focusId: string, rows: CanvasRow[]) => void;
	/** Takes bronnen off the canvas; the selected and the pinned ones stay. */
	hideRows: (ids: string[]) => void;
	reset: () => void;
	setFilters: (updater: Partial<GraphFilters>) => void;
	getNodeById: (nodeId: string) => GraphNode | undefined;
	getEdgeById: (edgeId: string) => GraphEdge | undefined;
	/** Removes every node not in `keepIds` and the edges that touch them. */
	pruneNodes: (keepIds: Set<string>) => void;
	/** Drops every node without an edge that is neither selected nor pinned. Force-directed
	 *  layout throws such orphans far from the rest and the camera then zooms out to fit them. */
	sweepOrphans: () => void;
};

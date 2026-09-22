import type { Readable } from 'svelte/store';
import type { Schema } from '$lib/api/types';
import type { Collection, Relation } from '$lib/vocabulary';
import type { GraphNode, GraphEdge, GraphNodeKind } from '../types';

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
	/** One switch per edge category (see `edgeCategory`). */
	structuralEnabled: boolean;
	mutationEnabled: boolean;
	semanticEnabled: boolean;
	/** Semantic edges with a lower confidence are left out. */
	semanticThreshold: number;
	nodeTypeToggles: Record<GraphNodeKind, boolean>;
	minDegree: number;
	activeInstruments: Set<string>;
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
	structuralEnabled: true,
	mutationEnabled: true,
	semanticEnabled: true,
	semanticThreshold: 0.6,
	nodeTypeToggles: {
		instrument: true,
		article: true,
		judgment: true,
		dossier: true,
		document: true,
		activity: true,
		committee: true,
		member: true,
		faction: true,
		other: true
	},
	minDegree: 0,
	activeInstruments: new Set<string>(),
	neighborLimit: 30,
	dimStaleContext: false
};

// Soft cap to keep the canvas responsive during additive exploration. A merge
// that would pass it drops the oldest nodes that are not pinned, selected or
// next to the selection. Bulk loaders bypass it.
export const SOFT_NODE_CAP = 400;

/** Neighbours requested when a loader opens a hub (member, faction). */
export const HUB_NEIGHBOR_LIMIT = 50;

export type LoadingState =
	| { kind: 'idle' }
	| { kind: 'instrument'; bwbId: string; phase: 'fetching' | 'building' }
	| { kind: 'global'; phase: 'fetching' | 'building' }
	| { kind: 'parliamentary'; phase: 'fetching' | 'building' };

/**
 * `bulk`: a loader filled the canvas and every node has its neighbourhood, so a
 * click selects. `expansion`: the canvas grows one request per click.
 */
export type GraphMode = 'expansion' | 'bulk';

type Loaded = Promise<{ count: number } | null>;
type LayerOptions = { additive?: boolean };

export type GraphStore = {
	nodes: Readable<GraphNode[]>;
	edges: Readable<GraphEdge[]>;
	selection: Readable<GraphNode | null>;
	pinned: Readable<Set<string>>;
	filters: Readable<GraphFilters>;
	loading: Readable<LoadingState>;
	graphMode: Readable<GraphMode>;
	/** Per kind: neighbours known from cached expansions or layer totals that are not on the canvas. */
	potentialCounts: Readable<Record<string, number>>;
	/** Nodes removed by the soft cap since the last reset. */
	trimmedCount: Readable<number>;
	/** bwb_id of the wet the canvas shows in full; null in every other mode. */
	currentInstrumentBwb: Readable<string | null>;
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
	/** Every node and edge within `depth` hops of a node, in one request. */
	expandNeighborhood: (
		collection: Collection,
		key: string,
		opts?: { depth?: number; cap?: number }
	) => Promise<GraphNode | null>;
	/** Replaces the canvas with the articles of one wet. Null leaves the canvas as it is. */
	loadInstrument: (bwbId: string) => Loaded;
	/** Judgments that cite the wet, with an edge to each cited article on the canvas. */
	loadInstrumentJudgmentsLayer: (bwbId: string) => Loaded;
	/** Dossiers that legislated the wet, connected to it. */
	loadInstrumentDossiersLayer: (bwbId: string) => Loaded;
	/**
	 * Every edge that touches an article of the wet, with the nodes at the other end.
	 * `relations` narrows the request; `collections` keeps other nodes off the canvas
	 * (REFERS_TO reaches thousands of judgments that a layer of articles does not want);
	 * `maxEdges` caps the answer, which lists structural edges first and citations last.
	 */
	loadInstrumentCitations: (
		bwbId: string,
		opts?: { relations?: Relation[]; collections?: Collection[]; maxEdges?: number }
	) => Loaded;
	/** Writes the totals of the layers of the wet into `potentialCounts`. */
	prefetchInstrumentLayerCounts: (bwbId: string) => Promise<void>;
	loadInstrumentLayerGraph: (opts?: LayerOptions) => Loaded;
	loadJudgmentLayerGraph: (opts?: LayerOptions) => Loaded;
	loadMemberGraph: (key: string) => Loaded;
	loadFactionGraph: (key: string) => Loaded;
	loadCommitteesLayerGraph: (opts?: LayerOptions) => Loaded;
	loadMembersLayerGraph: (opts?: LayerOptions) => Loaded;
	loadFactionsLayerGraph: (opts?: LayerOptions) => Loaded;
	loadRecentDossiersGraph: (opts?: LayerOptions & { days?: number }) => Loaded;
	setGraphMode: (mode: GraphMode) => void;
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
	/** Removes every node not in `keepIds` and the edges that touch them. */
	pruneNodes: (keepIds: Set<string>) => void;
	/** Drops every node without an edge that is neither selected nor pinned. Force-directed
	 *  layout throws such orphans far from the rest and the camera then zooms out to fit them. */
	sweepOrphans: () => void;
	/** Instrument proxies exist only in the collapsed (wetten) view, where they are drawn. */
	setCollapseToLaws: (collapse: boolean) => void;
};

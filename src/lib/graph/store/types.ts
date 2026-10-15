import type { Readable } from 'svelte/store';
import type { Schema } from '$lib/api/types';
import type { Collection, Relation } from '$lib/vocabulary';
import type { BaseNode, GraphNode, GraphEdge } from '../types';
import type { ContainerGroup, ContainerKind, Period } from '../container-membership';

/** The API's default depth of a neighbourhood: three steps. */
export const NEIGHBORHOOD_DEPTH = 3;
/**
 * The most bronnen one neighbourhood brings (Thijs, 9 Oct: "diepte houden, max omlaag"). At 150
 * the ten busiest bronnen of a cap of 200 all stay (126ffa Sv, 3:4 Awb, HR Urgenda, a Kamerlid,
 * dossier 36547 on prod), at 45 to 55 % of the bytes for a dossier, 75 to 80 % for the rest.
 * A phone draws fewer: 100, where a Kamerlid keeps six of the ten.
 */
export const NEIGHBORHOOD_CAP = 150;
export const NEIGHBORHOOD_CAP_PHONE = 100;

/** A neighbourhood as drawn: around `focal`, `depth` steps, `capped` at the cap. */
export type NeighborhoodReach = {
	focal: string;
	depth: number;
	capped: boolean;
	/** The cap the request was made with. */
	cap: number;
	/**
	 * The focus's direct neighbours per collection: how many there are and how many came
	 * (`buckets`).
	 */
	buckets: { collection: string; total: number; kept: number }[];
};

type NetwerkParticipant = { response: Schema<'NodeGraphResponse'> };

/** A bron a group of the panel Verbonden puts on the canvas. */
export type CanvasRow = {
	ref: { collection: Collection; key: string };
	title: string;
	relation: Relation;
	direction: 'inbound' | 'outbound';
	proposed?: boolean;
	props?: Record<string, unknown>;
	/** A judgment as the API cites it: its label on the canvas. */
	cite?: BaseNode['cite'];
	/** The seat the verbinding records (a member's term, a bewindspersoon's posts). */
	period?: Period | null;
};

export type GraphFilters = {
	/** Relations the legend switched off; their edges are not drawn. */
	hiddenRelations: Set<Relation>;
	/** Groupings the legend switched off: their bronnen stand loose, without a hull. */
	hiddenGroups: Set<ContainerKind>;
	/** Semantic edges with a lower confidence are left out. */
	semanticThreshold: number;
	/** Neighbours requested per expanded node. */
	neighborLimit: number;
	/** The canvas fades nodes outside the focus and its neighbours. */
	dimStaleContext: boolean;
};

type GraphExpansionOptions = {
	/** Neighbours of the response that are drawn; the response itself is always whole. */
	neighborLimit?: number;
	/** Fetch again although the neighbours of the node are cached. */
	force?: boolean;
	/** A container drawn as its hull: only the buckets that hold its members (`getNodeHull`). */
	hull?: boolean;
};

export const DEFAULT_FILTERS: GraphFilters = {
	hiddenRelations: new Set<Relation>(),
	hiddenGroups: new Set<ContainerKind>(),
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
	/** The hulls of this canvas by container id: the bronnen each suppressed container holds. */
	containers: Readable<Map<string, ContainerGroup>>;
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
	/** Draws the bron alone from its light node, before its neighbours; null when unknown. */
	peekNode: (collection: Collection, key: string) => Promise<GraphNode | null>;
	/** How far the last neighbourhood reached, and whether the API cut it off at its cap. */
	neighborhood: Readable<NeighborhoodReach | null>;
	/**
	 * All the direct neighbours of one collection of a bron on the canvas, page by page, up to
	 * `grens` (the per-kind step of "Alles laden"). The reach's count of that collection
	 * follows. Returns how many there are now.
	 */
	laadSoort: (
		collection: Collection,
		key: string,
		soort: Collection,
		opts?: { grens?: number; signal?: AbortSignal }
	) => Promise<number>;
	/**
	 * Every node and edge within `depth` hops of a node, in one request; it replaces the
	 * canvas's context. Narrowed to `relations` (and `nodeTypes`), it only adds.
	 */
	expandNeighborhood: (
		collection: Collection,
		key: string,
		opts?: {
			depth?: number;
			cap?: number;
			relations?: Relation[];
			nodeTypes?: string[];
			/** Adds to the canvas instead of replacing its context. */
			additive?: boolean;
		}
	) => Promise<GraphNode | null>;
	/**
	 * Draws a netwerk: its chosen bronnen, what ties them, and the context still tied to
	 * them. `fresh` drops every other bron. Returns the bronnen tied to no other one, and
	 * the joining bronnen drawn.
	 */
	compose: (input: {
		participants: NetwerkParticipant[];
		withJoining: boolean;
		fresh: boolean;
		/** Bronnen on the paths between the chosen ones (`mergePaths`), kept as joining. */
		onPaths?: string[];
		/** Chosen bronnen a drawn path reaches: tied, not alone. */
		tiedByPaths?: string[];
	}) => { alone: ReadonlySet<string>; joining: string[] };
	/** Draws the paths between chosen bronnen (`/api/paths`, API 0.73); returns what it drew. */
	mergePaths: (response: Schema<'PathsResponse'>) => Promise<{ onPath: string[]; tied: string[] }>;
	/** The chosen bronnen and what ties them, while a netwerk is drawn; null otherwise. */
	core: Readable<ReadonlySet<string> | null>;
	/** Leaves only the chosen bronnen, what ties them and the selection. */
	clearContext: () => void;
	/** Ends the netwerk: nothing is chosen any more, the canvas stays as it is. */
	releaseNetwerk: () => void;
	setSelection: (nodeId: string | null) => void;
	focusNode: (nodeId: string) => GraphNode | null;
	/** Draws bronnen next to `focusId`, each with the verbinding that ties it to the focus;
	 * false when the focus is not on the canvas (yet), and nothing was drawn. */
	showRows: (focusId: string, rows: CanvasRow[]) => boolean;
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

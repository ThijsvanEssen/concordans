import type { GraphEdge, GraphNode, GraphSeed } from '../types';
import type { Readable } from 'svelte/store';

export type GraphFilters = {
	// Methode §iiib edge categories — three buckets, one toggle each.
	structuralEnabled: boolean; // deel_van, behandeld_door, raakt …
	mutationEnabled: boolean; // wijzigt, introduceert, trekt_in, licht_toe …
	semanticEnabled: boolean; // verwijst_naar, citeert, noemt_artikel …
	// Legacy aliases — kept so older filter consumers don't crash. Treat them
	// as views onto the new three buckets:
	//   citationEnabled   ↔ semanticEnabled (judicial citations are semantisch)
	//   legislativeEnabled ↔ mutationEnabled
	//   weakEnabled        ↔ semanticEnabled
	citationEnabled: boolean;
	legislativeEnabled: boolean;
	weakEnabled: boolean;
	semanticThreshold: number;
	nodeTypeToggles: {
		article: boolean;
		judgment: boolean;
		tkstuk: boolean;
		activity: boolean;
		instrument: boolean;
		dossier: boolean;
		commissie: boolean;
		lid: boolean;
		fractie: boolean;
		other: boolean;
	};
	minDegree: number;
	activeInstruments: Set<string>;
	// Per-click expansion knobs (surfaced in GraphSidebar).
	neighborLimit: number; // default 30
	showScaffolding: boolean; // bypass SCAFFOLDING_RELATIONS filter
	convergenceMode: boolean; // re-enable the level-1 + convergence prune
	dimStaleContext: boolean; // canvas fades nodes outside focus level-1
};

export type GraphExpansionOptions = {
	neighborLimit?: number;
	includeStrict?: boolean;
	includeSemantic?: boolean;
	semanticConfidenceThreshold?: number;
	force?: boolean;
	/** When true, only include neighbors with direction === 'outbound'. */
	outboundOnly?: boolean;
};

export const DEFAULT_FILTERS: GraphFilters = {
	structuralEnabled: true,
	mutationEnabled: true,
	semanticEnabled: true,
	citationEnabled: true,
	legislativeEnabled: true,
	weakEnabled: true,
	semanticThreshold: 0.6,
	nodeTypeToggles: {
		article: true,
		judgment: true,
		tkstuk: true,
		activity: true,
		instrument: true,
		dossier: true,
		commissie: true,
		lid: true,
		fractie: true,
		other: true
	},
	minDegree: 0,
	activeInstruments: new Set<string>(),
	neighborLimit: 30,
	showScaffolding: false,
	convergenceMode: false,
	// Off by default — having every non-level-1 node fade after a click was
	// surprising ("the colors don't come back when I stop hovering"). Users who
	// want focus highlighting can re-enable it in Geavanceerd.
	dimStaleContext: false
};

// Soft cap to keep the canvas responsive during additive exploration. When
// merge would push over this, we drop the oldest non-pinned, non-focused,
// non-level-1 nodes first. Bulk loaders bypass this — they ship with their
// own cardinality budget.
export const SOFT_NODE_CAP = 400;

export const DEFAULT_EXPANSION: Required<GraphExpansionOptions> = {
	neighborLimit: 50,
	includeStrict: true,
	includeSemantic: true,
	semanticConfidenceThreshold: 0.6,
	force: false,
	outboundOnly: false
};

export type LoadingState =
	| { kind: 'idle' }
	| { kind: 'instrument'; bwbId: string; phase: 'fetching' | 'building' }
	| { kind: 'global'; phase: 'fetching' | 'building' }
	| { kind: 'parliamentary'; phase: 'fetching' | 'building' };

/**
 * Tracks whether the graph holds a bulk-loaded instrument (where every node
 * already has its full neighbourhood) or a piecewise-expanded view. Consumers
 * use this to decide whether clicking a node should fire more `/api/nodes`
 * requests or just select.
 */
export type GraphMode = 'expansion' | 'bulk';

export type GraphStore = {
	nodes: Readable<GraphNode[]>;
	edges: Readable<GraphEdge[]>;
	selection: Readable<GraphNode | null>;
	pinned: Readable<Set<string>>;
	breadcrumbs: Readable<GraphNode[]>;
	canGoBack: Readable<boolean>;
	canGoForward: Readable<boolean>;
	filters: Readable<GraphFilters>;
	loading: Readable<LoadingState>;
	graphMode: Readable<GraphMode>;
	/** Per-kind count of neighbours we already know about (from cached
	 *  /api/nodes responses) but haven't merged onto the canvas yet. Drives
	 *  the "potential" number shown on inactive Lagen buttons — what would
	 *  arrive if you click. Updated alongside every node/edge emit. */
	potentialCounts: Readable<Record<string, number>>;
	/** Running total of nodes silently removed by the LRU cap (SOFT_NODE_CAP=400).
	 *  Resets to 0 on clearGraph/reset. */
	trimmedCount: Readable<number>;
	expandNode: (
		collection: string,
		key: string,
		opts?: GraphExpansionOptions
	) => Promise<GraphNode | null>;
	/**
	 * One-shot BFS expansion: pulls every node and edge within `depth` hops
	 * of the focal node in a single backend traversal, instead of firing N
	 * sequential `/api/nodes/{coll}/{key}` calls.
	 */
	expandNeighborhood: (
		collection: string,
		key: string,
		opts?: { depth?: number; cap?: number }
	) => Promise<GraphNode | null>;
	loadInstrument: (bwbId: string) => Promise<{ count: number } | null>;
	/** bwb_id of the wet currently rendered as a bulk wet-view (set by
	 *  loadInstrument, cleared by any non-wet load or reset). Lagen handlers
	 *  read this to decide between wet-scoped and global fetches. */
	currentInstrumentBwb: Readable<string | null>;
	/** Wet-scoped Arresten Lagen: fetch judgments that cite any article of
	 *  the current wet, add their nodes + edges. No-op when the wet's articles
	 *  aren't on canvas (caller checks currentInstrumentBwb first). */
	loadInstrumentJudgmentsLayer: (bwbId: string) => Promise<{ count: number } | null>;
	/** Wet-scoped Dossiers Lagen: kamerstukdossiers touching this wet + their
	 *  edges to the wet's articles. Adds publications as side payload. */
	loadInstrumentDossiersLayer: (bwbId: string) => Promise<{ count: number } | null>;
	/** Wet-scoped Wetten Lagen: instruments this wet refers to (or is
	 *  referred from), with aggregate edge counts. */
	loadInstrumentRelatedLayer: (bwbId: string) => Promise<{ count: number } | null>;
	/** Bulk citations for the current wet: every cross-reference + the
	 *  foreign nodes those refs point at. Pass `relations` to narrow the
	 *  fetch (e.g. `['REFERS_TO_ARTICLE']` for the "show me article-level
	 *  cross-wet references" use case from the Artikelen view). */
	loadInstrumentCitations: (
		bwbId: string,
		opts?: { relations?: string[] }
	) => Promise<{ count: number } | null>;
	/** Fire-and-forget count prefetch for the wet view: hits the 3 per-layer
	 *  endpoints with limit=1 and writes their `total` into the potential
	 *  counts store, so the sidebar's "+N" badge surfaces how many judgments /
	 *  dossiers / related wets are available before the user clicks. */
	prefetchInstrumentLayerCounts: (bwbId: string) => Promise<void>;
	loadGlobalGraph: () => Promise<{ count: number } | null>;
	loadInstrumentLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
	loadJudgmentLayerGraph: (opts?: {
		maxJudgments?: number;
		additive?: boolean;
	}) => Promise<{ count: number } | null>;
	loadLidGraph: (key: string) => Promise<{ count: number } | null>;
	loadFractieGraph: (key: string) => Promise<{ count: number } | null>;
	loadCommissiesLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
	loadLedenLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
	loadFractiesLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
	loadRecentDossiersGraph: (opts?: {
		days?: number;
		additive?: boolean;
	}) => Promise<{ count: number } | null>;
	setGraphMode: (mode: GraphMode) => void;
	seedGraph: (seed: GraphSeed) => void;
	setSelection: (nodeId: string | null, opts?: { recordHistory?: boolean }) => void;
	togglePin: (nodeId: string) => void;
	pinNode: (nodeId: string) => void;
	unpinNode: (nodeId: string) => void;
	focusNode: (nodeId: string, opts?: { recordHistory?: boolean }) => GraphNode | null;
	goBack: () => string | null;
	goForward: () => string | null;
	reset: () => void;
	setFilters: (updater: Partial<GraphFilters>) => void;
	getNodeById: (nodeId: string) => GraphNode | undefined;
	getNeighborsOf: (nodeId: string) => string[];
	/** Remove all nodes (and their incident edges) not in keepIds, then emit one update. */
	pruneNodes: (keepIds: Set<string>) => void;
	/** Drop every degree-0 node that isn't the focal selection or pinned. Run
	 *  this after any prune/merge that could leave nodes without incident
	 *  edges — FA2 with high repulsion otherwise flings orphans far from the
	 *  rest of the graph and the camera fit zooms out to include them. */
	sweepOrphans: () => void;
	/** Toggle whether synth instrument proxies are materialised. Caller (the
	 *  view) wires this to the Detail-niveau Artikelen/Wetten toggle so
	 *  proxies only exist in Wetten view, where they're visible. */
	setCollapseToLaws: (collapse: boolean) => void;
};

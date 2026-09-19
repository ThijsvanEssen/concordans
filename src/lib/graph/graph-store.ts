import { get, writable, type Readable } from 'svelte/store';
import { getGlobalGraph, getInstrumentArticles, getInstrumentCitations, getInstrumentDossiers, getInstrumentJudgments, getInstrumentRelatedInstruments, getNodeGraph, getInstrumentLayerGraph, getJudgmentLayerGraph, getNodeNeighborhood } from '$lib/api/nodes';
import type { GraphEdgeDTO, JudgmentGraphNodeDTO, NodeNeighborhoodResponse } from '$lib/api/types';
import { getArticleDetail } from '$lib/api/articles';
import { recordInstrument, ensureInstrumentMeta } from '$lib/api/instrument-cache';

import { perfStart } from '$lib/util/perf';
import { compareArticleNumbers } from '$lib/util/sort';
import type { BaseNode, NodeGraphResponse, Neighbor } from '$lib/api/types';
import { graphNodeId, nodeToGraphNode, detectNodeKind, classifyEdgeKind, SCAFFOLDING_RELATIONS, lidToGraphNode, fractieToGraphNode } from './types';
import type { GraphEdge, GraphNode, GraphSeed } from './types';
import { fetchDossierDocumentsBulk, fetchCommissie, fetchCommissies, fetchCommissiesWithLeden, fetchLid, fetchLeden, fetchFractie, fetchFracties, fetchRecentDossiers } from '$lib/api/parliamentary-client';

export type GraphFilters = {
  // Methode §iiib edge categories — three buckets, one toggle each.
  structuralEnabled: boolean;   // deel_van, behandeld_door, raakt …
  mutationEnabled: boolean;     // wijzigt, introduceert, trekt_in, licht_toe …
  semanticEnabled: boolean;     // verwijst_naar, citeert, noemt_artikel …
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
  neighborLimit: number;            // default 30
  showScaffolding: boolean;         // bypass SCAFFOLDING_RELATIONS filter
  convergenceMode: boolean;         // re-enable the level-1 + convergence prune
  dimStaleContext: boolean;         // canvas fades nodes outside focus level-1
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

const DEFAULT_FILTERS: GraphFilters = {
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
const SOFT_NODE_CAP = 400;

const DEFAULT_EXPANSION: Required<GraphExpansionOptions> = {
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
  loadJudgmentLayerGraph: (opts?: { maxJudgments?: number; additive?: boolean }) => Promise<{ count: number } | null>;
  loadLidGraph: (key: string) => Promise<{ count: number } | null>;
  loadFractieGraph: (key: string) => Promise<{ count: number } | null>;
  loadCommissiesLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
  loadLedenLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
  loadFractiesLayerGraph: (opts?: { additive?: boolean }) => Promise<{ count: number } | null>;
  loadRecentDossiersGraph: (opts?: { days?: number; additive?: boolean }) => Promise<{ count: number } | null>;
  setGraphMode: (mode: GraphMode) => void;
  seedGraph: (seed: GraphSeed) => void;
  setSelection: (nodeId: string | null, opts?: { recordHistory?: boolean }) => void;
  togglePin: (nodeId: string) => void;
  pinNode: (nodeId: string) => void;
  unpinNode: (nodeId: string) => void;
  focusNode: (
    nodeId: string,
    opts?: { recordHistory?: boolean }
  ) => GraphNode | null;
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

export function createGraphStore(): GraphStore {
  const nodes = new Map<string, GraphNode>();
  const edges = new Map<string, GraphEdge>();
  const cache = new Map<string, NodeGraphResponse>();
  const history: string[] = [];
  let historyIndex = -1;
  const pinned = new Set<string>();
  // Insertion sequence per node — drives the LRU trim. Reset on bulk loads.
  let seq = 0;
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
  let proxiesEnabled = false;
  const synthesizeDerivedNodes = () => {
    // Always drop existing proxies first — keeps a clean slate when the flag
    // flips off and when articles are pruned away.
    for (const id of [...nodes.keys()]) {
      if (id.startsWith(SYNTH_INSTRUMENT_PREFIX)) {
        nodes.delete(id);
        insertedAt.delete(id);
      }
    }
    if (!proxiesEnabled) return;

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
          props: { bwb_id: bwb, synth: true },
        },
      };
      nodes.set(id, proxy);
      insertedAt.set(id, ++seq);
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
        ...(response.neighbors.semantic ?? []),
      ];
      for (const n of all) {
        const id = graphNodeId(n.collection, n.key);
        if (presentIds.has(id)) continue;
        const kind = detectNodeKind(n);
        let set = seenPerKind.get(kind);
        if (!set) { set = new Set(); seenPerKind.set(kind, set); }
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
    const emit = (
      tag: string,
      source: string,
      target: string,
      label: string,
      relation: string,
    ) => {
      const id = `${SYNTH_PREFIX}${tag}:${source}->${target}`;
      if (edges.has(id)) return;
      edges.set(id, {
        id, source, target,
        kind: 'parliamentary',
        label, directed: true, relation,
      });
    };

    // ── A→Article→Instrument bridges ─────────────────────────────────────
    // dossier   → article → instrument  ⇒ "raakt wet"
    // judgment  → article → instrument  ⇒ "citeert wet"
    // tkstuk    → article → instrument  ⇒ "wijzigt wet"
    if (instrumentsByBwb.size > 0) {
      const BRIDGE_KINDS: Array<{
        kind: 'dossier' | 'judgment' | 'tkstuk';
        tag: string; label: string; relation: string;
      }> = [
        { kind: 'dossier',  tag: 'dossier-instrument',  label: 'raakt wet',    relation: 'raakt_wet' },
        { kind: 'judgment', tag: 'judgment-instrument', label: 'citeert wet',  relation: 'citeert_wet' },
        { kind: 'tkstuk',   tag: 'tkstuk-instrument',   label: 'wijzigt wet',  relation: 'wijzigt_wet' },
      ];
      for (const cfg of BRIDGE_KINDS) {
        for (const source of nodes.values()) {
          if (source.kind !== cfg.kind) continue;
          const reached = new Set<string>();
          for (const e of edges.values()) {
            const otherId = e.source === source.id ? e.target
              : e.target === source.id ? e.source : null;
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
    const start = Math.max(0, historyIndex - 4);
    const slice = history.slice(start, historyIndex + 1);
    const crumbs = slice
      .map((id) => nodes.get(id))
      .filter((node): node is GraphNode => Boolean(node));
    breadcrumbsStore.set(crumbs);
    canGoBackStore.set(historyIndex > 0);
    canGoForwardStore.set(historyIndex < history.length - 1);
  };

  const recordHistory = (nodeId: string) => {
    if (historyIndex < history.length - 1) {
      history.splice(historyIndex + 1);
    }
    history.push(nodeId);
    historyIndex = history.length - 1;
    canGoBackStore.set(historyIndex > 0);
    canGoForwardStore.set(false);
    updateBreadcrumbs();
  };

  const clearGraph = () => {
    nodes.clear();
    edges.clear();
    cache.clear();
    insertedAt.clear();
    seq = 0;
    history.length = 0;
    historyIndex = -1;
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
    if (!nodes.has(id)) insertedAt.set(id, ++seq);
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
      seq = 0;
      history.length = 0;
      historyIndex = -1;
      // Any non-additive bulk load is, by definition, no longer a wet view.
      // (loadInstrument re-sets this flag after its own clear.)
      currentInstrumentBwbStore.set(null);
      clearWetLayerTotals();
    }
  };

  // Each additive layer load lands in its own region around the existing
  // graph. We rotate through angles so consecutive loads stack at 60° apart
  // instead of all piling up to the right.
  let additiveLayerIndex = 0;
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
    const angle = (additiveLayerIndex++ * (Math.PI / 3)) + Math.PI / 4;
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
      ...(response.neighbors.semantic ?? []),
    ];

    const neighborEntries = allNeighbors
      .filter((neighbor) => f.showScaffolding || !SCAFFOLDING_RELATIONS.has(neighbor.relation ?? ''))
      .map((neighbor) => ({
        neighbor,
        kind: classifyEdgeKind(
          neighbor.relation,
          centerNode.kind,
          neighbor.collection === 'judgments' ? 'judgment' : undefined,
        )
      }));

    const eligible = opts.outboundOnly
      ? neighborEntries.filter((e) => e.neighbor.direction === 'outbound')
      : neighborEntries;

    const pinnedNeighbors = eligible.filter((entry) =>
      pinned.has(graphNodeId(entry.neighbor.collection, entry.neighbor.key))
    );
    const nonPinnedNeighbors = eligible.filter(
      (entry) =>
        !pinned.has(graphNodeId(entry.neighbor.collection, entry.neighbor.key))
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
      const neighborMeta = (entry.neighbor as { meta?: Record<string, unknown> | null }).meta ?? null;

      edges.set(edgeId, {
        id: edgeId,
        source,
        target,
        kind: entry.kind,
        label,
        directed: true,
        confidence: entry.neighbor.confidence,
        relation: rel,
        meta: neighborMeta,
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

  const instance: GraphStore = {
    nodes: nodesStore,
    edges: edgesStore,
    selection: selectionStore,
    pinned: pinnedStore,
    breadcrumbs: breadcrumbsStore,
    canGoBack: canGoBackStore,
    canGoForward: canGoForwardStore,
    filters: filtersStore,
    loading: loadingStore,
    graphMode: graphModeStore,
    potentialCounts: potentialCountsStore,
    trimmedCount: trimmedCountStore,
    currentInstrumentBwb: currentInstrumentBwbStore,
    expandNode: async (collection, key, opts = {}) => {
      const f = get(filtersStore);
      const normalizedOpts = {
        ...DEFAULT_EXPANSION,
        neighborLimit: f.neighborLimit ?? DEFAULT_EXPANSION.neighborLimit,
        semanticConfidenceThreshold: f.semanticThreshold ?? DEFAULT_EXPANSION.semanticConfidenceThreshold,
        ...opts,
      };
      const nodeId = graphNodeId(collection, key);
      if (!normalizedOpts.force && cache.has(nodeId)) {
        const cachedResponse = cache.get(nodeId);
        if (cachedResponse) {
          mergeResponse(cachedResponse, normalizedOpts);
          return nodes.get(nodeId) ?? null;
        }
      }
      const response = await getNodeGraph(collection, key, {
        neighborLimit: normalizedOpts.neighborLimit,
      });
      cache.set(nodeId, response);
      mergeResponse(response, normalizedOpts);
      // The API may normalise the key (e.g. lowercase), so look up by the
      // actual id returned in the response rather than the caller-supplied one.
      const actualId = graphNodeId(response.node.collection, response.node.key);
      return nodes.get(actualId) ?? nodes.get(nodeId) ?? null;
    },
    expandNeighborhood: async (collection, key, opts = {}) => {
      const f = get(filtersStore);
      const resp: NodeNeighborhoodResponse = await getNodeNeighborhood(collection, key, {
        depth: opts.depth ?? 3,
        cap: opts.cap ?? 200,
      });

      // Pass 1: register every discovered node. Instruments stay
      // metadata-only (they're rendered as clusters, not nodes); seed the
      // instrument cache so cluster labels resolve.
      const nodeById = new Map<string, BaseNode>();
      for (const n of resp.nodes) {
        nodeById.set(n.id, n);
        if (detectNodeKind(n) === 'instrument') {
          const p = (n.props ?? {}) as Record<string, unknown>;
          recordInstrument({
            key: n.key,
            bwb_id: (p['bwb_id'] as string | null) ?? null,
            display_name: n.display_name,
            title: (p['title'] as string | null) ?? null,
            citation_title: (p['citation_title'] as string | null) ?? null,
            short_title: (p['short_title'] as string | null) ?? null,
          });
          continue;
        }
        const gn = nodeToGraphNode(n);
        touchNode(gn.id, gn);

        // Seed instrument cache from article display names — same as
        // mergeResponse(), so article hover labels still resolve.
        if (n.collection === 'instrument_articles') {
          const np = (n.props ?? {}) as Record<string, unknown>;
          const bwb = (np['bwb_id'] as string | null) ?? null;
          const dn = n.display_name ?? '';
          const m = dn.match(/^Artikel\s+\S+\s+(.+?)\.?\s*$/);
          if (bwb && m) {
            recordInstrument({ bwb_id: bwb, short_title: m[1] });
            ensureInstrumentMeta(bwb);
          }
        }
      }

      // Pass 2: register edges between known nodes. Skip edges whose
      // endpoint is an instrument (cluster) — they're modelled visually.
      for (const e of resp.edges) {
        const rel = e.relation ?? '';
        if (!f.showScaffolding && SCAFFOLDING_RELATIONS.has(rel)) continue;
        const srcNode = nodeById.get(e.source);
        const tgtNode = nodeById.get(e.target);
        if (!srcNode || !tgtNode) continue;
        if (
          detectNodeKind(srcNode) === 'instrument'
          || detectNodeKind(tgtNode) === 'instrument'
        ) {
          continue;
        }
        const sourceId = graphNodeId(srcNode.collection, srcNode.key);
        const targetId = graphNodeId(tgtNode.collection, tgtNode.key);
        const targetKind = detectNodeKind(tgtNode);
        const sourceKind = detectNodeKind(srcNode);
        const kind = classifyEdgeKind(
          rel,
          sourceKind,
          targetKind === 'judgment' ? 'judgment' : undefined,
        );
        if (
          kind === 'citation'
          && e.confidence != null
          && e.confidence < (f.semanticThreshold ?? 0)
        ) {
          continue;
        }
        const edgeId = `${sourceId}->${targetId}:${rel || kind}`;
        edges.set(edgeId, {
          id: edgeId,
          source: sourceId,
          target: targetId,
          kind,
          label: rel || kind,
          directed: true,
          confidence: e.confidence,
          relation: rel || null,
          meta: null,
        });
      }

      // Publish the BFS payload to subscribers. Without this the convergence
      // walk in expandWithConvergencePaths reads a stale `get(store.edges)`
      // and can't find any deeper paths — every BFS hop past the initial
      // expandNode would be invisible to the keep-set computation.
      updateNodes();
      updateEdges();

      // Return the focal node so callers can chain (set selection etc.).
      const focal = nodeById.get(resp.focal_id);
      if (!focal) return null;
      const focalId = graphNodeId(focal.collection, focal.key);
      return nodes.get(focalId) ?? null;
    },
    loadInstrument: async (bwbId) => {
      const endTotal = perfStart(`loadInstrument(${bwbId}) total`);
      loadingStore.set({ kind: 'instrument', bwbId, phase: 'fetching' });
      try {
        const endFetch = perfStart(`loadInstrument fetch`);
        // `/api/instruments/{bwb}/articles` is the list endpoint the backend
        // added for exactly this case — the generic `/api/nodes/instruments/{key}`
        // surface omits PART_OF_INSTRUMENT children, and `/api/graph/instruments`
        // only ships instrument hubs. Adapt the list response into the shape
        // the rest of this function already expects so the structural layout
        // code stays put. Use the bulk limit so we get the full wet — the
        // breadcrumb-cluster layout assumes the complete article set.
        const articleListResp = await getInstrumentArticles(bwbId, {
          includeStubs: false,
          textPreviewChars: 0,
          limit: 2000,
        });
        const resp = {
          instrument: {
            id: '',
            key: bwbId,
            bwb_id: articleListResp.bwb_id,
            display_name: null as string | null,
            shorthand: null,
            title: null as string | null,
            citation_title: null as string | null,
            jurisdiction: null as 'NL' | 'EU' | null,
            geldig_vanaf: null as string | null,
          },
          citation_title: null as string | null,
          articles: articleListResp.items.map((a) => ({
            id: a.id,
            key: a.key,
            bwb_id: a.bwb_id,
            article_number: a.article_number,
            display_name: a.display_name,
            shorthand: null,
            text: null as string | null,
            jurisdiction: null as 'NL' | 'EU' | null,
            geldig_vanaf: null as string | null,
            breadcrumb: a.breadcrumb ?? null,
            stub: a.stub,
          })),
          // The /articles endpoint returns articles only — no judgments and
          // no inter-article edges. Judgments expand on-demand when the user
          // clicks an individual article (generic /api/nodes path picks up
          // citations from there).
          judgments: [] as JudgmentGraphNodeDTO[],
          edges: [] as GraphEdgeDTO[],
          metadata: null,
        };
        endFetch(`${resp.articles.length} of ${articleListResp.total} articles`);
        // Defensive: don't wipe the existing canvas when the response carries
        // nothing to render. Callers (handleNodeClick) treat a null return as
        // "fall through to generic expansion", which needs the prior canvas
        // intact to make sense.
        if (resp.articles.length === 0) {
          console.warn(`[graph-store] loadInstrument(${bwbId}): backend returned 0 articles — canvas preserved`);
          return null;
        }
        recordInstrument({
          ...resp.instrument,
          citation_title: resp.citation_title ?? resp.instrument.citation_title ?? null
        });
        loadingStore.set({ kind: 'instrument', bwbId, phase: 'building' });

        // Background fetch: pull a single article so the bibtex shorttitle
        // (e.g. "Sr") lands in the instrument cache. Article labels in the
        // graph and hover panel will show the abbreviation as soon as it
        // resolves — they refresh reactively via the cache subscription.
        const sampleArticle = resp.articles.find((a) => a.bwb_id === bwbId && a.article_number);
        if (sampleArticle?.bwb_id && sampleArticle?.article_number) {
          void getArticleDetail(sampleArticle.bwb_id, sampleArticle.article_number)
            .then((d) => {
              // citation_formats was removed from the API; fall back to metadata if present.
              const meta = d.metadata as Record<string, unknown> | null | undefined;
              const bibtex = meta?.['bibtex'] as string | undefined;
              if (!bibtex) return;
              const shortMatch = bibtex.match(/shorttitle\s*=\s*\{([^}]+)\}/);
              const lawMatch = bibtex.match(/\blaw\s*=\s*\{([^}]+)\}/);
              recordInstrument({
                bwb_id: bwbId,
                short_title: shortMatch?.[1] ?? null,
                citation_title: lawMatch?.[1] ?? null,
                title: lawMatch?.[1] ?? null
              });
            })
            .catch(() => { /* non-fatal */ });
        }
        const endBuild = perfStart(`loadInstrument build`);

        const articlesById = new Map<string, typeof resp.articles[number]>();
        for (const a of resp.articles) {
          if (!articlesById.has(a.id)) articlesById.set(a.id, a);
        }
        const judgmentsById = new Map<string, typeof resp.judgments[number]>();
        for (const j of resp.judgments) {
          if (!judgmentsById.has(j.id)) judgmentsById.set(j.id, j);
        }

        // Structural layout. Cluster articles by breadcrumb top level
        // (boek/titel/etc.) so each major partition of the wet gets its own
        // arc on the outer ring; within a cluster articles sit on a small
        // inner ring sorted by article_number, so citations become readable
        // chords across the canvas. When breadcrumbs are absent (older
        // imports, mixed-wet payloads), fall back to grouping by bwb_id so
        // we still produce *some* partition rather than one giant disc.
        const articleList = [...articlesById.values()];
        articleList.sort((a, b) => compareArticleNumbers(a.article_number, b.article_number));

        const positions = new Map<string, { x: number; y: number }>();

        const groups = new Map<string, typeof articleList>();
        for (const a of articleList) {
          const bc = a.breadcrumb;
          const groupKey = (bc && bc.length > 0 ? bc[0].label : null) ?? a.bwb_id ?? 'unknown';
          let arr = groups.get(groupKey);
          if (!arr) { arr = []; groups.set(groupKey, arr); }
          arr.push(a);
        }
        // Largest boek first so it claims the top-of-ring position. (Articles
        // within each group are already in article_number order because
        // articleList was pre-sorted before insertion.)
        const groupsSorted = [...groups.entries()].sort(([, a], [, b]) => b.length - a.length);

        // Scale the outer ring to the total article count so big wets (Sv has
        // ~810 articles spread over a few boeken of ~270 each) don't pack
        // their per-boek inner rings on top of one another. Inner radius also
        // scales — sqrt(N) growth keeps dense boeken from blowing up linearly.
        const total = Math.max(articleList.length, 1);
        const ringR = Math.max(240, Math.sqrt(total) * 14);

        // Sunflower / Fibonacci spiral packing for the per-boek interiors.
        // Earlier version placed members on a single ring (cos*r, sin*r);
        // for a boek with hundreds of articles (Sr Boek II has ~470) that
        // produced a hollow donut outline rather than a packed cluster.
        // Spiral packing fills the disc evenly: each member i at
        // angle = i*golden + start, radius = spacing*sqrt(i).
        const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
        groupsSorted.forEach(([, members], li) => {
          const totalArc = (members.length / total) * Math.PI * 2;
          const startAngle = groupsSorted
            .slice(0, li)
            .reduce((acc, [, m]) => acc + (m.length / total) * Math.PI * 2, 0)
            - Math.PI / 2;

          const cAngle = startAngle + totalArc / 2;
          const cx = Math.cos(cAngle) * ringR;
          const cy = Math.sin(cAngle) * ringR;
          const outerInnerR = 12 + Math.sqrt(members.length) * 3.5;
          const spacing = outerInnerR / Math.max(Math.sqrt(members.length), 1);

          members.forEach((a, mi) => {
            const r = spacing * Math.sqrt(mi);
            const ang2 = mi * GOLDEN_ANGLE;
            positions.set(a.id, {
              x: cx + Math.cos(ang2) * r,
              y: cy + Math.sin(ang2) * r
            });
          });
        });

        // Judgments live on a smaller inner ring so they're visibly distinct
        // from articles and don't fight the structural article layout.
        const judgmentList = [...judgmentsById.values()];
        const J = Math.max(judgmentList.length, 1);
        const judgmentR = 55;
        judgmentList.forEach((j, i) => {
          const angle = (i / J) * Math.PI * 2 + Math.PI / 4;
          positions.set(j.id, {
            x: Math.cos(angle) * judgmentR,
            y: Math.sin(angle) * judgmentR
          });
        });

        // Bulk commit: write the internal Maps directly (bypassing
        // addNode/addEdge so we don't fire 535+952 store updates), then emit
        // exactly one nodes-set + one edges-set notification at the end.
        // This drops the build phase from O(N²) (~7s) to O(N+E) (~50ms).
        const endStage = perfStart('  loadInstrument: stage');
        nodes.clear();
        edges.clear();
        cache.clear();
        history.length = 0;
        historyIndex = -1;
        // Mark canvas as wet-scoped so the Lagen handlers route to the
        // wet-specific endpoints instead of global Lagen graphs.
        currentInstrumentBwbStore.set(bwbId);
        console.log(`[graph-store] currentInstrumentBwb set → ${bwbId}`);

        for (const a of articlesById.values()) {
          const node = nodeToGraphNode({
            id: a.id,
            key: a.key,
            collection: 'instrument_articles',
            type: 'instrument_article',
            display_name: a.display_name,
            labels: ['Artikel'],
            props: {
              bwb_id: a.bwb_id,
              // EU articles have no bwb_id; derive celex from key so ArticleReader
              // can fall back to it when loading article detail.
              celex: !a.bwb_id && a.article_number && a.key.endsWith('_' + a.article_number)
                ? a.key.slice(0, -(a.article_number.length + 1))
                : null,
              article_number: a.article_number,
              valid_from: a.geldig_vanaf,
              breadcrumb: a.breadcrumb,
              stub: a.stub ?? false
            }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(a.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(a.id)?.y;
          nodes.set(node.id, node);
        }

        for (const j of judgmentsById.values()) {
          const node = nodeToGraphNode({
            id: j.id,
            key: j.key,
            collection: 'judgments',
            type: 'judgment',
            display_name: j.shorthand ?? j.display_name ?? j.ecli ?? 'Uitspraak',
            labels: ['Arrest'],
            props: { ecli: j.ecli, stub: j.stub ?? false }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(j.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(j.id)?.y;
          nodes.set(node.id, node);
        }

        for (const e of resp.edges) {
          if (!nodes.has(e.from_id) || !nodes.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'verwijst_naar';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          edges.set(id, {
            id,
            source: e.from_id,
            target: e.to_id,
            kind: classifyEdgeKind(rel, nodes.get(e.from_id)?.kind, nodes.get(e.to_id)?.kind),
            label: rel.replace(/_/g, ' '),
            directed: true,
            confidence: e.confidence ?? null,
            relation: rel
          });
        }
        endStage(`${nodes.size} nodes, ${edges.size} edges staged`);

        const endCommit = perfStart('  loadInstrument: commit (sync to GraphView)');
        selectionStore.set(null);
        breadcrumbsStore.set([]);
        graphModeStore.set('bulk');
        updateNodes();   // single fan-out of nodes to subscribers
        updateEdges();   // single fan-out of edges
        endCommit();

        endBuild(`${nodes.size} nodes, ${edges.size} edges in graph`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadInstrument failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },

    // ── Wet-scoped Lagen loaders ─────────────────────────────────────────
    // Each fetches one slice of the wet's citation graph and merges it into
    // the existing wet canvas additively. None of them clear or replace —
    // they enrich whatever loadInstrument already put down. The Lagen
    // handlers in the route route to these when currentInstrumentBwb is set.

    prefetchInstrumentLayerCounts: async (bwbId) => {
      // Fire-and-forget: three parallel calls with limit=1, only the `total`
      // field is needed. Writes into wetLayerTotals (merged into
      // potentialCountsStore by recomputePotentialCounts) so the sidebar's
      // "+N" badge surfaces the availability before the user clicks.
      try {
        const [judgments, dossiers, related] = await Promise.all([
          getInstrumentJudgments(bwbId, { limit: 1 }).catch(() => null),
          getInstrumentDossiers(bwbId, { limit: 1 }).catch(() => null),
          getInstrumentRelatedInstruments(bwbId, { limit: 1 }).catch(() => null),
        ]);
        if (judgments) wetLayerTotals['judgment'] = judgments.total;
        if (dossiers) wetLayerTotals['dossier'] = dossiers.total;
        if (related) wetLayerTotals['instrument'] = related.total;
        console.log(`[graph-store] prefetchInstrumentLayerCounts(${bwbId}): judgments=${judgments?.total ?? '?'} dossiers=${dossiers?.total ?? '?'} related=${related?.total ?? '?'}`);
        recomputePotentialCounts();
      } catch (err) {
        console.warn('[graph-store] prefetchInstrumentLayerCounts failed:', err);
      }
    },


    loadInstrumentJudgmentsLayer: async (bwbId) => {
      const endTotal = perfStart(`loadInstrumentJudgmentsLayer(${bwbId})`);
      try {
        const resp = await getInstrumentJudgments(bwbId, { limit: 1000 });
        const seqBefore = seq;
        let added = 0;
        let edgesAdded = 0;
        for (const j of resp.items) {
          const id = j.id;
          if (!nodes.has(id)) {
            const node = nodeToGraphNode({
              id, key: j.key, collection: 'judgments', type: 'judgment',
              display_name: j.display_name ?? j.ecli ?? 'Uitspraak',
              labels: ['Arrest'],
              props: { ecli: j.ecli ?? null, stub: j.stub ?? false },
            });
            touchNode(id, node);
            added++;
          }
          // Each cited article gets an edge judgment → article. The article
          // must already be on canvas (loaded by loadInstrument); if it
          // isn't, skip — we don't fetch foreign articles here.
          for (const a of j.cited_articles ?? []) {
            if (!nodes.has(a.id)) continue;
            const eId = `${j.id}->${a.id}:citeert`;
            if (!edges.has(eId)) {
              edges.set(eId, {
                id: eId, source: j.id, target: a.id, kind: 'citation',
                label: 'citeert', directed: true, confidence: null, relation: 'citeert',
              });
              edgesAdded++;
            }
          }
        }
        if (added > 0) placeAdditiveLayer(seqBefore);
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentJudgmentsLayer(${bwbId}): +${added} judgments, +${edgesAdded} edges (${resp.total} available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentJudgmentsLayer failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },

    loadInstrumentDossiersLayer: async (bwbId) => {
      const endTotal = perfStart(`loadInstrumentDossiersLayer(${bwbId})`);
      try {
        const resp = await getInstrumentDossiers(bwbId, { limit: 500 });
        // Shape probe — drop once the dossier item contract is verified
        // (specifically: does each item carry a `publications` array, and
        // if so, what fields + article references does it ship?).
        if (resp.items && resp.items.length > 0) {
          const sample = resp.items[0];
          console.log('[shape-probe] dossier item keys=', Object.keys(sample),
            ' touched_articles[0]=', (sample.touched_articles ?? [])[0] ?? null,
            ' publications[0]=', (sample.publications ?? [])[0] ?? null);
        }
        const seqBefore = seq;
        let added = 0;
        for (const d of resp.items) {
          if (!nodes.has(d.id)) {
            const node = nodeToGraphNode({
              id: d.id, key: d.key, collection: 'kamerstukdossiers', type: 'dossier',
              display_name: d.titel ?? d.kamerstuknummer ?? d.key,
              labels: ['Dossier'],
              props: {
                kamerstuknummer: d.kamerstuknummer ?? null,
                titel: d.titel ?? null,
                huidige_fase: d.huidige_fase ?? null,
              },
            });
            touchNode(d.id, node);
            added++;
          }
          // dossier → article edges (RAAKT / derived). Aligned with the
          // judgments endpoint's `{id, key, …}` convention.
          for (const a of d.touched_articles ?? []) {
            if (!nodes.has(a.id)) continue;
            const eId = `${d.id}->${a.id}:raakt`;
            if (!edges.has(eId)) {
              edges.set(eId, {
                id: eId, source: d.id, target: a.id, kind: 'parliamentary',
                label: 'raakt', directed: true, confidence: null, relation: 'raakt',
              });
            }
          }
          // Surface publications under the dossier if the backend supplied them.
          for (const p of d.publications ?? []) {
            if (!nodes.has(p.id)) {
              const pNode = nodeToGraphNode({
                id: p.id, key: p.key, collection: 'publications', type: 'publication',
                display_name: p.titel ?? p.soort ?? p.key,
                labels: ['Publicatie'],
                props: { soort: p.soort ?? null, titel: p.titel ?? null },
              });
              touchNode(p.id, pNode);
              added++;
            }
            const eId = `${d.id}->${p.id}:bevat`;
            if (!edges.has(eId)) {
              edges.set(eId, {
                id: eId, source: d.id, target: p.id, kind: 'parliamentary',
                label: 'bevat', directed: true, confidence: null, relation: 'bevat',
              });
            }
          }
        }
        if (added > 0) placeAdditiveLayer(seqBefore);
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentDossiersLayer(${bwbId}): +${added} nodes (${resp.total} dossiers available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentDossiersLayer failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },

    loadInstrumentRelatedLayer: async (bwbId) => {
      const endTotal = perfStart(`loadInstrumentRelatedLayer(${bwbId})`);
      try {
        const resp = await getInstrumentRelatedInstruments(bwbId, { limit: 200 });
        const seqBefore = seq;
        let added = 0;
        for (const r of resp.items) {
          if (!nodes.has(r.id)) {
            const node = nodeToGraphNode({
              id: r.id, key: r.key, collection: 'instruments', type: 'instrument',
              display_name: r.citation_title ?? r.display_name ?? r.key,
              labels: ['Wet'],
              props: {
                bwb_id: r.bwb_id,
                citation_title: r.citation_title ?? null,
              },
            });
            touchNode(r.id, node);
            added++;
          }
          // No per-article edges available at this aggregation layer — only
          // counts. Surface them in node props for the hover panel; the
          // sidebar can also show outbound/inbound on click.
          const existing = nodes.get(r.id);
          if (existing && existing.raw) {
            const p = (existing.raw.props ?? {}) as Record<string, unknown>;
            p['outbound_count'] = r.outbound_count;
            p['inbound_count'] = r.inbound_count;
            existing.raw.props = p;
          }
        }
        if (added > 0) placeAdditiveLayer(seqBefore);
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentRelatedLayer(${bwbId}): +${added} related wets (${resp.total} available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentRelatedLayer failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },

    loadInstrumentCitations: async (bwbId, opts) => {
      const endTotal = perfStart(`loadInstrumentCitations(${bwbId})`);
      try {
        const resp = await getInstrumentCitations(bwbId, {
          maxEdges: 20000,
          relations: opts?.relations,
        });
        let added = 0;
        // 1. Materialise foreign nodes from the side payload, indexed by id.
        //    Every side-payload node carries its fields under `.props` — the
        //    backend serializes them inside an envelope (probed live; the
        //    spec docs claimed a flat shape but actual delivery is wrapped).
        const foreignArticles = resp.nodes.instrument_articles ?? [];
        // 1a. Cluster foreign articles by bwb so they land in tidy
        //     per-wet groups on an outer ring instead of being dumped wherever
        //     FA2 first happens to place them.
        const foreignByBwb = new Map<string, typeof foreignArticles>();
        for (const a of foreignArticles) {
          const k = a.props.bwb_id ?? a.props.celex ?? 'unknown';
          let arr = foreignByBwb.get(k);
          if (!arr) { arr = []; foreignByBwb.set(k, arr); }
          arr.push(a);
        }
        const foreignPositions = new Map<string, { x: number; y: number }>();
        const totalForeign = foreignArticles.length;
        if (totalForeign > 0) {
          // Foreign wets sit on a ring around the focal wet, one disc per
          // wet, sized by article count. The data is long-tail (live: ~175
          // wets, of which ~150 contribute 1–4 articles), so two decisions
          // shape the layout:
          //
          //   • Long-tail wets (< BIG_THRESHOLD articles) are dropped from
          //     the canvas. Materialising 150 tiny clusters costs a ring of
          //     real-estate without producing readable structure — the
          //     article-per-wet signal lives in the Index tab. We keep only
          //     the wets that carry a recognisable citation pattern.
          //
          //   • Big-wet discs get their own angular slot on a ring sized to
          //     the disc, with explicit gaps between discs. The earlier
          //     version allocated arcs proportional to article count on a
          //     fixed-radius ring, which guaranteed adjacent discs touched
          //     and squashed small big-wets into slivers. Sizing the arc
          //     from the disc diameter (plus a fixed gap) ensures every wet
          //     reads as a separate cluster regardless of count.
          const BIG_THRESHOLD = 5;
          const DISC_GAP = 80;       // px between adjacent discs on the ring
          const FOCAL_MARGIN = 140;  // px of breathing room outside focal articles
          const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

          const sortedWets = [...foreignByBwb.entries()].sort(
            ([, a], [, b]) => b.length - a.length
          );
          const bigWets = sortedWets.filter(([, m]) => m.length >= BIG_THRESHOLD);

          // Measure the outermost focal-article position so the foreign
          // ring sits clearly outside it. Read from current article nodes
          // (the focal wet was loaded by a previous step); fall back to a
          // sane default when nothing's on canvas yet.
          let focalExtent = 0;
          for (const [, n] of nodes) {
            if (n.kind !== 'article') continue;
            const nn = n as GraphNode & { x?: number; y?: number };
            if (typeof nn.x === 'number' && typeof nn.y === 'number') {
              const d = Math.hypot(nn.x, nn.y);
              if (d > focalExtent) focalExtent = d;
            }
          }
          if (focalExtent === 0) focalExtent = 500;

          // Disc radius scales with √N. The constant (×9) is much larger
          // than the old packing's effective radius (~50 px for a
          // 130-article wet) — large enough that each wet reads as a blob
          // rather than a speck.
          const discs = bigWets.map(([, members]) => ({
            members,
            r: Math.max(34, Math.sqrt(members.length) * 9),
          }));

          // Pick ring radius so the ring's circumference accommodates every
          // disc's diameter plus the minimum gap. Also enforce a minimum
          // that clears the focal cluster. If the focal-clearance minimum
          // gives us *more* circumference than we need, the surplus gets
          // redistributed below as extra inter-disc gap so discs stay
          // spread evenly around 2π instead of bunching at the top.
          const minNeeded = discs.reduce((s, d) => s + 2 * d.r + DISC_GAP, 0);
          const maxDiscR = discs.reduce((m, d) => Math.max(m, d.r), 0);
          const ringR = Math.max(
            focalExtent + FOCAL_MARGIN + maxDiscR,
            minNeeded / (2 * Math.PI)
          );

          // Surplus circumference (zero if ring is sized exactly to fit)
          // distributed equally across discs so adjacent gaps are uniform.
          const sumDiameter = discs.reduce((s, d) => s + 2 * d.r, 0);
          const surplus = 2 * Math.PI * ringR - sumDiameter;
          const perDiscGap = discs.length > 0 ? surplus / discs.length : 0;

          // Place largest discs first, starting at top (-π/2) and going
          // clockwise. Each disc's arc = its own diameter + the equal share
          // of remaining circumference; arcs therefore sum to exactly 2π
          // and discs sit at evenly spaced angular positions, regardless of
          // whether the ring is large or small relative to disc count.
          let accAngle = -Math.PI / 2;
          for (const d of discs) {
            const arc = (2 * d.r + perDiscGap) / ringR;
            const centerAngle = accAngle + arc / 2;
            const cx = Math.cos(centerAngle) * ringR;
            const cy = Math.sin(centerAngle) * ringR;
            // Sunflower-pack the wet's articles inside its disc. Spacing
            // chosen so the outermost member sits at ~d.r.
            const spacing = d.r / Math.max(Math.sqrt(d.members.length), 1);
            d.members.forEach((a, mi) => {
              const rr = spacing * Math.sqrt(mi);
              const ang = mi * GOLDEN_ANGLE;
              foreignPositions.set(a.id, {
                x: cx + Math.cos(ang) * rr,
                y: cy + Math.sin(ang) * rr,
              });
            });
            accAngle += arc;
          }
        }
        // 1b. Touch the foreign article nodes with seeded positions and feed
        //     short_title into the instrument cache so nodeLabel can render
        //     "Art. 68 Sv" instead of bare "Art. 68".
        //     Articles from long-tail wets (no entry in foreignPositions)
        //     are skipped entirely — see the BIG_THRESHOLD comment above.
        //     Edges to those articles drop out automatically at the edge
        //     loop below because their endpoints aren't on canvas. We do
        //     still feed their short_title into the instrument cache so
        //     references via the instrument node (if any) read correctly.
        for (const a of foreignArticles) {
          const p = a.props;
          if (p.bwb_id && p.short_title) {
            recordInstrument({ bwb_id: p.bwb_id, short_title: p.short_title });
          }
          const pos = foreignPositions.get(a.id);
          // No position → long-tail wet, dropped from canvas. If the node
          // happens to be already on canvas (loadInstrument's articles
          // endpoint emits cross-wet references), leave it alone; the next
          // step's foreign-position logic owns the layout for big-wet
          // articles.
          if (!pos) continue;
          const existing = nodes.get(a.id);
          if (existing) {
            // Override the focal layout's position with the foreign-disc
            // position. Without this, foreign articles emitted by the
            // /instruments/{bwb}/articles endpoint keep the per-bwb arc
            // they got on the focal ring — exactly the bug the new layout
            // is trying to fix.
            (existing as GraphNode & { x?: number; y?: number }).x = pos.x;
            (existing as GraphNode & { x?: number; y?: number }).y = pos.y;
            touchNode(a.id, existing);
            continue;
          }
          const node = nodeToGraphNode({
            id: a.id, key: a.key, collection: 'instrument_articles', type: 'instrument_article',
            display_name: p.display_name ?? (p.article_number ? `Art. ${p.article_number}` : a.key),
            labels: ['Artikel'],
            props: {
              bwb_id: p.bwb_id,
              celex: p.celex,
              article_number: p.article_number,
              stub: p.stub,
            },
          });
          (node as GraphNode & { x?: number; y?: number }).x = pos.x;
          (node as GraphNode & { x?: number; y?: number }).y = pos.y;
          touchNode(a.id, node);
          added++;
        }
        for (const j of resp.nodes.judgments ?? []) {
          if (nodes.has(j.id)) continue;
          const p = j.props;
          touchNode(j.id, nodeToGraphNode({
            id: j.id, key: j.key, collection: 'judgments', type: 'judgment',
            display_name: p.display_name ?? p.ecli ?? 'Uitspraak',
            labels: ['Arrest'],
            props: { ecli: p.ecli ?? null },
          }));
          added++;
        }
        for (const pub of resp.nodes.publications ?? []) {
          if (nodes.has(pub.id)) continue;
          const p = pub.props;
          touchNode(pub.id, nodeToGraphNode({
            id: pub.id, key: pub.key, collection: 'publications', type: 'publication',
            display_name: p.display_name ?? p.titel ?? p.title ?? p.soort ?? pub.key,
            labels: ['Publicatie'],
            props: {
              soort: p.soort ?? null,
              titel: p.titel ?? p.title ?? null,
              datum: p.datum ?? null,
              volgnummer: p.volgnummer ?? null,
              dossier_nummer: p.dossier_nummer ?? null,
              tk_url: p.tk_url ?? null,
            },
          }));
          added++;
        }
        for (const d of resp.nodes.kamerstukdossiers ?? []) {
          if (nodes.has(d.id)) continue;
          const p = d.props;
          touchNode(d.id, nodeToGraphNode({
            id: d.id, key: d.key, collection: 'kamerstukdossiers', type: 'dossier',
            display_name: p.display_name ?? p.titel ?? p.kamerstuknummer ?? d.key,
            labels: ['Dossier'],
            props: {
              kamerstuknummer: p.kamerstuknummer ?? null,
              titel: p.titel ?? null,
              huidige_fase: p.huidige_fase ?? null,
            },
          }));
          added++;
        }
        for (const inst of resp.nodes.instruments ?? []) {
          const p = inst.props;
          // Feed the metadata cache so foreign articles' nodeLabel lookup
          // (instrumentMetaStore.get(bwb_id)) finds the citation_title even
          // when the article's own short_title was null.
          if (p.bwb_id) {
            recordInstrument({
              bwb_id: p.bwb_id,
              citation_title: p.citation_title ?? null,
            });
          }
          if (nodes.has(inst.id)) continue;
          touchNode(inst.id, nodeToGraphNode({
            id: inst.id, key: inst.key, collection: 'instruments', type: 'instrument',
            display_name: p.display_name ?? p.citation_title ?? inst.key,
            labels: ['Wet'],
            props: { bwb_id: p.bwb_id, citation_title: p.citation_title ?? null },
          }));
          added++;
        }
        // 2. Edges. Skip any whose endpoints aren't on canvas (defensive —
        //    shouldn't happen with the side payload, but cheap insurance).
        let addedEdges = 0;
        for (const e of resp.edges) {
          if (!nodes.has(e.from) || !nodes.has(e.to)) continue;
          const rel = e.relation;
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const eId = `${e.from}->${e.to}:${rel}`;
          if (edges.has(eId)) continue;
          edges.set(eId, {
            id: eId, source: e.from, target: e.to,
            kind: classifyEdgeKind(rel, nodes.get(e.from)?.kind, nodes.get(e.to)?.kind),
            label: rel.replace(/_/g, ' '), directed: true, confidence: null, relation: rel,
            meta: e.meta as Record<string, unknown> | null | undefined ?? null,
          });
          addedEdges++;
        }
        // No placeAdditiveLayer here. The foreign-article positions computed
        // above are structural (one disc per wet on a ring around the focal
        // cluster); the additive-scatter would wipe them and pile every new
        // article into one 60° wedge. Other layer loaders (Arresten,
        // Dossiers) still use it because they have no structural layout.
        updateNodes();
        updateEdges();
        console.log(`[graph-store] loadInstrumentCitations(${bwbId}): +${added} nodes, +${addedEdges} edges (${resp.total_edges} edges available)`);
        return { count: added };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentCitations failed:', err);
        return null;
      } finally {
        endTotal();
      }
    },

    loadGlobalGraph: async () => {
      const endTotal = perfStart('loadGlobalGraph total');
      loadingStore.set({ kind: 'global', phase: 'fetching' });
      try {
        const endFetch = perfStart('loadGlobalGraph fetch');
        const resp = await getGlobalGraph();
        endFetch(`${resp.articles.length} articles, ${resp.judgments.length} judgments, ${resp.edges.length} edges`);

        const instrumentsById = new Map<string, typeof resp.instruments[number]>();
        for (const inst of resp.instruments) {
          recordInstrument(inst);
          instrumentsById.set(inst.id, inst);
        }

        loadingStore.set({ kind: 'global', phase: 'building' });
        const endBuild = perfStart('loadGlobalGraph build');

        const articlesById = new Map<string, typeof resp.articles[number]>();
        for (const a of resp.articles) {
          if (!articlesById.has(a.id)) articlesById.set(a.id, a);
        }

        const judgmentsById = new Map<string, typeof resp.judgments[number]>();
        for (const j of resp.judgments) {
          if (!judgmentsById.has(j.id)) judgmentsById.set(j.id, j);
        }


        // Cluster articles by instrument (bwb_id), sorted by article number
        // within each cluster. Each cluster gets a proportional arc on the
        // outer ring; articles within a cluster arrange on a mini inner ring.
        const articleList = [...articlesById.values()].sort((a, b) => {
          const bwbCmp = (a.bwb_id ?? '').localeCompare(b.bwb_id ?? '');
          if (bwbCmp !== 0) return bwbCmp;
          return compareArticleNumbers(a.article_number, b.article_number);
        });

        const clusters = new Map<string, typeof articleList>();
        for (const a of articleList) {
          // For EU articles bwb_id is null — derive celex from the article key
          // (e.g. "32010l0064_1" → "32010l0064") so they cluster by directive.
          const celex = !a.bwb_id && a.article_number && a.key.endsWith('_' + a.article_number)
            ? a.key.slice(0, -(a.article_number.length + 1))
            : null;
          const key = a.bwb_id ?? celex ?? 'overig';
          let arr = clusters.get(key);
          if (!arr) { arr = []; clusters.set(key, arr); }
          arr.push(a);
        }

        const positions = new Map<string, { x: number; y: number }>();
        const clusterKeys = [...clusters.keys()].sort();

        // Spacing between adjacent nodes on a ring (graph units).
        const NODE_SPACING = 9;
        const CLUSTER_GAP = 30; // minimum gap between adjacent cluster edges

        // Starting radius of the innermost ring for a cluster of n articles.
        // Grows with sqrt(n) — no cap, so large laws get the space they need.
        const innerRingRadius = (n: number) => Math.max(10, 5 + Math.sqrt(n) * 3);

        // Simulate the concentric-ring placement to find the actual outermost
        // radius reached. Used for ring spacing so clusters never overlap.
        function actualClusterRadius(n: number): number {
          if (n <= 1) return 0;
          const baseR = innerRingRadius(n);
          const maxInitRings = Math.ceil(Math.log2(Math.max(n, 2)));
          let placed = 0, ring = 0, maxR = baseR * 0.4;
          while (placed < n) {
            const r = baseR * (0.4 + 0.6 * (ring / maxInitRings));
            const slots = Math.max(6, Math.floor((2 * Math.PI * r) / NODE_SPACING));
            placed += Math.min(slots, n - placed);
            maxR = r;
            ring++;
          }
          return maxR;
        }

        // Outer ring radius: derived from the actual extent of every cluster so
        // no two adjacent clusters ever overlap, regardless of their size.
        const clusterActualR = new Map(clusterKeys.map(k => [k, actualClusterRadius((clusters.get(k) ?? []).length)]));
        const totalPerimeter = clusterKeys.reduce(
          (sum, k) => sum + 2 * (clusterActualR.get(k) ?? 0) + CLUSTER_GAP, 0
        );
        const ringR = Math.max(80, totalPerimeter / (2 * Math.PI));

        clusterKeys.forEach((key, ci) => {
          const members = clusters.get(key) ?? [];
          const clusterR = clusterActualR.get(key) ?? 0;

          // Arc slot sized to the cluster's actual diameter plus the gap.
          const slotArc = (2 * clusterR + CLUSTER_GAP) / ringR;
          const startAngle = clusterKeys
            .slice(0, ci)
            .reduce((acc, k) => acc + (2 * (clusterActualR.get(k) ?? 0) + CLUSTER_GAP) / ringR, 0)
            - Math.PI / 2;
          const cAngle = startAngle + slotArc / 2;
          const cx = Math.cos(cAngle) * ringR;
          const cy = Math.sin(cAngle) * ringR;

          if (members.length <= 1) {
            members.forEach(a => positions.set(a.id, { x: cx, y: cy }));
          } else {
            // Concentric rings expanding outward from 40 % to 100 %+ of baseR.
            // No hard ring cap — the while condition guarantees every article
            // gets a position (fixes the "pile at centre" bug for large laws).
            const baseR = innerRingRadius(members.length);
            const maxInitRings = Math.ceil(Math.log2(Math.max(members.length, 2)));
            let placed = 0, ring = 0;
            while (placed < members.length) {
              const r = baseR * (0.4 + 0.6 * (ring / maxInitRings));
              const slots = Math.max(6, Math.floor((2 * Math.PI * r) / NODE_SPACING));
              const batch = members.slice(placed, placed + slots);
              batch.forEach((a, mi) => {
                const ang = (mi / slots) * Math.PI * 2 + ring * 0.5; // slight per-ring rotation
                positions.set(a.id, { x: cx + Math.cos(ang) * r, y: cy + Math.sin(ang) * r });
              });
              placed += batch.length;
              ring++;
            }
          }
        });

        const judgmentList = [...judgmentsById.values()];
        const J = Math.max(judgmentList.length, 1);
        judgmentList.forEach((j, i) => {
          const angle = (i / J) * Math.PI * 2 + Math.PI / 4;
          positions.set(j.id, { x: Math.cos(angle) * 55, y: Math.sin(angle) * 55 });
        });

        nodes.clear();
        edges.clear();
        cache.clear();
        history.length = 0;
        historyIndex = -1;

        for (const a of articlesById.values()) {
          const node = nodeToGraphNode({
            id: a.id, key: a.key, collection: 'instrument_articles', type: 'instrument_article',
            display_name: a.display_name ?? null, labels: ['Artikel'],
            props: {
              bwb_id: a.bwb_id,
              // EU articles have no bwb_id; derive celex from key so ArticleReader
              // can fall back to it when loading article detail.
              celex: !a.bwb_id && a.article_number && a.key.endsWith('_' + a.article_number)
                ? a.key.slice(0, -(a.article_number.length + 1))
                : null,
              article_number: a.article_number,
              // GlobalGraphResponse.articles items are ArticleGraphNodeDTO,
              // which doesn't carry geldig_vanaf / breadcrumb / stub. If the
              // user drills into a specific article, the dedicated
              // /api/articles/{bwb_id}/{article_number} call enriches those.
            }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(a.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(a.id)?.y;
          nodes.set(node.id, node);
        }

        for (const j of judgmentsById.values()) {
          const node = nodeToGraphNode({
            id: j.id, key: j.key, collection: 'judgments', type: 'judgment',
            display_name: j.display_name ?? j.ecli ?? 'Uitspraak', labels: ['Arrest'],
            props: { ecli: j.ecli, stub: j.stub ?? false }
          });
          (node as GraphNode & { x?: number; y?: number }).x = positions.get(j.id)?.x;
          (node as GraphNode & { x?: number; y?: number }).y = positions.get(j.id)?.y;
          nodes.set(node.id, node);
        }

        for (const e of resp.edges) {
          if (!nodes.has(e.from_id) || !nodes.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'verwijst_naar';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          edges.set(id, {
            id, source: e.from_id, target: e.to_id,
            kind: classifyEdgeKind(rel, nodes.get(e.from_id)?.kind, nodes.get(e.to_id)?.kind),
            label: rel.replace(/_/g, ' '), directed: true,
            confidence: e.confidence ?? null, relation: rel
          });
        }

        selectionStore.set(null);
        breadcrumbsStore.set([]);
        graphModeStore.set('bulk');
        updateNodes();
        updateEdges();

        endBuild(`${nodes.size} nodes, ${edges.size} edges in graph`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadGlobalGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },
    setGraphMode: (mode) => { graphModeStore.set(mode); },
    loadInstrumentLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      const endTotal = perfStart('loadInstrumentLayerGraph total');
      loadingStore.set({ kind: 'global', phase: 'fetching' });
      try {
        const resp = await getInstrumentLayerGraph();

        for (const inst of resp.instruments) {
          recordInstrument(inst as Parameters<typeof recordInstrument>[0]);
        }

        loadingStore.set({ kind: 'global', phase: 'building' });

        const N = resp.instruments.length;

        // Degree-concentric layout:
        //   ring 1 (innermost) = top 7% by citation count  (hubs: Awb, WvSr, …)
        //   ring 2             = next 13%
        //   ring 3             = next 25%
        //   ring 4 (outermost) = remaining 55%  (peripheral laws)
        // Radii are computed so each ring has comfortable label spacing.
        // Node size scales with degree so hub laws appear visually larger.

        // 1. Build degree map from the edge list
        const degreeMap = new Map<string, number>();
        for (const inst of resp.instruments) degreeMap.set(inst.id, 0);
        for (const e of resp.edges) {
          if (degreeMap.has(e.from_id)) degreeMap.set(e.from_id, (degreeMap.get(e.from_id) ?? 0) + 1);
          if (degreeMap.has(e.to_id))   degreeMap.set(e.to_id,   (degreeMap.get(e.to_id)   ?? 0) + 1);
        }

        // 2. Sort by degree descending
        const sorted = [...resp.instruments].sort(
          (a, b) => (degreeMap.get(b.id) ?? 0) - (degreeMap.get(a.id) ?? 0)
        );
        const maxDeg = degreeMap.get(sorted[0]?.id ?? '') ?? 1;

        // 3. Slice into rings and compute radii
        // Each ring radius = max(previous + gap, minimum non-overlapping radius).
        const ringSliceFracs = [0.07, 0.20, 0.45, 1.0]; // cumulative
        const MIN_SPACING = 24; // graph units between node centres
        const RING_GAP    = 70; // minimum gap between successive rings
        const rings: { slice: typeof sorted; r: number }[] = [];
        let prevR = 0;
        let prevEnd = 0;
        for (const cumFrac of ringSliceFracs) {
          const end = Math.min(Math.ceil(N * cumFrac), N);
          const slice = sorted.slice(prevEnd, end);
          if (!slice.length) break;
          const minR = Math.ceil((slice.length * MIN_SPACING) / (2 * Math.PI));
          const r = Math.max(prevR + RING_GAP, minR);
          rings.push({ slice, r });
          prevR = r;
          prevEnd = end;
        }

        // 4. Assign (x, y) positions and per-node sizes
        const positions = new Map<string, { x: number; y: number; size: number }>();
        for (const { slice, r } of rings) {
          slice.forEach((inst, i) => {
            const angle = (i / slice.length) * 2 * Math.PI - Math.PI / 2;
            const deg = degreeMap.get(inst.id) ?? 0;
            const size = 3 + (deg / maxDeg) * 10; // range [3, 13]
            positions.set(inst.id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, size });
          });
        }

        prepareBulkLoad(additive);
        const seqBefore = seq;

        for (const inst of resp.instruments) {
          const node = nodeToGraphNode({
            id: inst.id, key: inst.key,
            collection: 'instruments', type: 'instrument',
            display_name: inst.display_name ?? inst.citation_title ?? inst.title ?? inst.key,
            labels: ['Wet'],
            props: {
              bwb_id: inst.bwb_id,
              citation_title: inst.citation_title,
              title: inst.title,
              shorthand: inst.shorthand,
              stub: inst.stub ?? false
            }
          });
          // Additive: skip the structural ring layout so the new layer mixes
          // into existing context via FA2 instead of overlapping the origin.
          if (!additive) {
            const pos = positions.get(inst.id);
            (node as GraphNode & { x?: number; y?: number; size?: number }).x = pos?.x;
            (node as GraphNode & { x?: number; y?: number; size?: number }).y = pos?.y;
            (node as GraphNode & { x?: number; y?: number; size?: number }).size = pos?.size;
          }
          touchNode(node.id, node);
        }

        const nodeSet = new Set(nodes.keys());
        for (const e of resp.edges) {
          if (!nodeSet.has(e.from_id) || !nodeSet.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'verwijst_naar';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          if (!edges.has(id)) {
            edges.set(id, {
              id, source: e.from_id, target: e.to_id,
              kind: 'structural',
              label: rel.replace(/_/g, ' '), directed: true,
              confidence: e.confidence ?? null, relation: rel
            });
          }
        }

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        console.log(`[graph-store] loadInstrumentLayerGraph: ${nodes.size} instruments, ${edges.size} edges${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadInstrumentLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },

    loadJudgmentLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      const endTotal = perfStart('loadJudgmentLayerGraph total');
      loadingStore.set({ kind: 'global', phase: 'fetching' });
      try {
        const resp = await getJudgmentLayerGraph({ maxJudgments: opts?.maxJudgments ?? 1000 });

        loadingStore.set({ kind: 'global', phase: 'building' });

        // Build degree map from edges so we can scale node sizes.
        const degreeMap = new Map<string, number>();
        for (const j of resp.judgments) degreeMap.set(j.id, 0);
        for (const inst of resp.instruments) degreeMap.set(inst.id, 0);
        for (const e of resp.edges) {
          if (degreeMap.has(e.from_id)) degreeMap.set(e.from_id, (degreeMap.get(e.from_id) ?? 0) + (e.weight ?? 1));
          if (degreeMap.has(e.to_id))   degreeMap.set(e.to_id,   (degreeMap.get(e.to_id)   ?? 0) + (e.weight ?? 1));
        }

        // Layout: instruments form a fixed outer ring; judgments use force-directed
        // positions seeded on a tighter ring. We set initial x/y so sigma's force
        // atlas starts from a reasonable state.
        const instrIds = resp.instruments.map(i => i.id);
        const jIds     = resp.judgments.map(j => j.id);
        const INST_R   = Math.max(200, instrIds.length * 22);
        const J_R      = Math.max(80, Math.sqrt(jIds.length) * 18);
        const maxDeg   = Math.max(1, ...degreeMap.values());

        const positions = new Map<string, { x: number; y: number; size: number }>();

        instrIds.forEach((id, i) => {
          const angle = (i / instrIds.length) * 2 * Math.PI - Math.PI / 2;
          const deg = degreeMap.get(id) ?? 0;
          const size = 4 + (deg / maxDeg) * 9;
          positions.set(id, { x: Math.cos(angle) * INST_R, y: Math.sin(angle) * INST_R, size });
        });

        jIds.forEach((id, i) => {
          const angle = (i / Math.max(jIds.length, 1)) * 2 * Math.PI - Math.PI / 2;
          const deg = degreeMap.get(id) ?? 0;
          // Jitter radius so judgments don't all pile on the same ring.
          const r = J_R + ((i * 37) % 60) - 30;
          const size = 2 + (deg / maxDeg) * 6;
          positions.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r, size });
        });

        prepareBulkLoad(additive);
        const seqBefore = seq;

        // Add instrument nodes (anchor ring).
        for (const inst of resp.instruments) {
          const node = nodeToGraphNode({
            id: inst.id, key: inst.key,
            collection: 'instruments', type: 'instrument',
            display_name: inst.display_name ?? inst.citation_title ?? inst.title ?? inst.key,
            labels: ['Wet'],
            props: {
              bwb_id: inst.bwb_id,
              citation_title: inst.citation_title,
              title: inst.title,
              shorthand: inst.shorthand,
              stub: inst.stub ?? false,
            }
          });
          if (!additive) {
            const pos = positions.get(inst.id);
            (node as GraphNode & { x?: number; y?: number; size?: number }).x = pos?.x;
            (node as GraphNode & { x?: number; y?: number; size?: number }).y = pos?.y;
            (node as GraphNode & { x?: number; y?: number; size?: number }).size = pos?.size;
          }
          touchNode(node.id, node);
        }

        // Add judgment nodes.
        for (const j of resp.judgments) {
          const node: GraphNode = {
            id: j.id, key: j.key, collection: 'judgments',
            kind: 'judgment',
            label: (() => {
              const ecli = j.ecli ?? j.key;
              const m = ecli.match(/(?:ECLI:)?(?:NL:)?([^:]+):(\d{4}):(\d+)/);
              return m ? `${m[1]} ${m[2]}/${m[3]}` : ecli.replace(/^ECLI:/, '');
            })(),
            stub: j.stub ?? false,
            raw: {
              id: j.id, key: j.key,
              collection: 'judgments', type: 'judgment',
              display_name: j.display_name ?? j.key,
              labels: ['Arrest'],
              props: { ecli: j.ecli, stub: j.stub ?? false }
            }
          };
          if (!additive) {
            const pos = positions.get(j.id);
            (node as GraphNode & { x?: number; y?: number; size?: number }).x = pos?.x;
            (node as GraphNode & { x?: number; y?: number; size?: number }).y = pos?.y;
            (node as GraphNode & { x?: number; y?: number; size?: number }).size = pos?.size;
          }
          touchNode(node.id, node);
        }

        const nodeSet = new Set(nodes.keys());
        for (const e of resp.edges) {
          if (!nodeSet.has(e.from_id) || !nodeSet.has(e.to_id)) continue;
          const rel = e.relation_type ?? 'citeert';
          if (SCAFFOLDING_RELATIONS.has(rel)) continue;
          const id = `${e.from_id}->${e.to_id}:${rel}`;
          if (!edges.has(id)) {
            edges.set(id, {
              id, source: e.from_id, target: e.to_id,
              kind: 'citation',
              label: rel.replace(/_/g, ' '), directed: true,
              confidence: e.confidence ?? null, relation: rel
            });
          }
        }

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        console.log(`[graph-store] loadJudgmentLayerGraph: ${nodes.size} nodes (${resp.judgments.length} judgments, ${resp.instruments.length} instruments), ${edges.size} edges${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadJudgmentLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
        endTotal();
      }
    },
    loadLidGraph: async (key) => {
      // Lid hub graph: fetches the lid + uses the standard node-graph endpoint
      // to pull dient_in / lid_van neighbours (commissies, dossiers, tkstukken).
      // Backend exposes /api/nodes/leden/{key} once the lid collection lands.
      loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
      try {
        const lid = await fetchLid(key);
        loadingStore.set({ kind: 'parliamentary', phase: 'building' });

        nodes.clear();
        edges.clear();
        cache.clear();
        history.length = 0;
        historyIndex = -1;

        const hubNode = lidToGraphNode(lid);
        (hubNode as GraphNode & { x?: number; y?: number; size?: number }).x = 0;
        (hubNode as GraphNode & { x?: number; y?: number; size?: number }).y = 0;
        (hubNode as GraphNode & { x?: number; y?: number; size?: number }).size = 14;
        nodes.set(hubNode.id, hubNode);

        selectionStore.set(hubNode);
        breadcrumbsStore.set([]);
        graphModeStore.set('bulk');
        updateNodes();
        updateEdges();

        // Pull neighbours via the generic node-graph endpoint. This brings
        // in commissies (lid_van), dossiers (dient_in), tkstukken (dient_in
        // amendement / motie). Errors here are non-fatal — the hub still
        // renders alone and the user can search outward.
        try {
          const graph = await getNodeGraph('leden', key);
          mergeResponse(graph, { ...DEFAULT_EXPANSION, neighborLimit: 50 });
        } catch (err) {
          console.warn('[graph-store] loadLidGraph: neighbour fetch failed (lid hub only):', err);
        }

        updateNodes();
        updateEdges();
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadLidGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
      }
    },

    loadFractieGraph: async (key) => {
      // Fractie hub graph: single /api/nodes/fracties/{key} call returns
      // inbound LID_VAN_FRACTIE (members), outbound AUTEUR_VAN (authored
      // publications), outbound STEMT (votes with meta.stem) — all in one.
      loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
      try {
        const fractie = await fetchFractie(key);
        loadingStore.set({ kind: 'parliamentary', phase: 'building' });

        nodes.clear();
        edges.clear();
        cache.clear();
        history.length = 0;
        historyIndex = -1;

        const hubNode = fractieToGraphNode(fractie);
        (hubNode as GraphNode & { x?: number; y?: number; size?: number }).x = 0;
        (hubNode as GraphNode & { x?: number; y?: number; size?: number }).y = 0;
        (hubNode as GraphNode & { x?: number; y?: number; size?: number }).size = 14;
        nodes.set(hubNode.id, hubNode);

        selectionStore.set(hubNode);
        breadcrumbsStore.set([]);
        graphModeStore.set('bulk');
        updateNodes();
        updateEdges();

        try {
          const graph = await getNodeGraph('fracties', key);
          mergeResponse(graph, { ...DEFAULT_EXPANSION, neighborLimit: 50 });
        } catch (err) {
          console.warn('[graph-store] loadFractieGraph: neighbour fetch failed (hub only):', err);
        }

        updateNodes();
        updateEdges();
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadFractieGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
      }
    },

    loadCommissiesLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      // Top-level "commissies + their leden" overview in one round-trip.
      // /api/commissies/with-leden batches every committee + member set
      // into a single AQL query — replaces an N+1 of 130 parallel
      // /api/commissies/{slug} fetches.
      loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
      try {
        const list = await fetchCommissiesWithLeden();
        const ledenByCommissie = new Map<string, import('$lib/api/parliamentary').LidDTO[]>();
        for (const c of list) {
          ledenByCommissie.set(c.slug ?? c.key, c.leden);
        }

        loadingStore.set({ kind: 'parliamentary', phase: 'building' });

        prepareBulkLoad(additive);
        const seqBefore = seq;

        // Sort by active dossier count descending so busy committees appear first.
        const sorted = [...list].sort((a, b) => b.active_dossier_count - a.active_dossier_count);
        const maxCount = Math.max(1, sorted[0]?.active_dossier_count ?? 1);
        const N = sorted.length;
        const RING = Math.max(180, N * 38);

        sorted.forEach((c, i) => {
          const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
          const cx = Math.cos(angle) * RING;
          const cy = Math.sin(angle) * RING;
          const size = 6 + (c.active_dossier_count / maxCount) * 10;
          const slug = c.slug ?? c.key;
          const nodeId = graphNodeId('commissies', slug);

          const gn: GraphNode & { x?: number; y?: number; size?: number } = {
            id: nodeId,
            collection: 'commissies',
            key: slug,
            kind: 'commissie',
            label: c.afkorting ?? c.naam ?? slug,
            raw: {
              id: c.id,
              key: slug,
              collection: 'commissies',
              type: 'commissie',
              display_name: c.naam ?? slug,
              labels: ['Commissie'],
              props: {
                naam: c.naam,
                afkorting: c.afkorting,
                slug,
                active_dossier_count: c.active_dossier_count,
              },
            },
          };
          if (!additive) {
            gn.x = cx;
            gn.y = cy;
            gn.size = size;
          }
          touchNode(gn.id, gn);

          // Halo of leden around each commissie. Same pattern as the fractie
          // button: small inner orbit per hub, lid_van edges drawn outward.
          const leden = ledenByCommissie.get(slug) ?? [];
          if (leden.length === 0) return;
          const HALO = 22 + Math.sqrt(leden.length) * 8;
          leden.forEach((lid, j) => {
            const lidAngle = (j / leden.length) * Math.PI * 2;
            const lidNode = lidToGraphNode(lid) as GraphNode & { x?: number; y?: number; size?: number };
            if (!additive) {
              lidNode.x = cx + Math.cos(lidAngle) * HALO;
              lidNode.y = cy + Math.sin(lidAngle) * HALO;
              lidNode.size = lid.actief ? 5 : 3.5;
            }
            // First commissie wins if a lid sits on multiple committees;
            // additional edges still link them all.
            if (!nodes.has(lidNode.id)) touchNode(lidNode.id, lidNode);

            const rel = 'lid_van';
            const edgeId = `${lidNode.id}->${gn.id}:${rel}`;
            edges.set(edgeId, {
              id: edgeId,
              source: lidNode.id,
              target: gn.id,
              kind: 'parliamentary',
              label: rel,
              directed: true,
              relation: rel,
            });
          });
        });

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        const ledenCount = nodes.size - sorted.length;
        console.log(`[graph-store] loadCommissiesLayerGraph: ${sorted.length} commissies + ${ledenCount} leden${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadCommissiesLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
      }
    },

    loadLedenLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      // Bulk overview of all kamerleden. Tries /api/leden first; if the list
      // endpoint isn't shipped yet, falls back to aggregating leden from
      // every commissie's detail response.
      loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
      try {
        let list: Array<{ id: string; key: string; naam: string | null; partij: string | null; actief: boolean }> = [];
        try {
          list = await fetchLeden({ limit: 300 });
        } catch (primaryErr) {
          console.warn('[graph-store] /api/leden unavailable; aggregating from commissies', primaryErr);
          // Fallback: fetchCommissie(slug) for every commissie, dedupe leden.
          const commissies = await fetchCommissies();
          const detailed = await Promise.allSettled(
            commissies.map((c) => fetchCommissie(c.slug ?? c.key))
          );
          const seen = new Set<string>();
          for (const r of detailed) {
            if (r.status !== 'fulfilled') continue;
            for (const lid of r.value.leden) {
              if (seen.has(lid.key)) continue;
              seen.add(lid.key);
              list.push(lid);
            }
          }
        }

        loadingStore.set({ kind: 'parliamentary', phase: 'building' });

        prepareBulkLoad(additive);
        const seqBefore = seq;

        if (list.length === 0) return null;

        // Sort by partij so leden of the same fractie sit adjacent on the
        // ring. Inactive leden go last.
        const sorted = [...list].sort((a, b) => {
          if (a.actief !== b.actief) return a.actief ? -1 : 1;
          const pa = (a.partij ?? 'zz').toLowerCase();
          const pb = (b.partij ?? 'zz').toLowerCase();
          if (pa !== pb) return pa.localeCompare(pb, 'nl');
          return (a.naam ?? '').localeCompare(b.naam ?? '', 'nl');
        });
        const N = sorted.length;
        const R = Math.max(120, N * 4);

        sorted.forEach((l, i) => {
          const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
          const gn = lidToGraphNode(l) as GraphNode & { x?: number; y?: number; size?: number };
          if (!additive) {
            gn.x = Math.cos(angle) * R;
            gn.y = Math.sin(angle) * R;
            gn.size = l.actief ? 5 : 3.5;
          }
          touchNode(gn.id, gn);
        });

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        console.log(`[graph-store] loadLedenLayerGraph: ${nodes.size} leden${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadLedenLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
      }
    },

    loadFractiesLayerGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      // Top-level "fracties + their kamerleden" overview in one click.
      // Each fractie is a hub with its leden orbiting it, edge `lid_van_fractie`.
      //
      // Tries /api/fracties first; on failure derives a fractie set from the
      // partij field on aggregated commissie-leden (synthetic mode). In both
      // modes we end up with a list of fracties + a Map<fractieKey, LidDTO[]>
      // so the layout phase is identical.
      loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
      try {
        type FractieRow = { id: string; key: string; naam: string | null; afkorting: string | null; aantal_zetels?: number | null };
        let list: FractieRow[] = [];
        const ledenByFractie = new Map<string, import('$lib/api/parliamentary').LidDTO[]>();
        let synthetic = false;

        try {
          list = await fetchFracties();
          // Real path: pull each fractie's neighbours in parallel to find leden.
          const expansions = await Promise.allSettled(
            list.map((f) => getNodeGraph('fracties', f.key))
          );
          expansions.forEach((r, i) => {
            if (r.status !== 'fulfilled') return;
            const fractie = list[i];
            const ledenForFractie: import('$lib/api/parliamentary').LidDTO[] = [];
            for (const n of r.value.neighbors?.all ?? []) {
              if (n.collection !== 'leden') continue;
              const p = (n.props ?? {}) as Record<string, unknown>;
              ledenForFractie.push({
                id: n.id,
                key: n.key,
                naam: (p['naam'] as string | null) ?? n.display_name ?? n.key,
                partij: (p['partij'] as string | null) ?? fractie.afkorting ?? null,
                actief: (p['actief'] as boolean | undefined) ?? true,
              });
            }
            ledenByFractie.set(fractie.key, ledenForFractie);
          });
        } catch (primaryErr) {
          console.warn('[graph-store] /api/fracties unavailable; deriving from commissie leden', primaryErr);
          synthetic = true;
          const commissies = await fetchCommissies();
          const detailed = await Promise.allSettled(
            commissies.map((c) => fetchCommissie(c.slug ?? c.key))
          );
          const ledenByPartij = new Map<string, import('$lib/api/parliamentary').LidDTO[]>();
          const seenLid = new Set<string>();
          for (const r of detailed) {
            if (r.status !== 'fulfilled') continue;
            for (const lid of r.value.leden) {
              if (!lid.partij) continue;
              if (seenLid.has(lid.key)) continue;
              seenLid.add(lid.key);
              const arr = ledenByPartij.get(lid.partij) ?? [];
              arr.push(lid);
              ledenByPartij.set(lid.partij, arr);
            }
          }
          for (const [partij, leden] of ledenByPartij) {
            const key = partij.toLowerCase();
            list.push({
              id: `fracties/${key}`,
              key,
              naam: partij,
              afkorting: partij,
              aantal_zetels: leden.filter((l) => l.actief).length,
            });
            ledenByFractie.set(key, leden);
          }
        }

        loadingStore.set({ kind: 'parliamentary', phase: 'building' });

        prepareBulkLoad(additive);
        const seqBefore = seq;

        if (list.length === 0) return null;

        // Layout: fracties on an outer ring sized by seats (largest at top),
        // their leden in a small inner halo around each fractie position.
        const maxSeats = Math.max(1, ...list.map((f) => f.aantal_zetels ?? 0));
        const sorted = [...list].sort((a, b) => (b.aantal_zetels ?? 0) - (a.aantal_zetels ?? 0));
        const N = sorted.length;
        const RING = Math.max(180, N * 38);

        sorted.forEach((f, i) => {
          const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
          const fx = Math.cos(angle) * RING;
          const fy = Math.sin(angle) * RING;

          const fractieNode = fractieToGraphNode(f) as GraphNode & { x?: number; y?: number; size?: number };
          if (!additive) {
            fractieNode.x = fx;
            fractieNode.y = fy;
            fractieNode.size = f.aantal_zetels != null
              ? 6 + ((f.aantal_zetels ?? 0) / maxSeats) * 10
              : 9;
          }
          touchNode(fractieNode.id, fractieNode);

          // Place each lid in a tight halo around the fractie. Halo radius
          // scales with seat count — bigger fracties get a wider halo so
          // leden don't overlap.
          const leden = ledenByFractie.get(f.key) ?? [];
          if (leden.length === 0) return;
          const HALO = 22 + Math.sqrt(leden.length) * 8;
          leden.forEach((lid, j) => {
            const lidAngle = (j / leden.length) * Math.PI * 2;
            const lidNode = lidToGraphNode(lid) as GraphNode & { x?: number; y?: number; size?: number };
            if (!additive) {
              lidNode.x = fx + Math.cos(lidAngle) * HALO;
              lidNode.y = fy + Math.sin(lidAngle) * HALO;
              lidNode.size = lid.actief ? 5 : 3.5;
            }
            // Don't overwrite an existing lid node from a different fractie
            // (shouldn't happen with deduped data, but be safe).
            if (!nodes.has(lidNode.id)) touchNode(lidNode.id, lidNode);

            const rel = 'lid_van_fractie';
            const edgeId = `${lidNode.id}->${fractieNode.id}:${rel}`;
            edges.set(edgeId, {
              id: edgeId,
              source: lidNode.id,
              target: fractieNode.id,
              kind: 'parliamentary',
              label: rel,
              directed: true,
              relation: rel,
            });
          });
        });

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        const ledenCount = nodes.size - sorted.length;
        console.log(`[graph-store] loadFractiesLayerGraph: ${sorted.length} fracties + ${ledenCount} leden${synthetic ? ' (synthetic)' : ''}${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadFractiesLayerGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
      }
    },

    loadRecentDossiersGraph: async (opts) => {
      const additive = opts?.additive ?? false;
      // Top-level "dossiers + their publicaties" overview in one click.
      // Open dossiers go on an inner ring, closed dossiers on an outer ring.
      // For the top-N most-recent open dossiers we also pull their documents
      // via /api/dossiers/{key}/documents and place them in a halo around
      // the dossier hub. Remaining dossiers render bare to keep load manageable.
      loadingStore.set({ kind: 'parliamentary', phase: 'fetching' });
      try {
        const list = await fetchRecentDossiers({ days: opts?.days ?? 30, limit: 80 });
        // Bulk-fetch document halos for the top-N open dossiers in a single
        // round-trip. /api/dossiers/documents/bulk runs one AQL pass over
        // all requested dossiers; the server-side per_dossier_limit caps
        // each halo at the same 8 docs we used to slice client-side.
        const HALO_LIMIT = 25;
        const halosFor = list.filter((d) => !d.afgedaan).slice(0, HALO_LIMIT);
        const docsByDossier = new Map<string, import('$lib/api/parliamentary').DossierDocumentDTO[]>();
        if (halosFor.length > 0) {
          const bulk = await fetchDossierDocumentsBulk(
            halosFor.map((d) => d.kamerstuknummer),
            { perDossierLimit: 8 },
          ).catch(() => ({} as Record<string, import('$lib/api/parliamentary').DossierDocumentDTO[]>));
          for (const d of halosFor) {
            docsByDossier.set(d.kamerstuknummer, bulk[d.kamerstuknummer] ?? []);
          }
        }

        loadingStore.set({ kind: 'parliamentary', phase: 'building' });

        prepareBulkLoad(additive);
        const seqBefore = seq;

        const open   = list.filter((d) => !d.afgedaan);
        const closed = list.filter((d) => d.afgedaan);

        const placeRing = (items: typeof list, r: number, withHalos: boolean) => {
          const N = items.length;
          items.forEach((d, i) => {
            const angle = (i / Math.max(N, 1)) * Math.PI * 2 - Math.PI / 2;
            const dx = Math.cos(angle) * r;
            const dy = Math.sin(angle) * r;
            const gn: GraphNode & { x?: number; y?: number; size?: number } = {
              id: graphNodeId('dossiers', d.kamerstuknummer),
              collection: 'dossiers',
              key: d.kamerstuknummer,
              kind: 'dossier',
              label: d.kamerstuknummer,
              raw: {
                id: d.id,
                key: d.kamerstuknummer,
                collection: 'dossiers',
                type: 'dossier',
                display_name: d.titel ?? d.kamerstuknummer,
                labels: ['Dossier'],
                props: {
                  kamerstuknummer: d.kamerstuknummer,
                  titel: d.titel,
                  huidige_fase: d.huidige_fase,
                  afgedaan: d.afgedaan,
                },
              },
            };
            if (!additive) {
              gn.x = dx;
              gn.y = dy;
              gn.size = d.afgedaan ? 5 : 8;
            }
            touchNode(gn.id, gn);

            if (!withHalos) return;
            const docs = docsByDossier.get(d.kamerstuknummer) ?? [];
            if (docs.length === 0) return;
            const HALO = 18 + Math.sqrt(docs.length) * 6;
            docs.forEach((doc, j) => {
              const dAngle = (j / docs.length) * Math.PI * 2;
              const docId = graphNodeId('publications', doc.key);
              const docNode: GraphNode & { x?: number; y?: number; size?: number } = {
                id: docId,
                collection: 'publications',
                key: doc.key,
                kind: 'tkstuk',
                label: doc.display_name ?? doc.titel ?? doc.soort ?? doc.key,
                raw: {
                  id: doc.id,
                  key: doc.key,
                  collection: 'publications',
                  type: 'publication',
                  display_name: doc.display_name ?? doc.titel ?? null,
                  labels: ['Publication'],
                  props: {
                    soort: doc.soort,
                    titel: doc.titel,
                    datum: doc.datum,
                    volgnummer: doc.volgnummer,
                    dossier_nummer: doc.dossier_nummer,
                    vergaderjaar: doc.vergaderjaar,
                    tk_url: doc.tk_url,
                  },
                },
              };
              if (!additive) {
                docNode.x = dx + Math.cos(dAngle) * HALO;
                docNode.y = dy + Math.sin(dAngle) * HALO;
                docNode.size = 4.5;
              }
              if (!nodes.has(docNode.id)) touchNode(docNode.id, docNode);

              const rel = 'behandelt_artikel';
              const edgeId = `${gn.id}->${docNode.id}:${rel}`;
              edges.set(edgeId, {
                id: edgeId,
                source: gn.id,
                target: docNode.id,
                kind: 'parliamentary',
                label: rel,
                directed: true,
                relation: rel,
              });
            });
          });
        };

        const innerR = Math.max(180, open.length * 18);
        const outerR = innerR + Math.max(60, closed.length * 6);
        placeRing(open, innerR, true);   // halos for open dossiers
        placeRing(closed, outerR, false); // closed dossiers plain

        if (additive) placeAdditiveLayer(seqBefore);
        if (!additive) {
          selectionStore.set(null);
          breadcrumbsStore.set([]);
          graphModeStore.set('bulk');
        }
        updateNodes();
        updateEdges();

        const docCount = nodes.size - list.length;
        console.log(`[graph-store] loadRecentDossiersGraph: ${list.length} dossiers (${open.length} open, ${closed.length} closed) + ${docCount} publicaties${additive ? ' (additive)' : ''}`);
        return { count: nodes.size };
      } catch (err) {
        console.warn('[graph-store] loadRecentDossiersGraph failed:', err);
        return null;
      } finally {
        loadingStore.set({ kind: 'idle' });
      }
    },

    seedGraph: (seed) => {
      clearGraph();
      for (const node of seed.nodes) {
        nodes.set(node.id, node);
      }
      for (const edge of seed.edges ?? []) {
        edges.set(edge.id, edge);
      }
      updateNodes();
      updateEdges();
      if (seed.focus) {
        focusInternal(graphNodeId(seed.focus.collection, seed.focus.key));
      }
    },
    setSelection: (nodeId, opts) => {
      if (!nodeId) {
        selectionStore.set(null);
        return;
      }
      focusInternal(nodeId, opts);
    },
    togglePin: (nodeId) => {
      if (pinned.has(nodeId)) {
        pinned.delete(nodeId);
      } else {
        pinned.add(nodeId);
      }
      pinnedStore.set(new Set(pinned));
    },
    pinNode: (nodeId) => {
      pinned.add(nodeId);
      pinnedStore.set(new Set(pinned));
    },
    unpinNode: (nodeId) => {
      pinned.delete(nodeId);
      pinnedStore.set(new Set(pinned));
    },
    focusNode: (nodeId, opts) => focusInternal(nodeId, opts),
    goBack: () => {
      if (historyIndex <= 0) return null;
      historyIndex -= 1;
      const nodeId = history[historyIndex];
      if (nodeId) {
        focusInternal(nodeId, { recordHistory: false });
        updateBreadcrumbs();
      }
      return nodeId ?? null;
    },
    goForward: () => {
      if (historyIndex >= history.length - 1) return null;
      historyIndex += 1;
      const nodeId = history[historyIndex];
      if (nodeId) {
        focusInternal(nodeId, { recordHistory: false });
        updateBreadcrumbs();
      }
      return nodeId ?? null;
    },
    reset: () => {
      clearGraph();
      pinned.clear();
      pinnedStore.set(new Set());
    },
    setFilters: (updater) => {
      const current = get(filtersStore);
      filtersStore.set({
        ...current,
        ...updater,
        nodeTypeToggles: {
          ...current.nodeTypeToggles,
          ...(updater.nodeTypeToggles ?? {})
        },
        activeInstruments: updater.activeInstruments ?? current.activeInstruments
      });
    },
    getNodeById: (nodeId) => nodes.get(nodeId),
    getNeighborsOf: (nodeId) => {
      const neighbors = new Set<string>();
      edges.forEach((edge) => {
        if (edge.source === nodeId) {
          neighbors.add(edge.target);
        }
        if (edge.target === nodeId) {
          neighbors.add(edge.source);
        }
      });
      return [...neighbors];
    },
    pruneNodes: (keepIds) => {
      for (const id of [...nodes.keys()]) {
        if (!keepIds.has(id)) nodes.delete(id);
      }
      for (const [id, edge] of [...edges.entries()]) {
        if (!keepIds.has(edge.source) || !keepIds.has(edge.target)) {
          edges.delete(id);
        }
      }
      updateNodes();
      updateEdges();
    },
    setCollapseToLaws: (collapse) => {
      if (proxiesEnabled === collapse) return;
      proxiesEnabled = collapse;
      // Re-fire emits so synthesizeDerivedNodes runs with the new flag —
      // adds proxies when collapsing, drops them when expanding back to
      // Artikelen view.
      updateNodes();
      updateEdges();
    },
    sweepOrphans: () => {
      // Build a set of node ids that still have at least one incident edge.
      const connected = new Set<string>();
      for (const e of edges.values()) {
        connected.add(e.source);
        connected.add(e.target);
      }
      const sel = get(selectionStore);
      let dropped = 0;
      for (const id of [...nodes.keys()]) {
        if (connected.has(id)) continue;
        if (pinned.has(id)) continue;
        if (sel && sel.id === id) continue; // focal stays even if alone
        nodes.delete(id);
        insertedAt.delete(id);
        dropped += 1;
      }
      if (dropped > 0) {
        updateNodes();
        updateEdges();
      }
    }
  };

  return instance;
}

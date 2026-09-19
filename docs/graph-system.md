# Graph system

The graph is the central feature. This document covers the four layers that produce it: the type system, the in-memory data store, the sigma renderer, and the surrounding UI scaffolding (filters, layers, overlays).

If you're touching anything in `src/lib/graph/` or `src/lib/components/graph/`, read this first.

## Layers

```
┌────────────────────────────────────────────────────────┐
│  GraphSidebar (filters, layers, overlays, instruments) │
├────────────────────────────────────────────────────────┤
│  GraphView (orchestrator — store ⇄ canvas ⇄ panels)    │
├────────────────────────────────────────────────────────┤
│  GraphCanvas (sigma + HTML overlays + hover + camera)  │
├────────────────────────────────────────────────────────┤
│  sigma + graphology  ──┐                               │
│                        │  reads from                   │
│                        ▼                               │
│  GraphStore (graph-store.ts) — graphology + history    │
├────────────────────────────────────────────────────────┤
│  api client (parliamentary-client.ts, etc.)            │
└────────────────────────────────────────────────────────┘
```

Each layer's responsibilities are non-overlapping. `GraphStore` knows nothing about sigma. `GraphCanvas` knows nothing about how data got into graphology — only how to render whatever is there. `GraphView` is the glue.

## Types — `src/lib/graph/types.ts`

`GraphNode` and `GraphEdge` are the in-memory representations. They're not the same as backend DTOs; the conversion (`nodeToGraphNode`, `dossierToGraphNode`, etc.) happens in `types.ts` and is exported for use by store loaders.

```ts
type GraphNodeKind =
  | 'article' | 'judgment' | 'tkstuk' | 'activity'
  | 'instrument' | 'dossier' | 'commissie' | 'lid' | 'fractie' | 'other';

interface GraphNode {
  id: string;            // canonical "{collection}/{key}"
  key: string;
  collection: string;
  kind: GraphNodeKind;
  label: string;         // human display
  raw: BaseNode;         // backend payload (props, labels, etc.)
}

interface GraphEdge {
  id: string;
  source: string;        // node id
  target: string;
  relation: string;      // "wijzigt", "verwijst_naar", "deel_van", ...
  category: 'structural' | 'mutation' | 'semantic';
  weight?: number;
}
```

### Edge categories

Every relation is bucketed into one of three categories. This matches Methode §iiib:

| Category | Relations | Example |
|---|---|---|
| `structural` | `deel_van`, `behandeld_door`, `raakt`, ... | Article ↔ Instrument |
| `mutation` | `wijzigt`, `introduceert`, `trekt_in`, `licht_toe` | Dossier → Article |
| `semantic` | `verwijst_naar`, `citeert`, `noemt_artikel` | Judgment → Article |

The categoriser is `classifyEdgeKind(relation, label)`. Filter toggles in `GraphFilters` (`structuralEnabled`, `mutationEnabled`, `semanticEnabled`) gate edges by category at render time — the edges remain in the graphology graph, sigma's reducer just paints them as `hidden: true`.

### Anchor kinds

`isAnchorKind(kind)` returns true for `instrument`, `dossier`, `commissie`, `lid`, `fractie`. Anchors are nodes that *organise* other nodes — they don't represent a single text. Used in expansion policies and orphan sweeps (we treat anchors as "always keep" candidates).

### Scaffolding relations

`SCAFFOLDING_RELATIONS` is a set of structural relations that the renderer hides by default — `deel_van`, `volgt_op`, etc. They exist to make the graph queryable but rarely add visual signal. Show them via the "Toon scaffolding-kanten" toggle.

## GraphStore — `src/lib/graph/graph-store.ts`

The single source of truth for what's "on the canvas". Wraps a graphology instance plus history, pinning, filters, and an LRU.

### Surface

Stores expose data:

| Store | Type |
|---|---|
| `nodes`, `edges` | `Readable<GraphNode[]>` / `Readable<GraphEdge[]>` |
| `selection` | `Readable<GraphNode \| null>` — current focus |
| `pinned` | `Readable<Set<string>>` — pinned node ids |
| `breadcrumbs` | `Readable<GraphNode[]>` — focus history |
| `canGoBack` / `canGoForward` | `Readable<boolean>` |
| `filters` | `Readable<GraphFilters>` |
| `loading` | `Readable<LoadingState>` — discriminated union per load kind |
| `graphMode` | `Readable<'expansion' \| 'bulk'>` |
| `potentialCounts` | `Readable<Record<string, number>>` — cached-but-not-merged neighbour counts per kind |

Plus methods:

- `expandNode(collection, key, opts?)` — central expansion path. Fetches `/api/nodes/expand` and merges results respecting `convergenceMode`, `neighborLimit`, soft caps.
- `loadInstrument(bwbId)` — bulk-load a single law's full graph; switches to `graphMode: 'bulk'`.
- `loadGlobalGraph()` — bulk-load every instrument anchor.
- `loadInstrumentLayerGraph`, `loadJudgmentLayerGraph`, `loadCommissiesLayerGraph`, `loadLedenLayerGraph`, `loadFractiesLayerGraph`, `loadRecentDossiersGraph` — layer loaders (drive the sidebar "Lagen" buttons).
- `loadDossierGraph(nummer)`, `loadCommissieGraph(slug)`, `loadLidGraph(key)`, `loadFractieGraph(key)` — entity-rooted bulk loads.
- `focusNode(id, opts?)`, `setSelection(id, opts?)` — focus and selection with optional history.
- `togglePin(id)`, `pinNode(id)`, `unpinNode(id)`.
- `goBack()`, `goForward()` — history navigation.
- `pruneNodes(keepIds)`, `sweepOrphans()` — surgical removal.
- `setFilters(patch)`, `reset()`, `seedGraph(seed)`.

### Internal state (not exposed)

- `nodes: Map<string, GraphNode>` — id → node
- `edges: Map<string, GraphEdge>` — id → edge
- `cache: Map<string, NodeGraphResponse>` — keyed by `{collection}/{key}`, holds the raw API response so `potentialCounts` can be computed without refetching
- `history: string[]` + `historyIndex` — focus stack for ←/→
- `seq` + `insertedAt: Map<string, number>` — monotonic counter for LRU trim

### Soft cap and LRU trim

`SOFT_NODE_CAP = 400`. When a merge would push the count over, the store drops the oldest non-pinned, non-focused, non-level-1 nodes first. Bulk loaders (e.g. `loadInstrument`) bypass the cap — they bring their own budget.

The "level-1" check is computed against the current `selection` — direct neighbours of the focus are protected.

### Expansion model

`expandNode(collection, key, opts?)`:

1. **Cache check.** If the response is in `cache` and `force` is false, replay from cache. Otherwise fetch `/api/nodes/expand?id={collection}/{key}` with `outboundOnly`, `neighborLimit`, etc. as params.
2. **Filter incoming nodes/edges.** Apply `includeStrict` / `includeSemantic` / `semanticConfidenceThreshold` gates.
3. **Convergence prune (optional).** If `convergenceMode` is on, drop neighbours only reachable via a single path through the focus. Keeps the canvas to nodes that are "structurally close" to multiple paths.
4. **Merge into graphology.** Upsert nodes/edges. Trigger orphan sweep if needed.
5. **Recompute layout incrementally** via the FA2 worker (kicked off in `GraphView.svelte`).
6. **Emit** to subscribed `nodesStore` / `edgesStore`.

Returns the focal `GraphNode` (or null if fetch failed).

### History semantics

Focus changes record onto `history` *unless* called with `recordHistory: false`. The initial URL-driven `focusNode` call uses `recordHistory: false` so reload doesn't immediately have an empty back stack. Browser back/forward and the in-app `←`/`→` are wired to `goBack()` / `goForward()`.

### graphMode: expansion vs bulk

- **`expansion`** (default): clicks expand. Each click fetches a new node's neighbours. Soft cap and LRU active.
- **`bulk`**: clicks select-only. The graph is assumed already-complete (e.g. all of one law's articles + their links). Loaders that pre-fetch the full neighbourhood switch to `bulk` to disable per-click expansion.

`graphMode` is observable; consumers (the empty-state hints, the "load all" button) read it to adjust their copy.

## Rendering — `GraphCanvas.svelte`

Sigma 3 + a thin HTML overlay layer. Sigma renders nodes (`@sigma/node-border`, `@sigma/node-square`) and edges (`arrow`, custom `dashed`) on a WebGL canvas. Cluster labels, activity halos, and mutatie badges are HTML absolutely-positioned over the canvas, kept in sync via `renderer.graphToViewport()`.

### Reducer pattern

Sigma's `nodeReducer` / `edgeReducer` are called once per node/edge per render. They read mutable refs that mirror props:

```ts
let latestFilters: GraphFilters | null = null;
let latestPinnedIds = new Set<string>();
let latestHeatMap: HeatMap = new Map();
let latestMutatieActive = false;
// ... etc.

renderer = new Sigma(graph, container, {
  nodeReducer: (id, data) => {
    if (suppressed(latestFilters, id)) return { ...data, hidden: true };
    if (id === focusedId) return { ...data, highlighted: true };
    if (latestPinnedIds.has(id)) return { ...data, borderColor: '...' };
    return data;
  },
  edgeReducer: (id, data) => {
    const cat = classifyEdgeKind(data.relation, ...);
    if (!filterEnabledFor(cat, latestFilters)) return { ...data, hidden: true };
    return data;
  },
  zoomToSizeRatioFunction: (ratio) => Math.min(Math.sqrt(ratio), 1.5),
  // ...
});
```

Mutating a ref + calling `renderer.refresh()` re-runs the reducers. Reducers never mutate the underlying graphology graph — they only return display data.

### Camera persistence

`GraphView` is unmounted/remounted when `mode` switches between `graph` and `split` (the `{#if mode === ...}` blocks). To preserve camera state across that cycle, module-level `_cam` records hold the last camera state, keyed by `'full'` vs `'compact'`. On remount, the camera restores from `_cam` instead of refitting.

### Hover state

Two sources feed the hover indicator:

- Sigma's `enterNode` / `leaveNode` (live mouse position over a node)
- `externalHoveredId` prop (kept alive while the hover popup is open over the canvas)

The effective hover is `externalHoveredId ?? sigmaHoveredId`. When hover changes, edges incident to the hovered node are promoted (`zIndex = 2`) so they paint on top of dimmed edges.

### Edge zIndex

Sigma sorts edges by their graphology `zIndex` attribute during indexation. The reducer's `zIndex` is ignored for ordering. To raise a specific edge, we mutate the graph attribute directly (`graph.setEdgeAttribute(e, 'zIndex', 2)`), and revert on hover-end.

### afterRender

`renderer.on('afterRender', updateViewportLabels)` runs every frame. `updateViewportLabels()` projects cluster labels, activity halos, and mutatie badges into viewport space — this is where overlays stay in sync with pan/zoom.

The cost is bounded by `activityHalos + mutatieBadges + clusterLabels` count. For 1000+ visible nodes with an active overlay, the per-frame cost is still milliseconds — projection is just a matrix multiply per node.

## Filters, layers, and the sidebar

`GraphSidebar.svelte` is a passive component — it reads `filters` and emits patches via `onFilterChange(patch)`. The store's `setFilters(patch)` does the merge.

| Sidebar section | Drives |
|---|---|
| Lagen (layers) | Bulk loaders + node-type toggles. "Active" = there are nodes of that kind on canvas; "potential" count = how many would arrive from cache if you clicked. |
| Filters → Verbindingen | `structuralEnabled` / `mutationEnabled` / `semanticEnabled` — edge category gates. |
| Filters → Toon scaffolding-kanten | Bypass `SCAFFOLDING_RELATIONS`. |
| Overlays | Activates Activiteit or Mutatie. Mutually exclusive. See [`overlays.md`](overlays.md). |
| Wetten (active instruments) | Multi-select of `activeInstruments: Set<string>`. Filters edges/nodes to those touching at least one active law. |
| Detail-niveau | Toggles `collapseToLaws` — synthesises instrument "proxy" nodes that stand in for groups of articles. |

## Convergence prune

The default expansion mode is *not* "all direct neighbours" — it's "neighbours reachable via at least two paths from any existing canvas node, plus the focus' direct neighbours". This keeps dense citation hubs (e.g. AWB art. 8:1) from carpet-bombing the canvas.

Implementation: `expandToDepth` in `GraphView.svelte` runs a BFS, then marks nodes reachable through only one path as candidates for removal. The store's prune retains the focus, its level-1, pinned nodes, and nodes reachable via multiple paths.

`?all=unbound` disables the prune entirely; `?all=1` keeps the prune but raises `neighborLimit`. The "Maak ze zichtbaar" button on the sidebar fires `onRevealHidden` which re-expands without pruning, then `sweepOrphans` is called to cull strict orphans only.

## Layout

graphology-layout-forceatlas2 (FA2) runs in a worker via `graphology-layout-forceatlas2/worker`. The worker is started in `GraphView.onMount` and killed in `onDestroy`.

Adding nodes: the FA2 worker continues spinning, so new nodes drift into stable positions over a few frames. After a focus change or a bulk load, `fitWhenSettled` waits for FA2 convergence (a few hundred ms) then fits the camera. `suppressFit()` blocks the fit when the caller already knows the camera shouldn't move (e.g. reveal-hidden, which preserves user context).

If you're adding a new loader, follow the pattern: call the loader, await its `count`, then call `fitWhenSettled` unless you have a reason not to.

## Adding a new node-kind

If the backend gains a new entity type (e.g. `motie`):

1. Add to `GraphNodeKind` union in `types.ts`.
2. Add a `motieToGraphNode(dto)` converter in `types.ts`.
3. Extend `detectNodeKind` to recognise the collection.
4. Add the kind to `GraphFilters.nodeTypeToggles` and `DEFAULT_FILTERS`.
5. Add a sidebar entry under Lagen.
6. Add a reader: `src/lib/components/explore/readers/MotieReader.svelte` + register in `KindReader.svelte`.
7. Add to `SearchOverlay` and `/search` page if the kind is searchable.
8. If the kind should be loadable as a layer, add `loadMotieLayerGraph` to the store and wire a sidebar button.

That's a lot of touchpoints — by design. Adding a kind is a real feature, not a tweak.

## Related files

| Concern | File |
|---|---|
| Type system | `src/lib/graph/types.ts` |
| Store | `src/lib/graph/graph-store.ts` |
| Sidebar | `src/lib/components/graph/GraphSidebar.svelte` |
| Orchestrator | `src/lib/components/graph/GraphView.svelte` |
| Canvas | `src/lib/components/graph/GraphCanvas.svelte` |
| Edge program (dashed) | `src/lib/components/graph/DashedEdgeProgram.ts` |
| Hover / cite panels | `src/lib/components/graph/GraphNodePanel.svelte`, `GraphCitePanel.svelte` |
| Breadcrumb | `src/lib/components/graph/GraphBreadcrumb.svelte` |

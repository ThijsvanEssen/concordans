# Graph system

The network view is built in four layers. Each knows only the one below it.

| Layer   | File                                                    | Responsibility                                                        |
| ------- | ------------------------------------------------------- | --------------------------------------------------------------------- |
| Sidebar | `src/lib/components/graph/GraphSidebar.svelte`          | Layers, node and edge filters, overlays. Emits patches, holds no data |
| View    | `src/lib/components/graph/GraphView.svelte`             | Connects store, canvas and panels; runs the layout and the camera fit |
| Canvas  | `src/lib/components/graph/GraphCanvas.svelte`           | Sigma renderer plus the HTML layers (halos, badges, cluster labels)   |
| Store   | `src/lib/graph/graph-store.ts`, `src/lib/graph/store/*` | The nodes and edges on the canvas. Knows nothing of Sigma             |

The API is reached through `$lib/api/client` (see [`api-client.md`](api-client.md)). Collection and relation names come from `src/lib/vocabulary.ts`; their meaning is in the API's [`data-model.md`](../../lawgraph/docs/data-model.md).

## Types

`src/lib/graph/types.ts` converts API nodes and edges to `GraphNode` and `GraphEdge`.

`GraphNodeKind` is what the interface calls a node. Several collections share a kind (`KIND_OF_COLLECTION`): `decisions`, `commitments`, `cases` and `activities` are all `activity`; version and annex collections are `other`. Because the map is a `Record<Collection, GraphNodeKind>`, a new collection in `vocabulary.ts` does not compile until it has a kind.

`GraphEdge` carries the API relation, an optional `label`, `confidence`, `status` and `meta`. Its category (`structural`, `mutation`, `semantic`) is computed by `edgeCategory(relation, sourceKind)`. `REFERS_TO` is structural between two articles and semantic from any other source (a citation). `GraphFilters` switches each category on or off; the canvas hides the edges of a switched-off category with its edge reducer, the store keeps them.

`nodeToGraphNode` returns null for a collection the app does not know. Node `props` are untyped in the schema; read them defensively.

Layers pair a primary kind with the kinds the sidebar groups under it (`LAYER_SUB_KINDS`): instrument with article, dossier with document, committee with activity, faction with member.

## Store

`createGraphStore()` in `graph-store.ts` spreads the slices of `store/` into one `GraphStore` (typed in `store/types.ts`, which is the reference for the methods).

| File                       | Contents                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `context.ts`               | Node and edge maps, writable stores, history, soft cap, derived nodes and edges, `mergeResponse`           |
| `expansion.ts`             | `expandNode`, `expandNeighborhood`                                                                         |
| `wet-loaders.ts`           | `loadInstrument` and the judgment and dossier layers of one instrument                                     |
| `wet-citations.ts`         | `loadInstrumentCitations`                                                                                  |
| `global-loaders.ts`        | `loadInstrumentLayerGraph`, `loadJudgmentLayerGraph`                                                       |
| `parliamentary-loaders.ts` | `loadMemberGraph`, `loadFactionGraph`, the committee, member and faction layers, `loadRecentDossiersGraph` |
| `view-actions.ts`          | Selection, focus, history, pinning, filters, pruning, `reset`, `setCollapseToLaws`                         |

Each module is a factory that receives the context and returns part of the `GraphStore`. Scalars that several modules change (`seq`, `historyIndex`, `proxiesEnabled`, `additiveLayerIndex`) live on `ctx.state`; destructuring them would freeze a copy.

**Expansion.** `expandNode(collection, key)` fetches `/api/nodes/{collection}/{key}` (`neighbor_limit` from the filters), caches the response by node id and merges it. `expandNeighborhood` fetches every node and edge within `depth` hops in one request. Edges below `semanticThreshold` are dropped when merged.

**Soft cap.** `SOFT_NODE_CAP` is 400. A merge that passes it removes the oldest nodes that are not pinned, selected or next to the selection; `trimmedCount` counts them. Bulk loaders bypass the cap.

**Modes.** `graphMode` is `bulk` after a loader that replaces the canvas (every node has its neighbourhood, a click only selects) and `expansion` otherwise (a click fetches neighbours). Bulk loaders place their nodes themselves and the view skips the force layout.

**Cancellation.** A loader that replaces the canvas calls `supersede()`, which aborts every request still writing into the old canvas.

**Derived nodes and edges.** `emit()` rebuilds them on every change; their ids start with `synth:`.

- Instrument proxies exist only in the collapsed view (`setCollapseToLaws(true)`), for laws that have articles but no instrument node on the canvas.
- A document or judgment that relates to an article gets an edge to the instrument of that law, with the same relation and the label `via artikel`.
- Articles get a `PART_OF` edge to their instrument node; members get `MEMBER_OF` edges to factions from `faction_memberships`.

**History.** `focusNode` records the focus unless called with `recordHistory: false`. The explore page passes `false` for back and forward, and when a focus in a bulk overview is already on the canvas.

**Layer counts.** `potentialCounts` holds, per kind, the neighbours in cached expansions that are not on the canvas, overridden by the totals `prefetchInstrumentLayerCounts` reads from the instrument endpoints.

## Expansion around a focus

The explore page (`src/routes/explore/+page.svelte`) expands a focus with one `expandNeighborhood` request (`depth` 3, `cap` 200) and then prunes to what is close to the focus: the focus, its direct neighbours, and sources reachable within two hops from two or more of those neighbours, with the shortest paths connecting them (`computeConvergencePaths`). Pinned sources stay, with their path to the focus. `sweepOrphans` then removes sources without an edge, because the force layout throws them far out and the camera fit zooms out to include them.

`handleRevealHidden` (sidebar action "Toon alle") repeats the request without the prune.

A layer button loads one kind of source. With a source selected it expands only what is on the canvas and keeps the sources of the target kinds; with an instrument on the canvas it uses that instrument's endpoints; otherwise it loads the whole layer.

## Rendering

**Reducers.** Sigma calls `nodeReducer` and `edgeReducer` for every node and edge on each render. They read `latest*` variables that mirror the props, so a change of props is a variable update plus `renderer.refresh()`. Reducers return display data and never change the graphology graph.

**Camera.** `GraphView` is unmounted when `mode` switches between `graph` and `split`. Module-level `_cam` keeps the camera per placement (`full`, `compact`), and `_camNodeIds` decides whether the graph is unchanged so the camera is restored instead of fitted.

**Hover.** The effective hover is `externalHoveredId ?? sigmaHoveredId`; the prop keeps the hover alive while the cite panel is open. Sigma orders edges by the `zIndex` attribute on the graphology edge, not by the reducer result, so the edges of the hovered node get the attribute set and reset.

**Layout.** ForceAtlas2 runs in a worker (`graphology-layout-forceatlas2/worker`), created on demand in `ensureLayout` and killed on destroy. After a load, call `suppressFit()` first and `fitWhenSettled()` last: the fit then waits until the worker has stopped.

**Sprites.** `nodeSprites.ts` is the one place that defines colour and shape per kind and colour per edge category. `DashedEdgeProgram.ts` draws the dashed edge type used for `VOTED` edges.

## Adding a node kind

1. Add the collection to `NODE_TYPES` in `vocabulary.ts` if the API introduces one.
2. Give it a kind in `KIND_OF_COLLECTION`, or add a `GraphNodeKind`. The compiler then flags every `Record<GraphNodeKind, ...>` that lacks an entry: `DEFAULT_FILTERS.nodeTypeToggles`, the maps in `nodeSprites.ts`, the labels in `GraphSidebar.svelte` and `GraphCitePanel.svelte`.
3. Extend `buildNodeLabel` if the label is not `display_name`.
4. Add a layer button and loader if the kind is loadable as a layer, and a reader in `KindReader.svelte` (see [`readers.md`](readers.md)).

# Graph system

The network view is built in four layers. Each knows only the one below it.

| Layer  | File                                                    | Responsibility                                                                                                                                                          |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legend | `src/lib/components/graph/GraphSidebar.svelte`          | The bronfilter (bronnen with counts, the preset), the relations with a line sample, depth, lid, what the canvas shows and hides; overlays and pinned bronnen under Meer |
| View   | `src/lib/components/graph/GraphView.svelte`             | Connects store, canvas, sidebar and hover panel; runs the layout and the camera fit                                                                                     |
| Canvas | `src/lib/components/graph/GraphCanvas.svelte`           | Sigma renderer plus the HTML layers (halos, badges)                                                                                                                     |
| Store  | `src/lib/graph/graph-store.ts`, `src/lib/graph/store/*` | The nodes and edges on the canvas. Knows nothing of Sigma                                                                                                               |

The layers of the network are the groups of the panel Verbonden (`src/lib/verbonden/`), not a control of the sidebar; see [Layers](#layers). The API is reached through `$lib/api/client` (see [`api-client.md`](api-client.md)). Collection and relation names come from `src/lib/vocabulary.ts`; their meaning is in the API's `data-model.md`.

## Types

`src/lib/graph/types.ts` converts API nodes and edges to `GraphNode` and `GraphEdge`.

`GraphNodeKind` is what the canvas draws a node as. Several collections share a kind (`KIND_OF_COLLECTION`): `decisions`, `commitments`, `cases` and `activities` are all `activity`; version and annex collections are `other`. Because the map is a `Record<Collection, GraphNodeKind>`, a new collection in `vocabulary.ts` does not compile until it has a kind.

`GraphEdge` carries the API relation, a `label`, `confidence`, `status` and `meta`. Its category (`structural`, `mutation`, `semantic`) is computed by `edgeCategory(relation, sourceKind)`; `REFERS_TO` is structural between two articles and semantic from any other bron (a citation). The category decides which edges pass the semantic threshold. What is drawn is decided by the bronfilter (`hiddenKinds`, a kind that is not drawn and not laid out) and by `GraphFilters.hiddenRelations` (a relation the legend switched off); the canvas hides both in its reducers, the store keeps them.

`nodeToGraphNode` returns null for a collection the app does not know. `syntheticNode` builds a node from a list or detail response, without a request. Node `props` are untyped in the schema; read them defensively.

## Store

`createGraphStore()` in `graph-store.ts` spreads the slices of `store/` into one `GraphStore` (typed in `store/types.ts`, which is the reference for the methods).

| File              | Contents                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `context.ts`      | Node and edge maps, writable stores, the response cache, soft cap, derived nodes and edges, `mergeResponse` |
| `expansion.ts`    | `nodeResponse`, `expandNode`, `expandNeighborhood`                                                          |
| `view-actions.ts` | Selection, pinning, `showRows`/`hideRows`, filters, pruning, `sweepOrphans`, `reset`, `getEdgeById`         |
| `types.ts`        | `GraphStore`, `GraphFilters`, `CanvasRow`, `DEFAULT_FILTERS`, `SOFT_NODE_CAP`                               |

Each module is a factory that receives the context and returns part of the `GraphStore`. Scalars that several modules change (`seq`, `proxiesEnabled`) live on `ctx.state`; destructuring them would freeze a copy.

**One request per bron.** `nodeResponse(collection, key)` fetches `/api/nodes/{collection}/{key}` with `limit` 200, the most the API allows per bucket, caches the response by node id and joins concurrent callers. The canvas draws from it and the panel Verbonden reads it, so a bron is asked for once. `expandNode` merges the response and draws at most `neighborLimit` neighbours (30 by default); `expandNeighborhood` fetches every node and edge within `depth` hops in one request. Instruments are recorded in the instrument cache and not drawn as neighbours. Edges below `semanticThreshold` are dropped when merged.

**Soft cap.** `SOFT_NODE_CAP` is 400. A merge that passes it removes the oldest nodes that are not pinned, selected or next to the selection; `trimmedCount` counts them.

**Cancellation.** Requests carry the context's signal; `reset()` calls `supersede()`, which aborts every request still writing into the old canvas.

**Derived edges.** `emit()` rebuilds them on every change; their ids start with `synth:`.

- A document or judgment that relates to an article gets an edge to the instrument of that law, with the same relation and the label `via artikel`.
- Articles get a `PART_OF` edge to their instrument node; members get `MEMBER_OF` edges to factions from `faction_memberships`.

## Layers

`src/lib/verbonden/groups.ts` is the table kind of bron → groups, the one definition the panel renders. In Netwerk each group with drawable rows (a `relation` and a `direction`) carries a layer button: `store.showRows(focusId, rows)` puts the rows on the canvas, each with the verbinding that ties it to the focus (a `CanvasRow`; a row not on the canvas becomes a `syntheticNode`), and `store.hideRows(ids)` takes them off, sparing the selected and the pinned. A layer is "on" when every drawable row is on the canvas.

Groups are filled from the node response (`match`: relation, direction, collection, an optional `where`) or, where no edge says it, by a named loader in `loaders.ts` (the laws and committees of a dossier, the toelichting and citing judgments of an article, the international instruments of a law, ...). `bucketTotals` gives a group its total where the API states one; otherwise a bucket at the cap shows as `30+`.

## Expansion around a focus

The explore page (`src/routes/explore/+page.svelte`) expands a focus with one `expandNeighborhood` request of `?diepte` steps (1, 2 or 3; default 2; `cap` 200). The bronfilter decides what of it is drawn: a hidden kind is not drawn, not laid out, and its edges are not drawn. `sweepOrphans` then removes bronnen without an edge, because the force layout throws them far out and the camera fit zooms out to include them. `reseatAround` places the focus at the origin with its neighbours on a ring, and `fitWhenSettled` fits once the layout stops. The expansion runs once per focus and depth, in Netwerk, or when the mode switches to Netwerk with a focus loaded in Lezen.

The legend states what is on the canvas and what the bronfilter hides, with the counts of the panel Verbonden (`src/lib/verbonden/view.ts`), so both name the same numbers.

## Rendering

**Reducers.** Sigma calls `nodeReducer` and `edgeReducer` for every node and edge on each render. They read `latest*` variables that mirror the props, so a change of props is a variable update plus `renderer.refresh()`. Reducers return display data and never change the graphology graph.

**Camera.** `GraphView` is mounted in Netwerk only and is `compact` when a bron is selected. Module-level `_cam` keeps the camera per placement (`full`, `compact`), and `_camNodeIds` decides whether the graph is unchanged so the camera is restored instead of fitted. An additive change keeps the viewport.

**Hover.** In the full canvas a pointer that rests 400 ms on a node opens `GraphCitePanel`: the kind, a preview (an article's text is fetched) and one action, Openen, which is the same navigation as a click. The effective hover is `externalHoveredId ?? sigmaHoveredId`; the prop keeps the hover alive while the panel is open. Sigma orders edges by the `zIndex` attribute on the graphology edge, not by the reducer result, so the edges of the hovered node get the attribute set and reset.

**Layout.** ForceAtlas2 runs in a worker (`graphology-layout-forceatlas2/worker`), created on demand in `ensureLayout` and killed on destroy. Existing nodes are fixed while newcomers settle. After a load, call `suppressFit()` first and `fitWhenSettled()` last: the fit then waits until the worker has stopped.

**Colours.** `nodeSprites.ts` is the one place that defines colour and shape per kind and colour and line style per relation, and it reads every colour from the design tokens of `AppShell.svelte` once (`tokens()`, through `getComputedStyle`), so the canvas follows a token change after a reload. `KindGlyph`, the legend and the canvas read it. Edges: references between articles and the structure of the law in moss, citations by judgments in slate, EXPLAINS in plum, AMENDS, INTRODUCES and REPEALS in the accent (dashed when `voorgesteld`), PART_OF dotted. `DashedEdgeProgram.ts` holds the dashed and the dotted edge programs.

**Edges are selectable.** Sigma runs with `enableEdgeEvents`; a click on an edge (`onEdgeClick`) opens the card Verbinding (`src/lib/verbonden/VerbindingCard.svelte`, built by `verbindingOfEdge`) docked at the bottom left of the canvas, and the edge reducer widens the selected edge. On hover or selection the edge shows its label: `haalt aan, lid 2, r.o. 5.1`.

## Adding a node kind

1. Add the collection to `NODE_TYPES` and `BRON_LABEL` in `vocabulary.ts` if the API introduces one.
2. Give it a kind in `KIND_OF_COLLECTION`, or add a `GraphNodeKind`. The compiler then flags every `Record<GraphNodeKind, ...>` and switch that lacks an entry: `fillFor`, `strokeFor` and `KIND_SHAPE` in `nodeSprites.ts`, `NODE_SIZE` in `GraphView.svelte`. Give it a kind of bron for the filter in `bronKindOf` (`src/lib/verbonden/filter.ts`).
3. Extend `buildNodeLabel` if the label is not `display_name`.
4. Add its groups to `GROUPS` in `verbonden/groups.ts` and a reader in `KindReader.svelte` (see [`readers.md`](readers.md)).

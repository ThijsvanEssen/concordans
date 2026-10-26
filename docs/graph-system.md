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

`DrawClass` (`drawClass` on a `GraphNode`) is what the canvas draws a node as. Several collections share a class: `decisions`, `commitments`, `cases` and `activities` are all `activity`; version and annex collections are `other`. The role of each collection is one row of `COLLECTION_ROLE` (`src/lib/graph/collection-role.ts`): its class, the hull it is drawn as (a cabinet as a commissie's), whether it is asked and drawn as a neighbour of a focus (not a zaak or a version), and its column in a netwerk's first layout. Because the table is a `Record<Collection, …>`, a new collection in `vocabulary.ts` does not compile until it has a role.

`GraphEdge` carries the API relation, a `label`, `confidence`, `status` and `meta`. Its category (`structural`, `mutation`, `semantic`) is computed by `edgeCategory(relation, sourceKind)`; `REFERS_TO` is structural between two articles and semantic from any other bron (a citation). The category decides which edges pass the semantic threshold. What is drawn is decided by the bronfilter (`hiddenKinds`, a kind that is not drawn and not laid out) and by `GraphFilters.hiddenRelations` (a relation the legend switched off); the canvas hides both in its reducers, the store keeps them.

`nodeToGraphNode` returns null for a collection the app does not know. `syntheticNode` builds a node from a list or detail response, without a request. Node `props` are untyped in the schema; read them defensively.

## Store

`createGraphStore()` in `graph-store.ts` spreads the slices of `store/` into one `GraphStore` (typed in `store/types.ts`, which is the reference for the methods).

| File              | Contents                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `context.ts`      | Node and edge maps, writable stores, the response cache, soft cap, derived nodes and edges, `mergeResponse` |
| `expansion.ts`    | `nodeResponse`, `expandNode`, `expandNeighborhood`, `mergePaths`                                            |
| `compose.ts`      | `compose`: the composed netwerk of chosen bronnen, with what ties them (`/api/paths`)                       |
| `view-actions.ts` | Selection, pinning, `showRows`/`hideRows`, filters, pruning, `sweepOrphans`, `reset`, `getEdgeById`         |
| `types.ts`        | `GraphStore`, `GraphFilters`, `CanvasRow`, `DEFAULT_FILTERS`, `SOFT_NODE_CAP`                               |

Each module is a factory that receives the context and returns part of the `GraphStore`. A scalar that several modules change (`seq`) lives on `ctx.state`; destructuring it would freeze a copy.

**One request per bron.** `nodeResponse(collection, key)` fetches `/api/nodes/{collection}/{key}` with `limit` 200, the most the API allows per bucket, through `getNode` in `records.ts`, so the record is asked once per session. The canvas draws from it and the panel Verbonden reads it, so a bron is asked for once. `expandNode` merges the response and draws at most `neighborLimit` neighbours (30 by default); `expandNeighborhood` fetches every node and edge within `depth` hops in one request. Instruments are recorded in the instrument cache and not drawn as neighbours. Edges below `semanticThreshold` are dropped when merged.

**Soft cap.** `SOFT_NODE_CAP` is 400. A merge that passes it removes the oldest nodes that are not pinned, selected or next to the selection; `trimmedCount` counts them.

**Cancellation.** Requests carry the context's signal; `reset()` calls `supersede()`, which aborts every request still writing into the old canvas.

**Derived edges.** `emit()` rebuilds them on every change; their ids start with `synth:`.

- A document or judgment that relates to an article gets an edge to the instrument of that law, with the same relation and the label `via artikel`.
- Articles get a `PART_OF` edge to their instrument node; members get `MEMBER_OF` edges to factions from `faction_memberships`.

## The composed netwerk

The panel Netwerk (`src/lib/selection/NetwerkPanel.svelte`) holds chosen bronnen across focuses. They are in the URL (`?netwerk=`, switched off in `?uit=`, `?tussen=0` without the bronnen between them; `netwerk.ts`) and the last one in `localStorage`. `store.compose` draws the chosen bronnen, their verbindingen with each other, and the bronnen on the paths between them (`/api/paths`, up to four steps). A container two of them share is drawn as an anchor with a line to each; an anchor whose lines all go to members of its own hull is left out (`$lib/graph/anchor.ts`).

**Clusters.** More than `CLUSTER_MAX_LOOSE` (40) bronnen of one kind tied only to the focus and its other neighbours are drawn as one cluster bron ("250 uitspraken", `src/lib/selection/cluster.ts`); its card draws them all or opens their group in Verbonden. Where the cards over the canvas stand (a bron's, a cluster's, the Legenda under the panel Netwerk and which of the two folds) is `src/lib/selection/card-place.ts`.

## Layers

`src/lib/verbonden/groups.ts` is the table kind of bron → groups, the one definition the panel renders. In Netwerk each group with drawable rows (a `relation` and a `direction`) carries a layer button: `store.showRows(focusId, rows)` puts the rows on the canvas, each with the verbinding that ties it to the focus (a `CanvasRow`; a row not on the canvas becomes a `syntheticNode`), and `store.hideRows(ids)` takes them off, sparing the selected and the pinned. A layer is "on" when every drawable row is on the canvas.

Groups are filled from the node response (`match`: relation, direction, collection, an optional `where`) or, where no edge says it, by a named loader in `loaders.ts` (the laws and committees of a dossier, the toelichting and citing judgments of an article, the international instruments of a law, ...). `bucketTotals` gives a group its total where the API states one; otherwise a bucket at the cap shows as `30+`.

## Expansion around a focus

The explore page (`src/routes/explore/+page.svelte`) expands a focus with one `expandNeighborhood` request of `?diepte` steps (1 to 3; default 1 for a wet, fractie, commissie or dossier, else 2; `cap` 200). The bronfilter decides what of it is drawn: a hidden kind is not drawn, not laid out, and its edges are not drawn. `sweepOrphans` then removes bronnen without an edge, because the force layout throws them far out and the camera fit zooms out to include them. `reseatAround` (`ringAround`, `src/lib/graph/layout.ts`) places the focus at the origin with its neighbours on a ring, and `fitWhenSettled` fits once the layout stops. The expansion runs once per focus and depth, in Netwerk, or when the mode switches to Netwerk with a focus loaded in Lezen.

The legend states what is on the canvas and what the bronfilter hides, with the counts of the panel Verbonden (`src/lib/verbonden/view.ts`), so both name the same numbers. With nothing on the canvas it shows no filters, only that there are no bronnen yet. Beside a reader the canvas is compact and the legend is a button at its bottom left, clear of the panel Netwerk at the top; the reader keeps its width and the canvas takes what is left.

## Rendering

**Reducers.** Sigma calls `nodeReducer` and `edgeReducer` for every node and edge on each render. They read `latest*` variables that mirror the props, so a change of props is a variable update plus `renderer.refresh()`. Reducers return display data and never change the graphology graph.

**Camera.** `GraphView` is mounted in Netwerk only and is `compact` when a bron is selected. `camera.ts` keeps the camera per width (`full`, `compact`) across mounts, and `keepsCamera` decides whether the bronnen drawn before are all still there, so the camera is restored instead of fitted. An additive change keeps the viewport, except after `fitWhenSettled`: then the fit follows every burst of the new focus until the pointer enters the canvas, so the camera never moves under the reader's hand. `fit()` sets the box of the visible nodes and refreshes: sigma reads a custom box only when it processes the graph, so without the refresh the canvas kept the previous fit's scale until a hover. The nodes fill the canvas up to `STAGE_PADDING` (the hull margin); `fitBox` (`fit-box.ts`) keeps more free: `LABEL_ROOM` above for a hull's label, `ONDER_NAAM` below for a bron's name, and the side of what stands over the canvas (`[data-over-doek]`: the zoom).

**Names.** A bron's name on the canvas and in its list for the keyboard is its own (`canvas-names.ts`): a Kamerstuk with its dossier (not for the dossier in focus), and where two names are still the same, a judgment by its ECLI. `planLabels` (`label-place.ts`) places a frame's names, the focus and the chosen bronnen first, clear of each other, of the signs and of the hulls' names, at most `NAMES_PER_FRAME` (60); the rest wait for a hover. A hull's name keeps clear of the signs too; a wet drawn as its anchor alone is always named.

**Hover.** In the full canvas a pointer that rests 400 ms on a node opens `CanvasHoverCard`: the kind, a preview (an article's text is fetched) and one action, Openen, which is the same navigation as a click. The effective hover is `externalHoveredId ?? sigmaHoveredId`; the prop keeps the hover alive while the panel is open. Sigma orders edges by the `zIndex` attribute on the graphology edge, not by the reducer result, so the edges of the hovered node get the attribute set and reset.

**Edges at rest.** With a focus, its own verbindingen are drawn in their colour, mixed toward the paper as their number grows (`towardPaper`: opaque, because a low alpha on Sigma's transparent WebGL canvas blends toward white). A line between two other bronnen that touches a hull is left out until a hover; other such lines are a light trace in their own colour.

**Layout.** ForceAtlas2 runs in a worker (`graphology-layout-forceatlas2/worker`), created on demand in `ensureLayout` and killed on destroy. Existing nodes are fixed while newcomers settle. After a load, call `suppressFit()` first and `fitWhenSettled()` last: the fit then waits until the worker has stopped. The placements beside the worker are pure functions in `src/lib/graph/layout.ts`: `ringAround` (a new focus), `syncGroupLinks` (the layout-only edges that pull a hull's members together), `placeClusters` and `packGroups`. After each burst `packGroups` packs each drawn hull's members into a disk, pushes overlapping disks apart, and moves any other bron that landed in a disk to a band around it, so a judgment never reads as part of a law.

**Sprites.** Every node is an image of its vorm (`vormen.ts`): `spriteForVorm` draws the vorm on a canvas, plain, as a stub (its outline) or focused (an ink edge on a paper halo), and hands it over as a PNG. Sigma's image program is the only node program; it reads `color` as the ground behind the sprite, which a dimmed bron fills with the paper. Not as an SVG: sigma's image program draws its atlas once, as soon as an image has loaded, and Chrome may not have rasterized an SVG by then, which left documents and activities invisible.

**Where a verbinding lands.** `placeConnection` (`store/placement.ts`) decides it for every loader: a node response, a neighbourhood, the paths between chosen bronnen and the rows Verbonden puts on the canvas. A bron goes into the hull of a container it belongs to (`isContainerMembership`; "onderdeel van" always), a line ends at a container's anchor, a line ties two bronnen, or the verbinding stays off the canvas (a semantic one under the threshold). The loaders carry out what it returns; where they still differ, its `mode` names it. `placement-cases.test.ts` keeps where each kind of verbinding lands, per loader.

**A wet that is changed.** A wet is never a canvas node, only the hull of its articles. A stuk that AMENDS, INTRODUCES or REPEALS a wet whose articles are not on the canvas would lose that line, so the store draws the wet as an anchor (`GraphNode.anchor`, `placeConnection` in `store/placement.ts`): an invisible point that is a member of the wet's own hull, which then shows as a small bubble with the wet's name, and the change is drawn once, hull to hull: `GraphCanvas` hides the edges from a hull's members to an anchor and draws one thin, fine-dashed line with an arrowhead between the two outlines (`layoutHulls` in `hulls.ts`, cut with `exitPoint`), labelled with its relation while one of its hulls is in the hover. A dossier's changes lie two steps away (dossier, stuk, wet), so for a dossier focus the explore page asks for them in one extra neighbourhood request narrowed to those relations, which adds to the canvas instead of replacing it.

**Which hulls are drawn.** `isDrawnGroup` (`container-membership.ts`): a dossier's hull is drawn when it holds a stuk or zaak of its own (PART_OF, kept in `parts`) or is the focus. An activity about forty dossiers (a regeling van werkzaamheden) is a member of each of them, and would otherwise draw forty hulls around that one activity; it stays inside the dossier hulls that are drawn. Only drawn groups are packed in the layout. A commissie or fractie that the focused lid sat in is drawn when the seat (`periods`, from the edge's `meta.from_date` and `meta.to_date`) overlaps the years of the bronfilter, or, without them, the lid's moment (`momentOf`: today, or the day their last seat ended). The canvas hides a dated bron outside those years, as the panel does, and a bron left with nothing to show it by: in no drawn hull, and every line of it to a hidden bron.

**Hull hover.** A hull under the pointer (its shape or its label) shows a wet's full name instead of its abbreviation, as it does while a bron in it is hovered. While a bron or a hull is hovered, a hull that holds neither it nor a bron tied to it, and is not joined to one by a line, steps back.

**Hulls.** `layoutHulls` (`hulls.ts`) lays out the hulls, their names and the lines between them in screen pixels, from the graph and a projection; `GraphCanvas` draws what it returns. `hullOutline` (`src/lib/graph/hull.ts`) grows the convex hull of a group's points by `HULL_MARGIN`: each side moved out, each corner an arc around its point, so every member lies inside however few there are.

**Colours.** `nodeSprites.ts` is the one place that defines colour and line style per relation and the colour of a hull, and it reads every colour from the design tokens of `src/lib/styles/tokens.css` once (`tokens()`, through `getComputedStyle`), so the canvas follows a token change after a reload. The legend and the canvas read it; the shapes are `vormen.ts`, which `KindGlyph` draws too. Edges: references between articles and the structure of the law in moss, citations by judgments in slate, EXPLAINS in plum, AMENDS, INTRODUCES and REPEALS in the accent (dashed when `voorgesteld`), PART_OF dotted. `DashedEdgeProgram.ts` holds the dashed and the dotted edge programs.

**Edges are selectable.** Sigma runs with `enableEdgeEvents`; a click on an edge (`onEdgeClick`) opens the card Verbinding (`src/lib/verbonden/VerbindingCard.svelte`, built by `verbindingOfEdge`) docked at the bottom left of the canvas, and the edge reducer widens the selected edge. On hover or selection the edge shows its label: `haalt aan, lid 2, r.o. 5.1`.

## Adding a node kind

1. Sync the API (`npm run sync:api`) and copy lawgraph's `tests/data/relations.json`: the compiler then asks for the collection in `NODE_TYPES` and `BRON_LABEL` in `vocabulary.ts`.
2. Give it a row in `COLLECTION_ROLE`, with a class or a new `DrawClass`. The compiler then flags every `Record<DrawClass, ...>` and switch that lacks an entry: `NODE_SIZE` in `GraphView.svelte`. Give its collection a vorm in `VORM_VAN` (`src/lib/bron/vormen.ts`). Give it a filter group in `filterGroupOf` (`src/lib/verbonden/filter.ts`).
3. Extend `buildNodeLabel` if the label is not `display_name`.
4. Add its groups to `GROUPS` in `verbonden/groups.ts` and a reader in `explore/readers.ts` (see [`readers.md`](readers.md)).

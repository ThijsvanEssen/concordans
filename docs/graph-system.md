# Graph system

The network view is built in four layers. Each knows only the one below it.

| Layer  | File                                                    | Responsibility                                                                                                                                                          |
| ------ | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Legend | `src/lib/components/graph/GraphSidebar.svelte`          | The bronfilter (bronnen with counts, the preset), the relations with a line sample, depth, lid, what the canvas shows and hides; overlays and pinned bronnen under Meer |
| View   | `src/lib/components/graph/GraphView.svelte`             | Connects store, lanes, sidebar and hover panel; counts what the lanes draw                                                                                              |
| Lanes  | `src/lib/components/graph/LanesView.svelte`             | The scene of the canvas (`scene.ts`) as SVG in columns per soort, the lines as the Keten draws them                                                                     |
| Store  | `src/lib/graph/graph-store.ts`, `src/lib/graph/store/*` | The nodes and edges on the canvas. Knows nothing of the drawing                                                                                                         |

The werkplek (the canvas without a reader) has three strips: at the left the way back, the Weergave, the chosen bronnen and the Legenda with the filters; in the middle the weergave itself with the Tijdstrook under the canvas; at the right the card of the bron marked (on a phone a sheet under the canvas). The layers of the network are the groups of the panel Verbonden (`src/lib/verbonden/`), not a control of the sidebar; see [Layers](#layers). The API is reached through `$lib/api/client` (see [`api-client.md`](api-client.md)). Collection and relation names come from `src/lib/vocabulary.ts`; their meaning is in the API's `data-model.md`.

## Types

`src/lib/graph/types.ts` converts API nodes and edges to `GraphNode` and `GraphEdge`.

`DrawClass` (`drawClass` on a `GraphNode`) is what the canvas draws a node as. Several collections share a class: `decisions`, `commitments`, `cases` and `activities` are all `activity`; version and annex collections are `other`. The role of each collection is one row of `COLLECTION_ROLE` (`src/lib/graph/collection-role.ts`): its class, the hull it is drawn as (a wet, a dossier, a fractie, a commissie or a kabinet), whether it is asked and drawn as a neighbour of a focus (not a zaak or a version). Because the table is a `Record<Collection, …>`, a new collection in `vocabulary.ts` does not compile until it has a role.

`GraphEdge` carries the API relation, a `label`, `confidence`, `status` and `meta`. Its category (`structural`, `mutation`, `semantic`) is computed by `edgeCategory(relation, sourceKind)`; `REFERS_TO` is structural between two articles and semantic from any other bron (a citation). The category decides which edges pass the semantic threshold. What is drawn is decided by the bronfilter (`hiddenKinds`, a kind that is not drawn and not laid out) and by `GraphFilters.hiddenRelations` (a relation the legend switched off); the lanes hide both, the store keeps them.

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

**Soft cap.** `SOFT_NODE_CAP` is 1000, as high as the API keeps a neighbourhood of more than one step. A merge that passes it removes the oldest nodes that are not pinned, selected or next to the selection; `trimmedCount` counts them.

**Cancellation.** Requests carry the context's signal; `reset()` calls `supersede()`, which aborts every request still writing into the old canvas.

**Derived edges.** `emit()` rebuilds them on every change; their ids start with `synth:`.

- A document or judgment that relates to an article gets an edge to the instrument of that law, with the same relation and the label `via artikel`.
- Articles get a `PART_OF` edge to their instrument node; members get `MEMBER_OF` edges to factions from `faction_memberships`.

## The composed netwerk

The panel Netwerk (`src/lib/selection/NetwerkPanel.svelte`) holds chosen bronnen across focuses. They are in the URL (`?netwerk=`, switched off in `?uit=`, `?tussen=0` without the bronnen between them; `netwerk.ts`) and the last one in `localStorage`. `store.compose` draws the chosen bronnen, their verbindingen with each other, and the bronnen on the paths between them (`/api/paths`, up to four steps). A container two of them share is drawn as an anchor with a line to each; an anchor whose lines all go to members of its own hull is left out (`$lib/graph/anchor.ts`).

## Layers

`src/lib/verbonden/groups.ts` is the table kind of bron → groups, the one definition the panel renders. In Netwerk each group with drawable rows (a `relation` and a `direction`) carries a layer button: `store.showRows(focusId, rows)` puts the rows on the canvas, each with the verbinding that ties it to the focus (a `CanvasRow`; a row not on the canvas becomes a `syntheticNode`), and `store.hideRows(ids)` takes them off, sparing the selected and the pinned. A layer is "on" when every drawable row is on the canvas.

Groups are filled from the node response (`match`: relation, direction, collection, an optional `where`) or, where no edge says it, by a named loader in `loaders.ts` (the laws and committees of a dossier, the toelichting and citing judgments of an article, the international instruments of a law, ...). `bucketTotals` gives a group its total where the API states one; otherwise a bucket at the cap shows as `30+`.

## Expansion around a focus

The explore page (`src/routes/explore/+page.svelte`) expands a focus with one `expandNeighborhood` request of `?diepte` steps (1 to 3; default 1 for a wet, fractie, commissie or dossier, else 2). With a netwerk `?diepte` (0 to 3) is the one measure of its reach: Alleen gekozen (0) is the chosen bronnen and what ties them, 1 adds their direct neighbours (from the node responses already in), 2 and 3 add one additive `expandNeighborhood` per chosen bron that is on (`NetwerkComposer.#extend`, the same default per bron as above). The netwerk is the union; at most `REACH_MAX` (6) bronnen ask for steps, two requests at a time, each with `reachCap` (the canvas's room, `SOFT_NODE_CAP`, shared between them, 50 at least). Measured 28 Oct on prod: nearly every busy bron is cut off at the cap already at one step, so 2 and 3 steps add nothing there and Aantal stappen greys them out with the line `Maximaal N bronnen getoond.` and a `cap` of `NEIGHBORHOOD_CAP` (150 on every width). `?alles=1` asks one step up to `ALLES_GRENS` (2000, the API's most); a kind cut off links its whole, in its row of Tonen, to the table of Verbonden under that kind (`lijstHref`), not to more nodes. The bronfilter decides what of it is drawn: a hidden kind is not drawn, not laid out, and its edges are not drawn. `sweepOrphans` then removes bronnen without an edge, because the force layout throws them far out and the camera fit zooms out to include them. `reseatAround` (`ringAround`, `src/lib/graph/layout.ts`) places the focus at the origin with its neighbours on a ring, and `fitWhenSettled` fits once the layout stops. The expansion runs once per focus and depth, in Netwerk, or when the mode switches to Netwerk with a focus loaded in Lezen.

The legend states what is on the canvas and what the bronfilter hides, with the counts of the panel Verbonden (`src/lib/verbonden/view.ts`), so both name the same numbers. With nothing on the canvas it shows no filters, only that there are no bronnen yet. The legend is Verbonden: its counts are the ones the canvas draws.

## The weergaven of the werkplek

`?weergave=` chooses what the middle shows; `?kies=` is the bron marked in it. Beside the netwerk's own parameters (`?netwerk=`, `?uit=`, `?tussen=`, `?mode=netwerk`) these make up the address of the werkplek, which Lees and Back keep (`WERKPLEK_PARAMS`, `src/lib/nav/network.ts`).

| Weergave           | Shows                                                                                                                                                                                                                                                 | Source                                                          |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| Omgeving (default) | The canvas: the chosen bronnen, or a focus with its neighbours                                                                                                                                                                                        | `/api/nodes/{c}/{k}`, `/neighborhood`, `/api/paths`             |
| Verband            | What the chosen bronnen share, pair by pair, each shared bron with the lines by which it hangs at each (`SharedView.svelte`); at 2 and 3 steps (`?diepte`) also the ketens of a pair through laws and articles (`linkchains.ts`, `LinkChains.svelte`) | `/api/nodes/shared`, `/api/chains` (10 to 12 s cold: `slowApi`) |
| Keten              | A law, the articles it gives powers in and the regulations under them, in layers; above it the laws its preamble names (`ChainView.svelte`)                                                                                                           | `/api/instruments/{bwb}/delegated`, `/basis`                    |

`src/lib/network/*` holds the pure models behind Verband (`shared.ts`) and Keten (`chain.ts`; `lineage.ts` for the keten of a fractie, a lid and the other kinds of lineage) with their views, so the drawing on a wide screen and the list on a phone read one model. Soort and Relatie of a weergave count what it draws, and its filter hides it.

**Omgeving of a stuk.** A stuk, a zaak, a stemming, a toezegging or an activiteit asks its own neighbours from `/api/nodes/{collection}/{key}/surroundings` (`src/lib/graph/surroundings.ts`), never its dossier's members; they are put on the canvas as rows (`showRows`).

**Tijdstrook.** Under the canvas (`Tijdstrook.svelte`, the numbers in `$lib/bron/strook.ts`): one stacked bar per year from the first bron to the last, in the colours of the kinds (wetten, rechtspraak, kamerstukken, parlement), on a scale relative to the busiest year in view; a wetswijziging (a dated publication of the Staatsblad) is a diamond over the bar of its year. A hover or focus on a year gives the count per kind. A drag over the band or a tap on a year chooses the period, which the bronfilter holds (`?van`, `?tot`); the grips are sliders, so the keyboard chooses without dragging. At the left: the period in words (a tap opens the date fields, `ui/Periode`), the count per kind with the bronnen without a year, and the quick choices (Alle jaren, 5 jaar, Sinds de wijziging van JJJJ, Sinds…). The years stand under the bars (`TijdstrookAs.svelte`), as many as fit. A phone shows it small at rest; a tap opens a Blad with grips of 44 px.

**Address and waiting.** The chosen bronnen are in `?netwerk=`; `?uit=` lists those switched off, `?tussen=0` leaves out the bronnen between them. The calls of the werkplek wait as long as the API does (`slowApi`, 30 s); after 3 s the load says in one line that it takes longer than usual (`SlowLoad`).

## Rendering

**Names.** A bron's name in its list for the keyboard is its own (`canvas-names.ts`): where two names are the same, a judgment is told apart by its ECLI, a stuk by its dossier.

**Marking.** A click on a bron marks it (`?kies=`): its card stands in the strip at the right with one action, Lees, which reads the bron as a step of its own; Back brings the werkplek with the bron marked. `CanvasHoverCard` shows the card.

**Where a verbinding lands.** `placeConnection` (`store/placement.ts`) decides it for every loader: a node response, a neighbourhood, the paths between chosen bronnen and the rows Verbonden puts on the canvas. A bron goes into the hull of a container it belongs to (`isContainerMembership`; "onderdeel van" always), a line ends at a container's anchor, a line ties two bronnen, or the verbinding stays off the canvas (a semantic one under the threshold). The loaders carry out what it returns; where they still differ, its `mode` names it. `placement-cases.test.ts` keeps where each kind of verbinding lands, per loader.

**A wet that is changed.** A wet is never a canvas node, only the hull of its articles. A stuk that AMENDS, INTRODUCES or REPEALS a wet whose articles are not on the canvas would lose that line, so the store draws the wet as an anchor (`GraphNode.anchor`, `placeConnection` in `store/placement.ts`): a point that is a member of the wet's own hull, so the scene (`scene.ts`) can end the line of the change at the wet.

**Which hulls are drawn.** `isDrawnGroup` (`container-membership.ts`): a dossier's hull is drawn when it holds a stuk or zaak of its own (PART_OF, kept in `parts`) or is the focus. A ring holds only what is its own: a bron about more than one dossier (a wetgevingsoverleg on 36764 and 36765, a regeling van werkzaamheden on forty) stands in none of their rings, and each dossier is a point with a line "over" (`aboutEnd`); a stuk stays in the ring of its dossier (`PART_OF`). Only drawn groups are packed in the layout. A commissie or fractie that the focused lid sat in is drawn when the seat (`periods`, from the edge's `meta.from_date` and `meta.to_date`) overlaps the years of the bronfilter, or, without them, the lid's moment (`momentOf`: today, or the day their last seat ended). The canvas hides a dated bron outside those years, as the panel does, and a bron left with nothing to show it by: in no drawn hull, and every line of it to a hidden bron.

**A commissie.** A commissie that leads a dossier (`LED_BY`, derived by the API) is a point with a line _Onder leiding van_, never a ring around the dossier; its leden and the activiteiten it leads stand in its own ring. Around a commissie in focus its dossiers come the latest first (`sort=importance`, `withLatestFirst` in `led-by.ts`): the twelve latest are a point, the rest one cluster that names them all ("607 dossiers", `ledFolded` in `canvas-clusters.ts`). Tonen counts a commissie or dossier drawn as a ring or a point; on a phone a commissie's point keeps its short name.

**Soorten and colour.** The five soorten of the network are the rubrieken of the Topbalk (`src/lib/bron/rubrieken.ts`): Wetten, Rechtspraak, Kamerstukken, Parlement, Regering, each one colour (`--rubriek-*`, read once by `nodeSprites.ts`) and, below it, the soorten of bron (a wet, an artikel, a dossier, a stuk, a Kamerlid, a bewindspersoon, ...). A hull is told apart by its line as well as its colour: a wet solid, a dossier dashed, a fractie dotted, a commissie dash-dot, a kabinet dash-dot-dot. Tonen and Filter Soort list the soorten of Verbonden under the same names; Stuksoort (wetsvoorstellen, toelichtingen, overige) stands indented under the row of Stukken, without a heading. `rubrieken.test.ts` holds the table every place must agree with.

**Colours.** `nodeSprites.ts` is the one place that defines colour and line style per relation and the colour of a hull, and it reads every colour from the design tokens of `src/lib/styles/tokens.css` once (`tokens()`, through `getComputedStyle`), so the canvas follows a token change after a reload. The legend and the canvas read it; the shapes are `vormen.ts`, which `KindGlyph` draws too. Edges: references between articles and the structure of the law in moss, citations by judgments in slate, EXPLAINS in plum, AMENDS, INTRODUCES and REPEALS in the accent (dashed when `voorgesteld`), PART_OF dotted. `DashedEdgeProgram.ts` holds the dashed and the dotted edge programs.

## Adding a node kind

1. Sync the API (`npm run sync:api`) and copy lawgraph's `tests/data/relations.json`: the compiler then asks for the collection in `NODE_TYPES` and `BRON_LABEL` in `vocabulary.ts`.
2. Give it a row in `COLLECTION_ROLE`, with a class or a new `DrawClass`. The compiler then flags every `Record<DrawClass, ...>` and switch that lacks an entry: Give its collection a vorm in `VORM_VAN` (`src/lib/bron/vormen.ts`). Give it a filter group in `filterGroupOf` (`src/lib/verbonden/filter.ts`).
3. Extend `buildNodeLabel` if the label is not `display_name`.
4. Add its groups to `GROUPS` in `verbonden/groups.ts` and a reader in `explore/readers.ts` (see [`readers.md`](readers.md)).

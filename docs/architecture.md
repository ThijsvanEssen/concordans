# Architecture

## Stack

| Layer        | Choice                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| Framework    | SvelteKit 2, Svelte 5 runes. Data is fetched in the browser.                        |
| Network view | graphology (data) and Sigma 3 (WebGL). Halos and badges are HTML.                   |
| API          | The LawGraph API. Types come from its schema; see [`api-client.md`](api-client.md). |
| Tests        | Vitest for pure logic (`npm test`); `npm run check` for the rest.                   |

The API is read-only, so the app has no server route of its own: everything is fetched in the browser.

## Layout

```
src/routes/
  explore/+page.svelte        the explorer: Lezen, Netwerk, Bladeren (one page, the mode in the URL)
  (main)/                     pages with the site chrome: start page, docs, api, prose pages
src/lib/
  vocabulary.ts               collections, node types, relations, node ids, BRON_LABEL, MODES
  bron/                       bronHref (every link to a bron), anchor (landing on a position), KindGlyph
  api/                        client, generated types, helpers
  graph/                      GraphNode/GraphEdge types and GraphStore (store/*)
  verbonden/                  the panel Verbonden: groups, loaders, rows, the bronfilter (filter.ts),
                              the shared load (source.ts), the derived views (view.ts), the filter sheet,
                              the card Verbinding, the table
  text/                       article parts, qualifiers (lid, onderdeel), passages
  search/                     the search component and citation resolving
  components/{graph,explore,articles,parliamentary,layout}
  stores/                     overlay (URL parser), search-trigger
```

## Names

The API's names are the code's names: collections, relations, fields. Dutch appears in user-facing text and in values a source owns (document kinds, stage names, edge status `voorgesteld`).
`src/lib/vocabulary.ts` lists the collections and relations once, with `BRON_LABEL` (the one list of what each kind is called) and `MODES`. `src/lib/graph/types.ts` maps them to what the interface shows: node kind, edge category and line weight, node label. A table typed `Record<Relation, ...>` or `Record<Collection, ...>` fails the check when the API gains a name and the table does not. `src/lib/bron/KindGlyph.svelte` is the one glyph per kind: the shape and colour the kind has on the canvas.

## Modes

| Mode     | `mode`  | Shows                                                                                                                |
| -------- | ------- | -------------------------------------------------------------------------------------------------------------------- |
| Lezen    | `read`  | The reader at full width; for an article or a law `LezenNav` (table of contents) on the left; Verbonden on the right |
| Netwerk  | `graph` | The canvas; with a selection the canvas, the reader and Verbonden side by side                                       |
| Bladeren | `index` | `IndexView`: one category with filters and sorting                                                                   |

The panel Verbonden lists the verbindingen of the selected bron in groups; in Netwerk the same groups are the layers of the canvas. Column widths are resizable and kept in `localStorage`; narrow viewports show one column at a time.

## State

| State                                                         | Lives in                                 | Survives        |
| ------------------------------------------------------------- | ---------------------------------------- | --------------- |
| Mode, focus, naast, overlay, index category and filters       | URL query (see [`routes.md`](routes.md)) | reload, sharing |
| Nodes, edges, selection, pinned, filters, node response cache | `GraphStore`                             | mode switches   |
| The sequence of bronnen                                       | browser history                          | reload          |
| Anything else in one view                                     | component `$state`                       | the component   |

See [`state-and-stores.md`](state-and-stores.md).

## Data flow of `/explore`

The URL is parsed in `routes/explore/+page.svelte`. The effect on `focus` fetches the bron through `store.expandNode` and selects it; in Netwerk `deepen` then expands the neighbourhood around it and prunes (see [`graph-system.md`](graph-system.md#expansion-around-a-focus)). The effect on `overlay` fetches the active overlay. `GraphView` renders the store through `GraphCanvas`; `KindReader` picks the reader for the selected bron by collection; `Verbonden` reads the same cached node response as the canvas. Every link to a bron is `bronHref`, and a click on the canvas is a navigation to one.

## Commands

| Command             | Purpose                               |
| ------------------- | ------------------------------------- |
| `npm run dev`       | dev server on :5173                   |
| `npm run check`     | type check, including every API call  |
| `npm run lint`      | prettier and eslint                   |
| `npm test`          | Vitest                                |
| `npm run sync:api`  | fetch the schema and regenerate types |
| `npm run check:api` | `sync:api`, then fail on a diff       |

Environment: see `.env.example`.

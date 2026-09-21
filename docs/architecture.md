# Architecture

## Stack

| Layer        | Choice                                                                              |
| ------------ | ----------------------------------------------------------------------------------- |
| Framework    | SvelteKit 2, Svelte 5 runes. Data is fetched in the browser.                        |
| Network view | graphology (data) and Sigma 3 (WebGL). Halos and badges are HTML.                   |
| API          | The LawGraph API. Types come from its schema; see [`api-client.md`](api-client.md). |
| Tests        | Vitest for pure logic (`npm test`); `npm run check` for the rest.                   |

Only one server route exists: the write proxy under `src/routes/proxy`.

## Layout

```
src/routes/
  explore/+page.svelte        network, readers and index (one page, modes in the URL)
  (main)/                     pages with the site chrome: start page, search, publications,
                              nodes/[collection]/[key] (redirects to explore), docs, api, prose pages
  proxy/[...path]/+server.ts  write proxy
src/lib/
  vocabulary.ts               collections, node types, relations, node ids
  api/                        client, generated types, small helpers
  graph/                      GraphNode/GraphEdge types and GraphStore (store/*)
  components/{graph,explore,parliamentary,articles,layout,home,ui}
  stores/                     overlay (URL parser), reader, search-trigger, watches
  server/                     write proxy rules
```

## Names

The API's names are the code's names: collections, relations, fields. Dutch appears in user-facing text and in values a source owns (document kinds, stage names, edge status `voorgesteld`).
`src/lib/vocabulary.ts` lists the collections and relations once. `src/lib/graph/types.ts` maps them to what the interface shows: node kind, edge category and line weight, node label. A table typed `Record<Relation, ...>` or `Record<Collection, ...>` fails the check when the API gains a name and the table does not.

## State

| State                              | Lives in                                 | Survives        |
| ---------------------------------- | ---------------------------------------- | --------------- |
| Mode, focus, overlay, index filter | URL query (see [`routes.md`](routes.md)) | reload, sharing |
| Nodes, edges, selection, history   | `GraphStore`                             | mode switches   |
| Anything else in one view          | component `$state`                       | the component   |

See [`state-and-stores.md`](state-and-stores.md).

## Data flow of `/explore`

The URL is parsed in `routes/explore/+page.svelte`. Effects keyed on `focus`, `seed` and `overlay` call the store (`expandNode`, `expandNeighborhood`, `load*`) or the overlay helpers; results land in the store or in page state. `GraphView` renders the store through `GraphCanvas`; `KindReader` picks the reader for the selected source by collection.

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

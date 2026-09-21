# Routes

Every URL, and the query parameters it reads. The URL holds anything that can be linked to.

| URL                                                          | Purpose                                                                                                 |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `/`                                                          | Start page                                                                                              |
| `/explore`                                                   | Network, readers and index                                                                              |
| `/search`                                                    | Search results (`q`)                                                                                    |
| `/publications`                                              | Parliamentary documents: index, filtered by title and kind                                              |
| `/publications/[key]`                                        | One document (`/api/documents/{key}`)                                                                   |
| `/nodes/[collection]/[key]`                                  | Permalink of a source; redirects to `/explore?mode=split&focus=...`. An unknown collection answers 404. |
| `/docs`, `/docs/methode`, `/docs/sneltoetsen`                | In-app documentation for users                                                                          |
| `/api`                                                       | API reference rendered from `src/lib/api/openapi.json`                                                  |
| `/alpha`, `/colofon`, `/contact`, `/privacy`, `/voorwaarden` | Prose pages                                                                                             |
| `/proxy/api/watches`                                         | Write proxy (server route); see [`api-client.md`](api-client.md#writes)                                 |

## `/explore` query

| Param         | Values                                                                                                                  | Effect                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `mode`        | `graph` (default), `split`, `read`, `index`                                                                             | Which surface. The store persists across modes.                         |
| `focus`       | `{collection}/{key}`, e.g. `articles/bwbr0001854_287`                                                                   | Source to focus and expand. Stays in the URL.                           |
| `seed`        | `dossier:{number}`, `committee:{slug}`, `member:{key}`, `faction:{key}`                                                 | One-shot start of a network; removed from the URL once used.            |
| `overlay`     | `heat:{months}`, `open`, `dossier:{number}`                                                                             | See [`overlays.md`](overlays.md).                                       |
| `wet`         | BWB id                                                                                                                  | Read mode: the law to show. Taken from `focus` when absent.             |
| `kind`        | `instruments`, `judgments`, `dossiers`, `committees`, `members`, `factions`, `decisions`                                | Index category (default `dossiers`).                                    |
| index filters | `q`, `stage`, `has_stage`, `track`, `passed`, `from`, `to`, `dossier`, `party`, `court`, `tier`, `jurisdiction`, `sort` | Which apply depends on `kind`. Those the API filters on are sent to it. |

Modes: `graph` is the network with its sidebar; `split` adds the reader and the citation rail; `read` shows the reader only (whole law); `index` lists one category.
Keys: `1` network, `2` split, `3` read. Split and read need a selected source.

## `/search`

`q` is the query. The page asks `/api/search` for 50 hits per type; the overlay (cmd-K) asks for one more than it shows. Anchors `#articles`, `#instruments`, `#judgments`, `#dossiers`, `#committees`, `#factions`, `#members`, `#documents` link to a group.

## Adding a query parameter to `/explore`

Read it in `routes/explore/+page.svelte` in a `$derived`, write it with `goto(url, { replaceState: true, noScroll: true, keepFocus: true })`, and add it to the table above.

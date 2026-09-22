# Routes

Every URL and the query parameters it reads. The URL holds anything that can be linked to.

| URL                                                          | Purpose                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `/`                                                          | Start page: the search field and links into Bladeren by kind            |
| `/explore`                                                   | The explorer: Lezen, Netwerk and Bladeren                               |
| `/docs`, `/docs/methode`, `/docs/sneltoetsen`                | Documentation for users                                                 |
| `/api`                                                       | API reference rendered from `src/lib/api/openapi.json`                  |
| `/alpha`, `/colofon`, `/contact`, `/privacy`, `/voorwaarden` | Prose pages                                                             |
| `/proxy/[...path]`                                           | Write proxy (server route); see [`api-client.md`](api-client.md#writes) |

## `/explore` query

| Param         | Values                                                                                                                                                            | Effect                                                                                                 |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `mode`        | `read` (Lezen), `graph` (Netwerk, default), `index` (Bladeren)                                                                                                    | Which surface. The store persists across modes.                                                        |
| `focus`       | `{collection}/{key}`, e.g. `articles/bwbr0001854_287`                                                                                                             | The selected bron: read, and in Netwerk expanded around.                                               |
| `naast`       | `{collection}/{key}` of a document                                                                                                                                | A toelichting opened beside the article; the article stays the selected bron. A mode switch clears it. |
| `overlay`     | `open`, `dossier:{number}`, `heat:{months}`                                                                                                                       | See [`overlays.md`](overlays.md).                                                                      |
| `kind`        | `instruments`, `judgments`, `dossiers`, `committees`, `members`, `factions`, `decisions`                                                                          | Bladeren category (default `dossiers`).                                                                |
| index filters | `q`, `stage`, `has_stage`, `track`, `passed`, `from`, `to`, `dossier`, `party`, `jurisdiction`, `court`, `tier`, `sort`, `dir`, `only_active`, `include_inactive` | Which apply depends on `kind`; switching `kind` drops them. Those the API filters on are sent to it.   |

The fragment is the position inside the text: `#lid-2`, `#lid-2-onder-a`, `#aanhef` in an article, `#rov-5.3` in a judgment. `src/lib/bron/anchor.ts` scrolls to the element with that id and marks it.

Keys `1`, `2`, `3` switch to Lezen, Netwerk, Bladeren (`MODES` in `src/lib/vocabulary.ts`). Lezen without a `focus` shows nothing; Netwerk without one shows the canvas alone.

## Links to a bron

`bronHref(ref, { at, keepMode, mode })` in `src/lib/bron/href.ts` builds every link to a bron; nothing else writes `?focus=`. It keeps the `mode` and `overlay` of the view it stands in, so reading stays reading and the network stays the network. From Bladeren, or with `keepMode: false`, it opens in `mode` (default `read`). `at` becomes the fragment.

Every link is a navigation, so the browser history is the history of bronnen. The back and forward buttons of the status bar and the arrow keys of the canvas call `history.back()` and `history.forward()`. A click on the canvas is `goto(bronHref(node))`.

## Adding a query parameter

Read it in `routes/explore/+page.svelte` in a `$derived`, write it with `setUrl` (`goto` with `replaceState`, `noScroll`, `keepFocus`), and add it to the table above. A parameter that belongs to the view and must travel with a link to a bron goes in `KEPT_PARAMS` of `href.ts`.

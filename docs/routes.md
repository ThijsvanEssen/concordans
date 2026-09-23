# Routes

Every URL and the query parameters it reads. The URL holds anything that can be linked to.

| URL                                                          | Purpose                                                                 |
| ------------------------------------------------------------ | ----------------------------------------------------------------------- |
| `/`                                                          | Start page: the search field and links into Bladeren by kind            |
| `/explore`                                                   | The explorer: Lezen, Netwerk and Bladeren                               |
| `/docs`, `/docs/methode`, `/docs/sneltoetsen`                | Documentation for users                                                 |
| `/api`                                                       | API reference rendered from `src/lib/api/openapi.json`                  |
| `/alpha`, `/colofon`, `/contact`, `/privacy`, `/voorwaarden` | Prose pages                                                             |

## `/explore` query

| Param             | Values                                                                                                                                                            | Effect                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| `mode`            | `read` (Lezen), `graph` (Netwerk, default), `index` (Bladeren)                                                                                                    | Which surface. The store persists across modes.                                                               |
| `focus`           | `{collection}/{key}`, e.g. `articles/bwbr0001854_287`                                                                                                             | The selected bron: read, and in Netwerk expanded around.                                                      |
| `naast`           | `{collection}/{key}` of a document                                                                                                                                | A toelichting opened beside the article; the article stays the selected bron. A mode switch clears it.        |
| `overlay`         | `open`, `dossier:{number}`, `heat:{months}`                                                                                                                       | See [`overlays.md`](overlays.md).                                                                             |
| `kind`            | `instruments`, `judgments`, `dossiers`, `committees`, `members`, `factions`, `decisions`                                                                          | Bladeren category (default `dossiers`).                                                                       |
| `tabel`           | `1`                                                                                                                                                               | In Lezen: every verbinding of the bron as a table instead of the text and the panel.                          |
| `diepte`          | `1`, `2` (default), `3`                                                                                                                                           | Steps from the focus the network loads.                                                                       |
| `bronnen`         | Comma-separated kinds: `artikelen`, `wetten`, `uitspraken`, `toelichtingen`, `wetsvoorstellen`, `dossiers`, `internationaal`; absent means all                    | The bronfilter: which kinds of bron take part in the panel, the margin, the canvas, the legend and the table. |
| `lid`             | `2`, or `geen` for verbindingen that name no lid                                                                                                                  | Only the verbindingen that name that lid of the article.                                                      |
| `rechter`         | `hr`, `hof`, `rechtbank`, `rvs`, `ehrm`                                                                                                                           | Only judgments of that court.                                                                                 |
| `van`, `tot`      | Years                                                                                                                                                             | Period of the source.                                                                                         |
| `geldend`         | `YYYY-MM-DD`                                                                                                                                                      | Verbindingen in force on that date, instead of a period.                                                      |
| `betrouwbaarheid` | `bron` (read from the source), `afgeleid`                                                                                                                         | Only verbindingen of that betrouwbaarheid.                                                                    |
| `status`          | `vastgesteld`, `voorgesteld`                                                                                                                                      | Only verbindingen of that status.                                                                             |
| `jaar`            | A year                                                                                                                                                            | One year, chosen in the bar chart of the judgments.                                                           |
| `zoek`            | Text                                                                                                                                                              | Text within the current verbindingen.                                                                         |
| index filters     | `q`, `stage`, `has_stage`, `track`, `passed`, `from`, `to`, `dossier`, `party`, `jurisdiction`, `court`, `tier`, `sort`, `dir`, `only_active`, `include_inactive` | Which apply depends on `kind`; switching `kind` drops them. Those the API filters on are sent to it.          |

The fragment is the position inside the text: `#lid-2`, `#lid-2-onder-a`, `#aanhef` in an article, `#rov-5.3` in a judgment. `src/lib/bron/anchor.ts` scrolls to the element with that id and marks it.

Keys `1`, `2` switch to Lezen and Netwerk, the two views of a selected bron. Bladeren is a place to go, not a view of one, so it has no key and no tab in `StatusBar`; it opens from the top nav or a `bronHref` with `mode: 'index'`. Lezen without a `focus` shows nothing; Netwerk without one shows the canvas alone.

## Links to a bron

`bronHref(ref, { at, keepMode, mode })` in `src/lib/bron/href.ts` builds every link to a bron; nothing else writes `?focus=`. It keeps the `mode`, the `overlay`, the bronfilter (`bronnen`, `rechter`, `van`, `tot`, `geldend`, `betrouwbaarheid`, `status`) and `diepte` of the view it stands in, so reading stays reading, the network stays the network, and the choice of bronnen holds from one bron to the next. `lid`, `jaar`, `zoek` and `tabel` name a place in one bron and stay behind.

The filter is parsed once, in `explore/+page.svelte` (`parseFilter` in `src/lib/verbonden/filter.ts`), into one object that the panel, the reader, the canvas, the legend and the table read. It is never kept in a store. From Bladeren, or with `keepMode: false`, it opens in `mode` (default `read`). `at` becomes the fragment.

Every link is a navigation, so the browser history is the history of bronnen. The back and forward buttons of the status bar and the arrow keys of the canvas call `history.back()` and `history.forward()`. A click on the canvas is `goto(bronHref(node))`.

## Adding a query parameter

Read it in `routes/explore/+page.svelte` in a `$derived`, write it with `setUrl` (`goto` with `replaceState`, `noScroll`, `keepFocus`), and add it to the table above. A parameter that belongs to the view and must travel with a link to a bron goes in `KEPT_PARAMS` of `href.ts`.

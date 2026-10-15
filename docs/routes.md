# Routes

## Pages

| URL                                             | Purpose                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `/gemarkeerd`                                   | The maps a reader keeps, and a shared map (`?map=`)                               |
| `/onderwerpen`, `/onderwerpen/overzicht`        | Followed topics, and one topic's overview                                         |
| `/`                                             | Start page: search with four scopes, each linking into Bladeren; Actueel in short |
| `/actueel`                                      | What came in per day, with filters in the URL and an Atom feed                    |
| `/explore`                                      | The Verkenner                                                                     |
| Readable addresses (below)                      | The Verkenner, for one bron                                                       |
| `/docs`, `/docs/methode`, `/docs/sneltoetsen`   | Documentation for users                                                           |
| `/api`                                          | API reference, rendered from `src/lib/api/openapi.json`                           |
| `/over`, `/bronnen`, `/privacy`, `/voorwaarden` | Prose pages                                                                       |

## Readable addresses

`src/hooks.ts` serves these paths with the Verkenner; `src/lib/bron/address.ts` reads and writes them, one rule per kind (`ADDRESS_RULES`). The address of a bron is the `path` the API gives it; the front end makes one only where the key is in it (a judgment, a law, a dossier by its number, a cabinet, a fractie, a stemming, a publication).

| Bron        | Address                                                      | Focus                            |
| ----------- | ------------------------------------------------------------ | -------------------------------- |
| judgment    | `/uitspraken/ECLI:NL:HR:2019:2006`                           | from the ECLI                    |
| article     | `/wetten/BWBR0005289/artikel/6:162`                          | `/api/lookup` kind `article`     |
| dossier     | `/dossiers/36600-VIII`                                       | from the number                  |
| Kamerstuk   | `/kamerstukken/36799/31`, `/kamerstukken/36600-VIII/AB` (EK) | `/api/lookup` kind `document`    |
| publication | `/stb/2026/94`, `/stcrt/…`, `/trb/…`                         | `/api/lookup` kind `publication` |
| lid         | `/leden/rob-jetten`                                          | `/api/lookup` kind `member`      |
| cabinet     | `/kabinetten/rutte_iv`                                       | from the key                     |
| fractie     | `/fracties/d66`                                              | from the key                     |
| commissie   | `/commissies/szw`                                            | `/api/lookup` kind `committee`   |
| toezegging  | `/toezeggingen/TZ202609-124`                                 | `/api/lookup` kind `commitment`  |

A bron the API gives no `path` stays under `/explore?focus=`. A lookup that answers 404 `not_in_data` reads "… staat niet in de gegevens".

## Query of the Verkenner

| Param                 | Values                                                                                             | Effect                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `focus`               | `{collection}/{key}`; a dossier by number, `dossiers/37020-XV`                                     | The bron, where the path is not a readable address                                            |
| `lezen`               | `1`                                                                                                | Tekst: the reader at full width (articles, laws, judgments, documents)                        |
| `mode`                | `index`                                                                                            | Bladeren                                                                                      |
| `kind`                | the keys of `src/lib/components/explore/index/categories.ts`                                       | The Bladeren category; without it, the overview                                               |
| index filters         | `FILTER_PARAMS` in `src/lib/components/explore/index/lists/params.ts`                              | Which apply depends on `kind`; switching `kind` drops them                                    |
| `open`                | `{collection}/{key}`                                                                               | In Bladeren: the bewindspersoon opened in the cabinet strip; other rows open the bron at once |
| `naast`               | `{collection}/{key}` of a document                                                                 | A toelichting beside the article                                                              |
| `tabel`               | `1`                                                                                                | Every verbinding of the bron as a table                                                       |
| `diepte`              | `1` to `3`; default 1 for a wet, fractie, commissie or dossier, else 2                             | Steps from the focus the network loads                                                        |
| `netwerk`             | comma-separated node ids                                                                           | The chosen bronnen of a composed netwerk ([`graph-system.md`](graph-system.md))               |
| `uit`                 | node ids                                                                                           | Chosen bronnen switched off                                                                   |
| `tussen`              | `0`                                                                                                | Without the bronnen between the chosen ones                                                   |
| `overlay`             | `open`, `heat:{months}`                                                                            | [`overlays.md`](overlays.md)                                                                  |
| `versies`             | `van..tot` (the dates two versions took effect), or `lid-4`                                        | Two versions of an article compared, or one lid through its versions                          |
| `weergave`            | `naast`                                                                                            | The comparison side by side                                                                   |
| `peildatum`           | `YYYY-MM-DD`                                                                                       | A law or article as it stood on that date                                                     |
| bronfilter            | `bronnen`, `rechter`, `van`, `tot`, `geldend`, `betrouwbaarheid`, `status` (`verbonden/filter.ts`) | Which verbindingen the panel, the canvas, the legend and the table show                       |
| `lid`, `jaar`, `zoek` | a lid, a year, text                                                                                | A place within the verbindingen of one bron                                                   |

The fragment is a position in the text: `#lid-2-onder-a`, `#aanhef` in an article, `#rov-5.3` in a judgment. `bron/landing.ts` scrolls to it and marks it.

The key `L` switches between Netwerk and Tekst. Bladeren opens from the top nav.

## Links to a bron

`bronHref(ref, { at, keepMode, mode, keepNetwerk })` in `src/lib/bron/href.ts` builds every link to a bron, as its readable address where it has one. It keeps the view it stands in: Tekst stays Tekst, and `KEPT_PARAMS` (overlay, bronfilter, `diepte`, `netwerk`, `uit`, `tussen`) travel along. `lid`, `jaar`, `zoek` and `tabel` stay behind. From outside the Verkenner, or from Bladeren, a readable bron opens in Tekst and any other in Netwerk. `indexHref` builds a link into Bladeren.

`BronLink` (`src/lib/bron/BronLink.svelte`) is the reference to a bron in a reader, a list or a timeline. A click opens the bron in the Verkenner in Netwerk (`keepMode: false, mode: 'graph'`), Lees one step from there; a position (`at`) in the bron on screen is a jump within the page. Hover or focus shows a card after 350 ms, from `loadPreview` (`preview.ts`): the kind, the name and a date, and per kind what places it: a stuk its dossier and indieners with their fractie, a motie or amendement the vote on its zaak (`Aangenomen, 137 voor en 13 tegen`, one request more), a judgment the first sentence of its summary, an article its first lid or the part named. The card has no buttons and stands in the top layer (`actions/top-layer.ts`), below the link or above it where the screen ends; a scroll closes it. On touch a tap opens the bron without a card.

A dossier is linked by its number: a `BronRef` of a dossier carries `number` next to its key (`refOf` reads it from `props.label`).

## Adding a query parameter

Read it in `routes/explore/explore-url.ts` as a pure function of the query, derive it in `routes/explore/+page.svelte`, write it with `setUrl` (`goto` with `replaceState`, `noScroll`, `keepFocus`), and add it to the table above. A parameter that must travel with a link to a bron goes in `KEPT_PARAMS`.

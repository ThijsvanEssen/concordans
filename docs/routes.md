# Routes

## Pages

| URL                                             | Purpose                                                                           |
| ----------------------------------------------- | --------------------------------------------------------------------------------- |
| `/bundels`                                      | The bundels a reader keeps, a list; a shared bundel (`#m=`) opens as its page     |
| `/bundels/[id]`                                 | One bundel on a page of its own: to work in, to read and to print (PDF)           |
| `/onderwerpen`, `/onderwerpen/overzicht`        | Followed topics, and one topic's overview                                         |
| `/`                                             | Start page: search with four scopes, each linking into Bladeren; Actueel in short |
| `/actueel`                                      | What came in per day, with filters in the URL and an Atom feed                    |
| `/zoeken`                                       | Results of a query per soort, with facets and pages; not indexed                  |
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

| Param                 | Values                                                                                                                          | Effect                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `focus`               | `{collection}/{key}`; a dossier by number, `dossiers/37020-XV`                                                                  | The bron, where the path is not a readable address                                            |
| `mode`                | `netwerk`                                                                                                                       | The werkplek with the bron; without it a bron opens in Tekst                                  |
| `toon`                | `netwerk`                                                                                                                       | A link of before: on a phone, opens Verbonden (where the network is drawn)                    |
| `mode`                | `index`                                                                                                                         | Bladeren                                                                                      |
| `kind`                | the keys of `src/lib/components/explore/index/categories.ts`                                                                    | The Bladeren category; without it, the overview                                               |
| index filters         | `FILTER_PARAMS` in `src/lib/components/explore/index/lists/params.ts`                                                           | Which apply depends on `kind`; switching `kind` drops them                                    |
| `open`                | `{collection}/{key}`                                                                                                            | In Bladeren: the bewindspersoon opened in the cabinet strip; other rows open the bron at once |
| `naast`               | `{collection}/{key}` of a document                                                                                              | A toelichting beside the article                                                              |
| `tabel`               | `1`                                                                                                                             | Every verbinding of the bron as a table                                                       |
| `diepte`              | `0` to `3` (0 only with a netwerk: Alleen gekozen); default 1 for a wet, fractie, commissie or dossier, else 2, per chosen bron | Steps from the chosen bronnen (the focus without a netwerk) the network loads                 |
| `netwerk`             | comma-separated node ids                                                                                                        | The chosen bronnen of a composed netwerk ([`graph-system.md`](graph-system.md))               |
| `uit`                 | node ids                                                                                                                        | Chosen bronnen switched off                                                                   |
| `tussen`              | `0`                                                                                                                             | Without the bronnen between the chosen ones                                                   |
| `overlay`             | `open`, `heat:{months}`                                                                                                         | [`overlays.md`](overlays.md)                                                                  |
| `versies`             | `van..tot` (the dates two versions took effect), or `lid-4`                                                                     | Two versions of an article compared, or one lid through its versions                          |
| `weergave`            | `naast`                                                                                                                         | The comparison side by side                                                                   |
| `peildatum`           | `YYYY-MM-DD`                                                                                                                    | A law or article as it stood on that date                                                     |
| bronfilter            | `bronnen`, `rechter`, `van`, `tot`, `geldend`, `betrouwbaarheid`, `status` (`verbonden/filter.ts`)                              | Which verbindingen the panel, the canvas, the legend and the table show                       |
| `lid`, `jaar`, `zoek` | a lid, a year, text                                                                                                             | A place within the verbindingen of one bron                                                   |

The fragment is a position in the text: `#lid-2-onder-a`, `#aanhef` in an article, `#rov-5.3` in a judgment. `bron/landing.ts` scrolls to it and marks it.

The key `L` switches between Netwerk and Tekst. Bladeren opens from the top navigation (below).

## Navigation

The top bar names the kinds of source: Wetten, Uitspraken, Kamerstukken, Parlement, Regering and Actueel; at the right the search field, the Netwerk button and the menu Mijn (Bundels, Gevolgd). `src/lib/nav/sources.ts` holds the list: a source is a list of Bladeren (`kind`) or, for Kamerstukken, Parlement and Regering, three; the page of a bron stands under the source of its kind (`sourceOf`), which the bar marks and the first link of the band Behoort bij names (Wetten ›). The lists of one source are the strip above its list in Bladeren; a source of one list has none. `/explore?mode=index` without a `kind` is the overview of all lists.

Netwerk is a tool, not a source (`src/lib/nav/network.ts`): on a bron it opens the werkplek with that bron (`mode=netwerk`): its surroundings, or, where the reader composed a netwerk, that netwerk written into the address (`$lib/selection/bewaard.svelte.ts` keeps what the reader chose, never what a link brought). The address is the state: a clean `?mode=netwerk` draws the same in every browser. `uit` lists what is switched off, in one list: chosen bronnen, relations of the legend and groupings (`$lib/selection/off.ts`). `/explore?toon=netwerk` with netwerk params is carried to `mode=netwerk` (`legacy-address.ts`); elsewhere the werkplek without a bron, which begins with choosing one. The button counts the bronnen of the netwerk ("Netwerk 2"). "Open in netwerk" in the head of Verbonden and the block on the start page lead to the same werkplek. Lees on a marked bron reads it, a step of its own; the werkplek's address (`netwerk`, `uit`, `tussen`, `omgeving`, `kies`, `weergave`) stays in the history. The werkplek has three strips (bronnen and filters, the canvas with its tijdstrook, the card of the bron marked) and three weergaven (`?weergave`): Omgeving, the canvas in sectors per kind around the chosen bronnen (`radialLayout`, `$lib/graph/layout.ts`); Verband, what the chosen bronnen share (`/api/nodes/shared`, else the bronnen between on the canvas, marked onvolledig; `$lib/network/shared.ts`); Keten, a law with its articles and the regulations under them in layers (`/delegated`, `/basis`; `$lib/network/chain.ts`). Below 768 px the bar holds the logo and the Netwerk icon (44 px), and the tab bar (`TabBar`) holds Zoeken, Bladeren, Actueel and Mijn; Bladeren and Mijn open a sheet.

## Links to a bron

`bronHref(ref, { at, keepMode, mode, keepNetwerk })` in `src/lib/bron/href.ts` builds every link to a bron, as its readable address where it has one. It keeps the view it stands in: Tekst stays Tekst, and `KEPT_PARAMS` (overlay, bronfilter, `diepte`, and within the werkplek `netwerk`, `uit`, `tussen`) travel along; a bron read leaves the netwerk behind. `lid`, `jaar`, `zoek` and `tabel` stay behind. From outside the Verkenner, or from Bladeren, a bron opens in Tekst; `mode: 'graph'` opens it on the canvas (`?mode=netwerk`). `indexHref` builds a link into Bladeren.

`BronLink` (`src/lib/bron/BronLink.svelte`) is the reference to a bron in a reader, a list or a timeline. A click opens the bron in Tekst (`openHref`), its network one step from there; a position (`at`) in the bron on screen is a jump within the page. Hover or focus shows a card after 350 ms, from `loadPreview` (`preview.ts`): the kind, the name and a date, and per kind what places it: a stuk its dossier and indieners with their fractie, a motie or amendement the vote on its zaak (`Aangenomen, 137 voor en 13 tegen`, one request more), a judgment the first sentence of its summary, an article its first lid or the part named. The card has no buttons and stands in the top layer (`actions/top-layer.ts`), below the link or above it where the screen ends; a scroll closes it. On touch a tap opens the bron without a card.

A dossier is linked by its number: a `BronRef` of a dossier carries `number` next to its key (`refOf` reads it from `props.label`).

## Adding a query parameter

Read it in `routes/explore/explore-url.ts` as a pure function of the query, derive it in `routes/explore/+page.svelte`, write it with `setUrl` (`goto` with `replaceState`, `noScroll`, `keepFocus`), and add it to the table above. A parameter that must travel with a link to a bron goes in `KEPT_PARAMS`.

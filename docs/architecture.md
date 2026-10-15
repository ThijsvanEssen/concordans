# Architecture

## Stack

| Layer        | Choice                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------ |
| Framework    | SvelteKit 2, Svelte 5 runes; a static build that fetches everything in the browser         |
| Network view | graphology (data) and Sigma 3 (WebGL); hulls, halos and badges are HTML or SVG             |
| API          | The LawGraph API, read-only; types come from its schema ([`api-client.md`](api-client.md)) |
| Tests        | Vitest for pure logic (`npm test`); `npm run check` for the rest                           |

## Layout

```
src/hooks.ts                  reroute: a readable address (/dossiers/36799, …) is served by explore/
src/routes/
  explore/+page.svelte        the Verkenner: Netwerk, Tekst and Bladeren on one page, the view in the URL
  explore/explore-url.ts      the Verkenner's state from its address, as pure functions; panels.ts the three layers
  explore/*.svelte.ts         its parts with state: column widths, the netwerk composer, the overlay counts
  (main)/                     pages with the site chrome: start page, actueel, docs, api
  (main)/(prose)/             colofon, contact, privacy, voorwaarden
src/lib/
  vocabulary.ts               collections, relations, node ids, BRON_LABEL, MODES
  bron/                       bronHref (every link to a bron), leesbaar (readable addresses), anchor,
                              BronLink (opens in Netwerk, card on hover), names, tab titles, KindGlyph
  api/                        client, generated types, records (once), helpers
  graph/                      GraphNode/GraphEdge types, GraphStore (store/*), hulls, anchors
  netwerk/                    the composed netwerk: chosen bronnen, clusters, the panel Netwerk
  verbonden/                  the panel Verbonden: groups, loaders, rows, the bronfilter, the table
  search/                     the search component and citation resolving
  text/                       article parts, divisions, dates, passages
  components/                 actueel, articles, explore (readers, Bladeren), graph, layout, open,
                              parliamentary, tijdlijn, ui
  stores/                     overlay, search trigger
```

## Names

The API's names are the code's names: collections, relations, fields. Dutch appears in user-facing text and in values a source owns (document kinds, phase names, the status `voorgesteld`). `src/lib/vocabulary.ts` types the collections and relations by the API's schema, with `BRON_LABEL`, the one list of what each kind is called. `src/lib/graph/types.ts` maps them to what the canvas shows. A table typed `Record<Relation, ...>` or `Record<Collection, ...>` fails the check when the API gains a name and the table does not. `KindGlyph` is the one glyph per kind.

## Views of the Verkenner

| View     | URL                  | Shows                                                                                                             |
| -------- | -------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Netwerk  | default              | The canvas; with a bron, the canvas, its reader and Verbonden side by side                                        |
| Tekst    | `?lezen=1`           | The reader at full width, for an article, law, judgment or document; Verbonden beside it                          |
| Bladeren | `?mode=index&kind=…` | `IndexView`: one category with filters, defined in `index/lists`; without `kind`, `IndexOverzicht` lists them all |

Every other kind of bron reads beside the network. The groups of Verbonden are the layers of the canvas. Column widths are kept in `localStorage`; a narrow screen shows one column at a time.

## Data flow

1. A readable address is parsed by `parsePad` (`bron/leesbaar.ts`). A judgment, dossier, cabinet or fractie names its focus directly; an article, Kamerstuk, publication, lid, commissie or toezegging is looked up once through `/api/lookup`. An old `/explore?focus=…` link is rewritten to the readable address once the bron is known.
2. The effect on the focus fetches the bron through `GraphStore` and selects it; in Netwerk the neighbourhood around it is loaded and pruned ([`graph-system.md`](graph-system.md)).
3. `GraphView` renders the store; `KindReader` picks the reader by collection ([`readers.md`](readers.md)); Verbonden reads the same node record as the canvas.
4. Every link to a bron is `bronHref`, so every step is a navigation and the browser history is the history of bronnen.

State and where it lives: [`state-and-stores.md`](state-and-stores.md). Commands: the README.

# Readers

The reading surfaces of `/explore` for the selected bron:

| Place                    | Modes                           | Component                                                                                                         |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Reader                   | Lezen; Netwerk with a selection | `KindReader.svelte`, which picks one reader per collection                                                        |
| Table                    | Lezen with `?tabel=1`           | `src/lib/verbonden/VerbondenTabel.svelte`: every verbinding of the bron, sortable, fifty per page, CSV export     |
| Beside the reader        | both, with `?naast=`            | `DocumentReader` with the article as `article`: a toelichting next to the article it explains                     |
| Table of contents (left) | Lezen, for an article or a law  | `LezenNav.svelte`: the articles of the whole law from `/api/instruments/{bwb_id}/articles`, grouped by breadcrumb |
| Verbonden (right)        | both                            | `src/lib/verbonden/Verbonden.svelte`: the verbindingen of the bron in groups                                      |

`explore/+page.svelte` places them. `LezenNav` reports its items through `onitems`, each with the labels of its place in the law; the page derives `prevHref`, `nextHref` and `place` for `ArticleReader` from them. The page also loads the verbindingen of the bron once (`createVerbondenSource` in `src/lib/verbonden/source.ts`) and hands the same state to the panel, the table, the legend and the reader (the counts per lid, the number of wetsvoorstellen).

## Dispatch

`KindReader.svelte` is one flat `{#if}` chain on `selection.collection`. A collection without a branch gets `FallbackReader`.

| Collection    | Reader             | Reads                                                                   |
| ------------- | ------------------ | ----------------------------------------------------------------------- |
| `articles`    | `ArticleReader`    | `getArticleDetail`, `/api/articles/{bwb_id}/{n}/in-flux`                |
| `judgments`   | `JudgmentReader`   | `getJudgmentDetail`                                                     |
| `documents`   | `DocumentReader`   | `/api/documents/{key}`, with an article `/api/documents/{key}/passages` |
| `dossiers`    | `DossierReader`    | `getDossier`, `/api/dossiers/{number}/timeline`                         |
| `committees`  | `CommitteeReader`  | `getCommittee(slug)`                                                    |
| `members`     | `MemberReader`     | `/api/members/{key}`, `getMemberVotes`                                  |
| `factions`    | `FactionReader`    | `/api/factions/{key}`                                                   |
| `decisions`   | `DecisionReader`   | `/api/decisions/{key}`, `/api/decisions/{key}/document`                 |
| `activities`  | `ActivityReader`   | Nothing: the node's own props                                           |
| `instruments` | `InstrumentReader` | Renders `WholeLawReader`: `/api/instruments/{bwb_id}/articles`, paged   |
| anything else | `FallbackReader`   | Nothing: kind, title, date, status and the source's URL from the props  |

The endpoints are described in the API's `api.md`. Calls go through `$lib/api/client` (see [`api-client.md`](api-client.md)).

## Structure of a reader

A reader that loads data holds its state as `view` (`loading`, `error`, `loaded`; the text readers add `empty`) and loads in an `$effect` that aborts its request, or ignores a late answer, when the selection changes. A reader depends on primitives such as the key or `bwb_id`, so a new selection object for the same bron does not reload it.

`ArticleReader` and `JudgmentReader` use `ReaderFrame` (scroll container, empty, loading and error states) and `ReaderHead` (glyph, kind label, title, and a snippet for extra rows). The frame is sized per mode by `explore/+page.svelte` (`.reader-frame`). `judgment-text.ts` holds the pure helpers that structure judgment text. `_shared.ts` holds date formatting and `textProp`, which reads an untyped prop. The parliamentary readers share request helpers in `src/lib/components/parliamentary/data.ts` and the labels for stages, tracks and outcomes in `stages.ts`. Only a bill passes stages (`isBill`), so only a bill shows `LegislativeStepper`; a closed dossier shows its outcome and `closed_on`.

`ArticleReader` records the law name with `recordInstrument`, so the status bar and the hover panel can show it. Its head is one grey line with the place of the article, the title, and one line with the version picker (`/history`; `Geldend recht, tekst sinds …`), the wetsvoorstellen that touch the article (a link that filters Verbonden to them) and `Citeer artikel`. The leden are a grid (`ArticleText`): the number in the margin, the text, and at the right the number of verbindingen of that lid (a link to `?lid=`) with `Citeer` and `Kopieer tekst` on hover. Every onderdeel, at any depth, shows the same two actions in that column, level with its own text. `Citeer` offers the three forms of `citeArticle` (`src/lib/text/cite.ts`): kort (`art. 5 lid 1 onder d sub i Sr`), voluit (`artikel 5, eerste lid, onderdeel d, onder i, Wetboek van Strafrecht`, after the Aanwijzingen voor de regelgeving) and met datum; the short and long forms are built from the instrument's short title and citation title, a book of the BW cited as `art. 7:3 BW`. `Kopieer tekst` copies the part's text with its onderdelen. The whole-law reader offers the same actions. A wetsvoorstel row of the panel can show its proposed wording next to the current lid (`proposed-text.ts`, from the mutations of its dossier).

## Text and anchors

**Parts.** `ArticleText` (`src/lib/components/articles`) renders an article as aanhef, leden and onderdelen, each with an anchor id (`aanhef`, `lid-2`, `lid-2-onder-a`) and a permalink. The parts come from the API (`partsFromApi`) or are read from the text (`parseArticleParts` in `src/lib/text/article-parts.ts`).

**Citations.** `CitedText` turns the citation spans of an article or judgment into links, at the lid or onderdeel the source names: the qualifier comes from the span (`qualifierOfSpan`) or from the text around it (`parseQualifier` in `src/lib/text/qualifier.ts`). A link to the article on screen is a jump within the page. Hovering shows the cited part.

**Overwegingen.** `JudgmentReader` gives each numbered paragraph the id `paragraph_id` from the API or `rov-{number}`, with a permalink. An unnumbered paragraph keeps its `paragraph_id` (positional, `p-21`), so a citation of it lands.

**Passages.** `DocumentReader` opened beside an article lands on the passage for it: from `/api/documents/{key}/passages`, or a heading found in the text (`findPassage` in `src/lib/text/find-passage.ts`, marked as derived).

**Landing.** `src/lib/bron/anchor.ts`: `anchorOfHash` reads the fragment, `landOn` scrolls the element into view and marks it until the next click, `permalink` builds the address of a position.

## Navigation

Links inside a reader are `bronHref` (see [`routes.md`](routes.md#links-to-a-bron)); a reader has no navigation callback. `StatusBar.svelte` (the bar above the panels: breadcrumb, history, mode, copy citation, share) reads the selection's props and needs no change for a new reader.

## Adding a reader

1. Create `explore/readers/{Kind}Reader.svelte` with `node: GraphNode` (or `selection`) as prop and a `view` state.
2. Add a branch to `KindReader.svelte`.
3. For a text source, use `ReaderFrame` and `ReaderHead`, and give the parts a reference can point at an id.
4. Add the groups of its verbindingen to `GROUPS` in `src/lib/verbonden/groups.ts`.
5. The kind itself is added as described in [`graph-system.md`](graph-system.md#adding-a-node-kind).

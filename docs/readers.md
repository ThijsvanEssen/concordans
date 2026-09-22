# Readers

The reading surfaces of `/explore` for the selected bron:

| Place                    | Modes                           | Component                                                                                                         |
| ------------------------ | ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Reader                   | Lezen; Netwerk with a selection | `KindReader.svelte`, which picks one reader per collection                                                        |
| Beside the reader        | both, with `?naast=`            | `DocumentReader` with the article as `article`: a toelichting next to the article it explains                     |
| Table of contents (left) | Lezen, for an article or a law  | `LezenNav.svelte`: the articles of the whole law from `/api/instruments/{bwb_id}/articles`, grouped by breadcrumb |
| Verbonden (right)        | both                            | `src/lib/verbonden/Verbonden.svelte`: the verbindingen of the bron in groups                                      |

`explore/+page.svelte` places them. `LezenNav` reports its items through `onitems`; the page derives `prevHref` and `nextHref` for `ArticleReader` from them.

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

`ArticleReader` and `JudgmentReader` use `ReaderFrame` (scroll container, empty, loading and error states) and `ReaderHead` (glyph, kind label, title, and a snippet for extra rows). The frame is sized per mode by `explore/+page.svelte` (`.reader-frame`). `judgment-text.ts` holds the pure helpers that structure judgment text. `_shared.ts` holds date formatting and `textProp`, which reads an untyped prop. The parliamentary readers share request helpers in `src/lib/components/parliamentary/data.ts` and the labels for stages and tracks in `stages.ts`.

`ArticleReader` records the law name with `recordInstrument`, so the status bar and the hover panel can show it.

## Text and anchors

**Parts.** `ArticleText` (`src/lib/components/articles`) renders an article as aanhef, leden and onderdelen, each with an anchor id (`aanhef`, `lid-2`, `lid-2-onder-a`) and a permalink. The parts come from the API (`partsFromApi`) or are read from the text (`parseArticleParts` in `src/lib/text/article-parts.ts`).

**Citations.** `CitedText` turns the citation spans of an article or judgment into links, at the lid or onderdeel the source names: the qualifier comes from the span (`qualifierOfSpan`) or from the text around it (`parseQualifier` in `src/lib/text/qualifier.ts`). A link to the article on screen is a jump within the page. Hovering shows the cited part.

**Overwegingen.** `JudgmentReader` gives each paragraph the id `paragraph_id` from the API or `rov-{number}`, with a permalink.

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

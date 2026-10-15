# Readers

The reading surfaces of `/explore` for the selected bron:

| Place                    | Modes                           | Component                                                                                                                                           |
| ------------------------ | ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reader                   | Tekst; Netwerk with a selection | `KindReader.svelte`, which picks one reader per collection                                                                                          |
| Table                    | `?tabel=1`                      | `src/lib/verbonden/VerbondenTabel.svelte`: every verbinding of the bron, sortable, fifty at a time, CSV export                                      |
| Beside the reader        | both, with `?naast=`            | `DocumentReader` with the article as `article`: a toelichting next to the article it explains                                                       |
| Table of contents (left) | Tekst, for an article or a law  | `LezenNav.svelte`: the articles of the whole law (`$lib/api/law-articles`, labelled in `$lib/bron/law-articles`), grouped by their place in the law |
| Verbonden (right)        | both                            | `src/lib/verbonden/Verbonden.svelte`: the verbindingen of the bron in groups                                                                        |

`explore/+page.svelte` places them. The page and `LezenNav` share one article list per law (`lawArticles`); the page derives `prevHref`, `nextHref` and `place` for `ArticleReader` from it. The page also loads the verbindingen of the bron once (`createVerbondenSource` in `src/lib/verbonden/source.ts`) and hands the same state to the panel, the table, the legend and the reader (the counts per lid, the number of wetsvoorstellen).

## Dispatch

`KindReader.svelte` is one flat `{#if}` chain on `selection.collection`. A collection without a branch gets `FallbackReader`.

| Collection    | Reader             | Reads                                                                                                        |
| ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------ |
| `articles`    | `ArticleReader`    | `getArticleDetail`, `/history`, `/explained-by`; without a memorie there, `/api/dossiers/{number}/documents` |
| `judgments`   | `JudgmentReader`   | `getJudgmentDetail`                                                                                          |
| `documents`   | `DocumentReader`   | `getDocument`, with an article `/api/documents/{key}/passages`                                               |
| `dossiers`    | `DossierReader`    | `getDossier`, `getDossierTimeline`, `getChangedArticles`, `getAmendementen`                                  |
| `committees`  | `CommitteeReader`  | `getCommittee(slug)`                                                                                         |
| `members`     | `MemberReader`     | `getMember`, `getMemberVotes`, `getMemberAuthored`                                                           |
| `factions`    | `FactionReader`    | `/api/factions/{key}`                                                                                        |
| `decisions`   | `DecisionReader`   | `getDecision`, `getDecisionDocument`                                                                         |
| `cabinets`    | `CabinetReader`    | `getCabinet`; posts per ministry are in Bladeren                                                             |
| `commitments` | `CommitmentReader` | `getCommitment`                                                                                              |
| `annexes`     | `AnnexReader`      | `/api/annexes/{key}`                                                                                         |
| `activities`  | `ActivityReader`   | Nothing: the node's own props                                                                                |
| `instruments` | `InstrumentReader` | Renders `WholeLawReader`: the articles paged; with `?peildatum=` the text of that day                        |
| anything else | `FallbackReader`   | Nothing: kind, title, date, status and the source's URL from the props                                       |

The endpoints are described in the API's `api.md`. Calls go through `$lib/api/client` (see [`api-client.md`](api-client.md)).

## Structure of a reader

A reader that loads data holds its state as `view` (`loading`, `error`, `loaded`; the text readers add `empty`) and loads in an `$effect` that aborts its request, or ignores a late answer, when the selection changes. A reader depends on primitives such as the key or `bwb_id`, so a new selection object for the same bron does not reload it.

Every reader renders inside `ReaderFrame` (scroll container, empty, loading and error states, with Opnieuw after an error); `ArticleReader`, `JudgmentReader` and `InstrumentReader` also use `ReaderHead` (glyph, kind label, title, and a snippet for extra rows). The frame is sized per mode by `explore/+page.svelte` (`.reader-frame`). `judgment-text.ts` holds the pure helpers that structure judgment text, among them `partiesByRole`: one row per role, pseudonymised parties (`[appellant 1]`) counted, the named ones listed with the alias the judgment gives them and their other roles, counsel after the parties. `_shared.ts` holds date formatting and `textProp`, which reads an untyped prop. `MemberReader` shows a person's career from `careerOf` (`src/lib/components/parliamentary/career.ts`): seats in a fractie, posts in a cabinet, and the functions they signed stukken in, each with its years.

The parliamentary readers share their requests in `src/lib/api` (`dossiers.ts`, `members.ts`, `committees.ts`). `DossierReader` shows the stand as `StandBalk` (`stand.ts`) and the procedure per Kamer (`procedure.ts`), with the Eerste Kamer's progress from `senate`; the phase and outcome labels are in `stages.ts`. Under the procedure stand the amendments as a timetable (`AmendementenDienstregeling`, `amendementen.ts`): a row per amendment as it came to the vote, a column per day on which a paper appeared (not to scale: the days cluster), the month above its days and the day under it, a rule where the month changes and a dotted one where the week does; a stop is the paper's number in a ring (its card gives kind, day, indieners and vote), and at the end the outcome as a shape with the tally, "■ 92–58". Where the column is narrower than the timetable it scrolls in its own box, the names standing (sticky). It is one request, the dossier's neighbourhood (`PART_OF`, `ABOUT`, `REVISES`, depth 2), asked once the section is in view and only where the dossier's own counts per kind hold amendments. The chain is the `REVISES` edges between papers; the vote is the decision whose `primary_case_id` is the case of the last paper. Nothing is read from a title. Without `REVISES` each paper stands alone. The count stands in the heading; no sentence sums up above the list.

`ArticleReader` records the law name with `recordInstrument`, so the hover panel can show it. Its head is one grey line with the place of the article below its law (`layersOf` in `src/lib/text/division.ts`: titel and afdeling, never the law or a BW book a second time), the title (`Artikel 6:162`), and one line with the version picker (`/history`; `Geldend recht, tekst sinds …`, or `Vervallen per …` for an article the API marks `repealed`), the wetsvoorstellen that touch the article (a link that filters Verbonden to them) and `Citeer artikel`. The leden are a grid (`ArticleText`): the number in the margin, the text, and at the right the number of verbindingen of that lid (a link to `?lid=`) with `Citeer` and `Kopieer tekst` on hover. Where the text itself is narrower than 600px (a container query, beside the network or on a phone), that right column folds under each lid. Every onderdeel, at any depth, shows the same two actions in that column, level with its own text. `Citeer` offers the three forms of `citeArticle` (`src/lib/text/cite.ts`): kort (`art. 5 lid 1 onder d sub i Sr`), voluit (`artikel 5, eerste lid, onderdeel d, onder i, Wetboek van Strafrecht`, after the Aanwijzingen voor de regelgeving) and met datum; the short and long forms are built from the instrument's short title and citation title, a book of the BW cited as `art. 7:3 BW` (never the API's short title of the book, `BW7`). `Kopieer tekst` copies the part's text with its onderdelen. The whole-law reader offers the same actions. A wetsvoorstel row of the panel can show its proposed wording next to the current lid (`proposed-text.ts`, from the mutations of its dossier).

**Collapsible sections.** Every section heading of a reader (`Sectie`, rung 2) is itself the button that opens and closes the section (`FoldButton`): `aria-expanded`, a quiet chevron (`Caret`), Enter and Space. What the reader chose is remembered per kind of heading, not per bron, in `localStorage` under `concordans:kopjes` (`src/lib/components/ui/dicht.svelte.ts`, a map from key to open, read and written in try/catch); the key is the heading text or the `sleutel` prop, and a section that something else opens has its key in `FOLD` (Amendementen, opened from a day of votes in the procedure, by the key that is also its anchor). The legend and the panel Netwerk over the canvas are kept there too. A section starts closed; its count stands in the heading. A closed section renders nothing, so it loads nothing; the amendments ask their neighbourhood once in view, so their count is there while closed. Sub-headings fold too and start open: the groups of a dossier's procedure (`Tijdlijn inklapbaar`, key `sub:<titel>`) and the laws of Gewijzigde artikelen (`sub:wet:<id>`). Verbonden's groups start open, key `verbonden:<group id>`. A list that is the page itself (the index overview) passes `inklapbaar={false}`.

**A row of Verbonden** says its verbinding at a glance, from `hoeVan` in `src/lib/verbonden/hoe.ts`: one line with the verb fixed per relation and direction (`Haalt aan`, `Aangehaald`, `Verwijst naar`, `Wijzigt`, `Door de Kamer verbonden`, a vote's outcome) and the rest from the edge (`Row.edge`, its meta): the lid, the overwegingen (`in r.o. 4.3 en 5.1`), the count, the words of a law, the day in force, the tally. Below it the passage with the words that name the selected bron marked, where the edge has one. A verbinding below high confidence (`confidenceWord`) is in italics with "afgeleid". Where it comes from (`Herkend in de tekst`, `Wetten.overheid.nl, Stb. 2024, 193`, `Rechtspraak.nl, formele relatie`) floats under the row on hover and focus, and after a tap on a phone; it never takes a line of its own. The meta line keeps what the line does not say (`metaParts(row, true)`). The row has no panel: a click anywhere on it opens the bron in Netwerk; `+` puts it among the chosen bronnen. Alleen de omgeving is the key O and a line in the panel Netwerk. The overwegingen of a judgment that cites an article come from its detail, which the loader asks anyway; the edge's `paragraphs` take over where the API gives them (judgment to judgment waits for that). The table keeps its rows that open under themselves.

## Text and anchors

**Parts.** `ArticleText` (`src/lib/components/articles`) renders an article as aanhef, leden and onderdelen, each with an anchor id (`aanhef`, `lid-2`, `lid-2-onder-a`) and a permalink. The parts come from the API, or are read from the text where it gives none (`partsOf` in `src/lib/text/article-parts.ts`); the card of an article shows the same parts.

**Citations.** `CitedText` turns the citation spans of an article or judgment into links, at the lid or onderdeel the source names: the qualifier comes from the span (`qualifierOfSpan`) or from the text around it (`parseQualifier` in `src/lib/text/qualifier.ts`). A link to the article on screen is a jump within the page. Hovering shows the cited part.

**Defined terms.** Where an article uses a term its regulation defines (`term_spans` and `definitions` on `/api/articles/{bwb_id}/{article_number}`), `CitedText` makes the term a reference too, with a quiet dotted underline (`a.begrip`). Its card is the hover card of every reference (BronLink `voorbeeld`): `Begrip, art. 1, onder b`, the term, the definition as the regulation writes it; a click opens the article that gives it, in Netwerk. A citation whose words are such a term (`definition_ref`: "artikel 11 van de wet") carries the definition as one line more on its card (BronLink `extra`). The terms come with the article, so no request more. Helpers in `src/lib/text/begrippen.ts`.

**Overwegingen.** `JudgmentReader` gives each numbered paragraph the id `paragraph_id` from the API or `rov-{number}`, with a permalink. An unnumbered paragraph keeps its `paragraph_id` (positional, `p-21`), so a citation of it lands.

**Passages.** `DocumentReader` opened beside an article lands on the passage for it: from `/api/documents/{key}/passages`, or a heading found in the text (`findPassage` in `src/lib/text/find-passage.ts`, marked as derived).

**Landing.** `src/lib/bron/anchor.ts`: `anchorOfHash` reads the fragment, `landOn` scrolls the element into view and marks it until the next click, `permalink` builds the address of a position.

## Navigation

Links inside a reader are `bronHref` (see [`routes.md`](routes.md#links-to-a-bron)); a reader has no navigation callback. `ReaderFrame` places the switch Netwerk/Tekst at the top right beside the band (`WEERGAVE_KEY`, set by the explore page); a new reader needs no change for it. There is no bar under the TopBar.

## Adding a reader

1. Create `explore/readers/{Kind}Reader.svelte` with `node: GraphNode` (or `selection`) as prop and a `view` state.
2. Add a branch to `KindReader.svelte`.
3. For a text source, use `ReaderFrame` and `ReaderHead`, and give the parts a reference can point at an id.
4. Add the groups of its verbindingen to `GROUPS` in `src/lib/verbonden/groups.ts`.
5. The kind itself is added as described in [`graph-system.md`](graph-system.md#adding-a-node-kind).

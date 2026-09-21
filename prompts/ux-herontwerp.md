# Make Concordans obvious: rework the front end around moving between sources

You are working in `~/Development/lawgraph-explorer`: **Concordans**, a SvelteKit 2 / Svelte 5 /
TypeScript app (sigma.js + graphology for the network view) that reads the LawGraph API. The
back end lives in `~/Development/lawgraph` and is **read-only for you**: read its docs and
code, never change it. Every edit you make is inside `lawgraph-explorer`.

## Purpose

Concordans is for searching legal data well. The unit of work is a **bron** (a law, an
article, a judgment, a dossier, a memorie van toelichting, a committee) and its
**verbindingen** to other bronnen. A user should move from one bron to the next in one click,
without knowing which mode, panel or graph setting is needed. The reference journey:

> Open the dossier of the new Wetboek van Strafvordering. From that dossier: the law itself,
> the Tweede Kamer committee that handles it, the memorie van toelichting (MvT) and the other
> documents, the Eerste Kamer, and the European and international instruments that are
> relevant or that the law implements. From an article of the law, in the reader and in the
> network alike: the MvT that explains it, readable next to the article. Between texts:
> exact references to a lid, the aanhef or an onderdeel of an article, and to an overweging
> of a judgment.

## What the owner cares about, in this order

1. **Obvious**: the next step is visible on screen. Nothing is explained that the user can see.
2. **Simple**: fewer modes, fewer routes, fewer components, one way to do each thing.
3. **Efficient**: few clicks between two related bronnen, few requests per view.
4. **Correct**: every claim on screen is backed by the API, and where the API only supports
   a guess, the screen says so with a marker, not with prose.

## Rules for everything a user reads

`CLAUDE.md` is binding. In addition:

- **If it is visible, do not write it.** No lede under a heading that repeats the list below
  it, no tooltip that repeats a label, no legend that repeats the controls, no walkthrough,
  no welcome card, no "Begrepen" button, no mode descriptions, no example links that
  introduce themselves. A label names what is there. An empty state is one line or nothing.
- No marketing copy on the start page (hero lede, promise, "Alleen in Concordans",
  "Probeer →"). The start page is a search field and the ways into the material.
- Vocabulary: `bron`, `verbinding`, `netwerk`. Legal term first. Defined once in
  `src/lib/vocabulary.ts`; no second list of labels.
- Where data is derived rather than read from the source (a heuristic match, a confidence
  below 1), show a small marker on that item. Do not explain the marker in a sentence.

## Sources of truth (read these first)

In `~/Development/lawgraph`: `docs/api.md`, `docs/data-model.md`, and `/openapi.json` (the
front end's `src/lib/api/openapi.json` is currently identical to it; `npm run check:api`
verifies that). Field meanings: `src/lawgraph/api/schemas/*.py`.

In the front end: `docs/` describes the app but is partly stale (it names `ArticleMvtPanel`,
`TkstukReader` and `[`/`]` shortcuts that no longer exist). Trust the code. Bring `docs/` in
line at the end (minimal, self-standing, no history).

The working tree may hold uncommitted API-alignment work on branch `api-alignment`. Run
`git status` first. Do not discard it and do not mix it into your commits: ask the owner to
commit it, or branch from the last commit and leave the changes alone.

## The boundary with the back end

Some of what is asked below the API cannot deliver yet. The rule:

1. Look in the API first (docs and schema). Do not conclude "missing" without having checked.
2. If it is not there, **do not work around it in the back end and do not invent data**. Build
   the front-end part as a generic, replaceable piece: one function or one module whose input is
   what the API delivers today and whose output is the shape the API should deliver. Mark it
   `TODO(backend Bn)` with `n` from the list below. The swap later is one file.
3. If nothing sensible can be built yet, leave the element out and keep a `TODO(backend Bn)`
   at the place it will go. Do not show a disabled or empty element.
4. `~/Development/lawgraph-explorer/prompts/voor-de-backend.md` lists what is missing, as
   B1 to B12. Do not edit that file's meaning; you may append findings under "Added during
   implementation" in the same format. Your report repeats which Bn each stopgap belongs to.

Known today (checked against schema and code):
delivers: `GET /api/dossiers/{n}` (header, counts), `/documents` (TK and EK documents, no chamber
field; EK keys start with `ek_`), `/timeline` (activities carry a raw `committee_id` in `body`),
`GET /api/instruments/{bwb_id}/dossiers`, `GET /api/committees/{slug}` (members and dossiers),
`GET /api/articles/{bwb_id}/{n}` (text, `citations[]` spans with `start`, `end`, `target`),
`.../legislative-history` (entries with `document_id`, but only for EXPLAINS edges that point at
the article itself), `.../relationships`, `.../history`, `GET /api/judgments/{ecli}`
(`paragraphs[]` with `number` and `citations[]`), `GET /api/nodes/{collection}/{key}` (neighbours,
at most 30 per relation and collection, no counts), `GET /api/search`.
does not deliver: lid, aanhef or onderdeel as structure; a lid on a reference; the passage of an
MvT for an article; a paragraph anchor; a dossier-to-law or dossier-to-committee endpoint; a
chamber on a document; an EU implementation endpoint; a citation resolver; per-relation counts.

## Target experience

### 1. Entering: one search, citation-aware

- The start page is a search field and, under it, the ways into the material by kind
  (Wetten, Dossiers, Uitspraken, Commissies). No hero text, no mode tiles, no statistics
  meter, no "Vier weergaven" section. `routes/(main)/+page.svelte` (2,400 lines) shrinks to
  what remains; delete what is unused.
- `⌘K` opens the same search everywhere. Delete `/search` (a second results page with a
  different limit). One component, one result layout: kind label, title, one line of context
  (parent law for an article, stage for a dossier, court and date for a judgment).
- Input that is a citation resolves to a target on Enter, without a results page: `ECLI:...`,
  `artikel 287 Sr`, `art. 6:162 BW`, a dossier number (`36327`, `36327-3`), a BWB or CELEX id.
  Build one `resolveQuery()` in one module (pure, unit-tested). It calls what exists today
  (`/api/search`, which parses ECLI and `art. N law` only). Notation such as `6:162` and
  `Kamerstuk 36327` is not handled by the API: parse in the front end, `TODO(backend B11)`.
- Delete `/publications` and `/publications/[key]`: nothing links to them, and `DocumentReader`
  already is the reader of a document. Decide `/nodes/[collection]/[key]` (redirect only):
  keep it only if something links to it, otherwise delete it. Say which in the report.

### 2. One place to read a bron, in every mode

`/explore` today has four modes (graph, split, read, index) and several sidebars. Reduce to:

- **Lezen**: the bron full width, with its verbindingen alongside.
- **Netwerk**: the canvas; selecting a bron opens the same reader beside it (today's "split",
  automatic). Without a selection, canvas only.
- **Bladeren**: today's Index, with its filters.

Rules:

- **One function builds every link to a bron** (`bronHref(ref, { at?, keepMode })`). It keeps the
  current mode and view state. Today many reader links are plain `<a href="/explore?focus=...">`
  that drop `mode` and land in the graph with the reader gone (`DossierReader`,
  `CommitteeReader`, `MemberReader`, `ArticleLegislativeHistory`). Replace all of them; a link
  to a bron never changes the mode by accident.
- Browser back returns to the previous bron. A URL reproduces the state, including the
  position inside a text (see 5).
- Keys `1`, `2`, `3` switch mode. Nothing else to learn; `docs/sneltoetsen` shrinks accordingly.
- Remove `WalkthroughCard`, `EmptyCanvas`'s explanatory text, StatusBar mode `title`s and the
  three parallel entries into Bladeren (TopBar link, sidebar "Parlement", start page tile):
  keep TopBar.

### 3. Verbonden: one panel, same for every kind of bron

Replace the per-kind rails (`CitationRail`, `DossierRail`, `CommitteeRail`, `MemberRail`,
`FactionRail`, and the ledes in them) by one component that renders groups from a table:
`kind → ordered groups`. The table is data, defined once, next to `vocabulary.ts`. A group is
a heading with a count and rows (kind glyph, title, one line of context). One click on a row
opens that bron in the current mode. An empty group is not shown. The same groups are the
layers of the network: a control on a group adds or removes its bronnen from the canvas. This
also removes the separate legend and layer buttons in `GraphSidebar`: the groups are the
legend and the controls.

Groups per kind (relations are the API's 18 names; a group is defined by relation, direction and
node type):

- **Dossier**: Wetten (`LEGISLATED_IN`, and the instruments changed by `AMENDS`, `INTRODUCES`,
  `REPEALS`; a change that is `voorgesteld` is marked); Tweede Kamer: Commissie (`LED_BY` on the
  dossier's activities), Memorie van toelichting en andere stukken, Stemmingen, Toezeggingen;
  Eerste Kamer: stukken; Europees en internationaal: EU acts and treaties reached through the
  dossier's laws.
- **Wet**: Dossiers, Artikelen, Europees en internationaal (`IMPLEMENTS` in both directions,
  treaties, EVRM), Wijzigingen (`amended-by`), Uitspraken.
- **Artikel**: Toelichting (see 4), Uitspraken, Verwijst naar, Aangehaald door, Dossiers,
  Europees en internationaal.
- **Uitspraak**: Aangehaalde artikelen (with the lid where known), Hoger beroep (`APPEAL_OF`).
- **Document (MvT and others)**: Dossier, Toelichting bij (articles), Kamer.
- **EU instrument or treaty**: Geïmplementeerd door (national laws), Artikelen.
- **Commissie, lid, fractie, stemming**: what the current readers list, in the same component.

Group counts: one `/api/nodes/{collection}/{key}` call fills all groups of the selected bron
(the store already caches per node; do not call it twice). That endpoint caps a group at 30 and
gives no totals: show `30+` for a capped group, `TODO(backend B12)`. Rows of a group load when
the group is opened only if they are not in that response.

Dossier joins with no endpoint (`dossier → wetten`, `dossier → commissies`,
`dossier → chamber`): build them in **one** module, `dossier-hub.ts`, from `/api/nodes/dossiers/{key}`,
`.../timeline?kind=activities` and the cached `/api/committees` list, `TODO(backend B1, B3)`.
The Eerste Kamer group is the documents with an `ek_` key, in one `chamberOf(document)` function,
`TODO(backend B2)`. Report the request count of opening a dossier.

### 4. Article and MvT together

- In `ArticleReader`, the group **Toelichting** lists the explanatory documents of the article
  (memorie van toelichting, nota van toelichting; kind values are the source's Dutch strings).
  Selecting one opens it **in place**, beside the article in Lezen and in the panel next to the
  canvas in Netwerk. No navigation away, no new bron selected: the article stays.
- Order: the MvT of the dossier that introduced or last amended the shown version first, then by
  date. If the API cannot say which, order by date and take the newest.
- Position inside the MvT: the API has no article-to-passage mapping, `TODO(backend B4, B5)`.
  Build `findPassage(text, articleNumber)` (pure, unit-tested): scroll to and highlight the first
  heading-like occurrence of `Artikel <number>` and `Artikel I, onderdeel ...` patterns; when there
  is none, open at the top. The result carries a `derived` marker.
- Finding the documents: `GET /api/articles/{bwb_id}/{n}/legislative-history` returns
  `document_id` but misses edges that point at article versions or at the instrument. Use it, plus
  the dossiers of the instrument (`/api/instruments/{bwb_id}/dossiers`) and their documents of kind
  `memorie van toelichting`, and merge in one function `explanatoryDocuments(article)`,
  `TODO(backend B4)`. Do not query per candidate document: use
  `/api/dossiers/documents/bulk`.
- `DocumentReader` gets the reverse: an article it explains links to that article, its dossier
  links to the dossier. It shows text only; remove any panel of its own that repeats the
  document header.

### 5. Exact references

A reference has three parts: bron, position (`lid`, `onderdeel`, `aanhef`, or overweging), and the
text it stands in. Position is part of the URL (fragment `#lid-2`, `#lid-2-onder-a`, `#aanhef`,
`#rov-5.3`), so it can be shared, and it survives back/forward.

- **Article text**: render as structure, not as lines: aanhef, leden, onderdelen, each with a stable
  anchor id and a visible number. The API gives flat text with `1.` and `a.` prefixes on separate
  lines. Write `parseArticleParts(text)` (pure, unit-tested on real articles: Sr 287, BW 6:162,
  Sv, a Grondwet article) that returns the parts with `start` and `end` offsets, so the existing
  citation spans still match. `TODO(backend B6)`: when the API delivers `parts`, this function
  becomes a pass-through.
- **Reference chips**: a citation is shown as the source writes it (`artikel 287, tweede lid,
Wetboek van Strafrecht`) and links to the article at that lid. The lid is not a field: derive
  it in `parseQualifier(spanText)` (pure, unit-tested) from the span text, `TODO(backend B6, B7)`.
  A reference into the same law jumps within the page. Hover shows the referenced text of that lid.
- **Judgments**: every paragraph gets an anchor from `paragraphs[].number` (`rov-5.3`) and the number
  is a link that copies the permalink. A citation in a paragraph opens the article at the cited lid.
  In the article's group **Uitspraken**, a row shows court, date and, when known, the overweging
  that cites it. The API gives only the ECLI per article, `TODO(backend B8)`; build the row so
  that the overweging is optional, and show none until it is delivered.
- Landing on an anchor scrolls it into view and marks it. The mark fades on the next click. No toast.
- Delete the dead `focusedCitationKey` plumbing (`stores/reader.ts`), or make it drive the highlight
  of the cited passage. Choose the shorter.

### 6. Europees en internationaal

The group exists for every kind that has it. Content today: `IMPLEMENTS` edges (national law to EU
act, built from CELEX numbers named in the text, confidence 0.75, `TODO(backend B9)`), EU instruments
(`/api/instruments?jurisdiction=eu`), EVRM (judgments with `source=echr` and `echr_convention_<n>`
articles), treaties. Rows whose confidence is below 1 get the derived marker. Check that an EU
article opens: `ArticleReader` reads `props.bwb_id` only, and EU articles have a `celex`. Fix
in one place (the identity helper in `src/lib/util/law-id.ts`), not per reader.

### 7. Network

Keep what works (Sigma, layout, hemicycle, overlays). Change:

- Selecting a bron shows the reader beside it. The hover panel (`GraphCitePanel`) keeps at most
  one action: "Openen". Remove "Selecteren" as a separate step from the user's mental model:
  selecting is opening.
- Layers come from the Verbonden groups (3). Delete the second legend, the `EDGE_LEGEND` with its
  wrong "semantische verbanden" text (the API's `semantic_type` is a different thing), and the
  "hitte-halo" wording: the overlay is called what it counts (`Citaties per maand`).
- "N bronnen niet zichtbaar → Toon alle": keep one line, in the same place, no sentence.
- One glyph per kind everywhere (today `§` is Wetten in the sidebar and Artikelen in the reader).

### 8. Repairs found while mapping

Fix or delete in passing, with the report saying which:

- `KindReader` sends `commitment` and `case` to the raw fallback because the dispatcher tests
  `collection === 'activities'` only: give them a reader in `_shared` terms or drop them from
  the links that lead there.
- Dead files: `parliamentary/WatchControl.svelte`, `stores/watches.ts`, `stores/profile.ts`,
  `components/ui/Badge.svelte`, empty `src/lib/search`, `src/lib/components/common`.
- `TopBar.isExplore` still tests `/nodes`.
- The documentation pages (`docs/+page.svelte` 5,700 lines, `docs/methode` 3,800) explain the
  interface to users. Where a page describes something removed above, remove that text. Shrink
  them to what a researcher cannot see: sources, coverage, how a verbinding is derived (method).
  Do not rewrite them for the sake of it.

## How to work

Work on a branch. Small commits, each leaves `npm run check`, `npm run lint` and `npm test` green.

1. **Inventory first, no code.** Write down (in your working notes, not in the repo) the current
   click path and request count for the four journeys below, so that your final numbers compare.
2. **Foundations**: `bronHref`, the group table, `resolveQuery`, `parseArticleParts`,
   `parseQualifier`, `findPassage`, `dossier-hub`, `explanatoryDocuments`, `chamberOf`. Pure
   functions get Vitest tests on real API responses (save two or three as fixtures).
3. **Components**: the Verbonden panel, reader anchors, Toelichting in place, the modes.
4. **Delete**: the routes, components and copy that are now unused. Deleting is part of the task,
   not clean-up for later.
5. **Copy sweep** against `CLAUDE.md` over everything you touched, and grep the rest for
   `u`-forms, em-dashes, `knoop`, `graaf`, `relatie`, `Let op`, `eenvoudig`.
6. **Docs**: `docs/routes.md`, `readers.md`, `architecture.md`, `state-and-stores.md`,
   `graph-system.md`, `search.md`, `sneltoetsen`.

Performance: request budget per view, reported before and after. Use `limit`, `text_preview_chars`,
`/api/dossiers/documents/bulk`, and abort requests of a view the user left. The MvT text is loaded
when Toelichting is opened, not with the article.

## Verify: four journeys in the running app

Start the API (`cd ~/Development/lawgraph && .venv/bin/lawgraph-api`) and the app
(`npm run dev`). Take real keys from the API (`/api/search?q=wetboek van strafvordering`,
`/api/dossiers/open`), do not invent them. For each journey, report clicks, requests and what
you saw; a failed request or console error is a defect.

1. **Dossier hub.** Start page, type `nieuw wetboek van strafvordering`. From the dossier reach,
   each in one click: the law, the committee, the MvT (reading text), an Eerste Kamer document,
   an EU or international instrument (if the data has one; say if not).
2. **Article with MvT.** Open an article of the Wetboek van Strafrecht in Lezen, read its
   toelichting beside it. Repeat in Netwerk from a selected article node.
3. **Exact reference.** In a judgment, open a citation of `artikel N, tweede lid`: the article opens
   at the lid, marked. Copy the URL, open it in a fresh tab: same position.
4. **From article to judgment.** From the article, open a citing judgment (at the overweging if the
   API gave it).

Also walk: start page, search (mouse and keyboard, a citation string, a no-result query), Bladeren
with a filter, a committee, a member, a decision, an EU article, mobile width. Back and forward
through six bronnen.

## Boundaries

- Never change `~/Development/lawgraph`, never write to its database. Writes to the front end only.
- Visual identity stays (tokens in `AppShell`, typography, colours). This is a rework of structure
  and copy, not a new skin.
- No new dependency unless it removes more code than it adds; say so if you add one.
- Do not push, deploy, or touch the analytics (`posthog-js`) setup without asking.
- Do not build what the API cannot deliver as if it could. A guess carries the derived marker;
  a missing feature stays out with a `TODO(backend Bn)`.
- Do not write compatibility layers for removed routes or old URL params.

## What to hand back

1. The branch and commits.
2. A report: per journey, clicks and requests before and after, and what you saw; what was
   deleted (files, lines); `check`, `lint`, `test` status; what you could not verify.
3. **Stopgaps**: every `TODO(backend Bn)` with file and one line on what the stopgap does and
   what replaces it. `grep -rn "TODO(backend" src` must match your list.
4. **For the back end**: only what is new compared with `prompts/voor-de-backend.md`.

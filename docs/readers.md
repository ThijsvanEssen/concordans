# Readers

The right-hand panel in `mode=split` and `mode=read`. Dispatched per node-kind, with one reader component per kind.

## The dispatcher — `KindReader.svelte`

A single switch on `selection.kind` (or `selection.collection` for `stemmingen`):

```svelte
{#if !selection}              <ArticleReader {selection} />          <!-- empty state -->
{:else if kind === 'article'} <ArticleReader ... />
{:else if kind === 'judgment'}<JudgmentReader ... />
{:else if kind === 'tkstuk'}  <TkstukReader ... />
{:else if kind === 'dossier'} <DossierReader ... />
{:else if kind === 'commissie'}<CommissieReader ... />
{:else if kind === 'lid'}     <LidReader ... />
{:else if kind === 'fractie'} <FractieReader ... />
{:else if kind === 'activity'}<ActivityReader ... />
{:else if kind === 'instrument'}<InstrumentReader ... />
{:else if collection === 'stemmingen'}<StemmingReader ... />
{:else}                       <FallbackReader ... />
{/if}
```

Two reasons the switch is intentionally flat:

1. **Cheap to read.** Adding a kind is one new branch.
2. **No virtual indirection.** No reader registry, no dynamic component lookup — `svelte-check` and grep both find every reader trivially.

The first branch (`!selection`) renders `ArticleReader` with a null selection so the empty-state copy (which lives in `ReaderFrame`) shows by default. If you reshape the empty state, change the no-selection target accordingly.

## The reader families

### Text readers (article / judgment)

`ArticleReader.svelte` and `JudgmentReader.svelte` fetch a text-bearing node and render it in the reading typography. Both sit on two shared pieces:

- **`ReaderFrame.svelte`**: the scroll container plus the empty, loading and error states. `explore/+page.svelte` sizes its `.reader-frame` class per mode (max-width in `split`, wider measure in `read`).
- **`ReaderHead.svelte`**: sigil (`§` article, `¶` judgment), kind label and title. Reader-specific rows (citation, meta, in-flux chips) go in its snippet.

Each reader owns a `view` state (`empty | loading | error | loaded`) and a `token` counter that discards responses from a superseded selection.

| File | Contents |
|---|---|
| `ArticleReader.svelte` | Article body or leden, in-flux dossier chips, prev/next footer, `ArticleLegislativeHistory` |
| `ArticleMvtPanel.svelte` | Collapsible "Toelichting (MvT)" panel: passages, per-passage full text |
| `JudgmentReader.svelte` | Summary, subjects, participants table, numbered body |
| `judgment-text.ts` | Pure parsing helpers for judgment text (party block, participants, sub-numbering, embedded headings) |

Do not name a state variable `state` or `props` in a Svelte 5 component: the compiler then reads `$state` / `$props` as a store subscription. See [`gotchas.md`](gotchas.md#variables-named-state-or-props).

### Parliamentary readers (tkstuk / dossier / commissie / lid / fractie / stemming / activity)

These build on `lib/api/parliamentary-client.ts` (and `mvt.ts` for tkstuk) and are standalone components:

- **`TkstukReader.svelte`**: parliamentary publication (MvT, verslag, nota, amendement) as plain text with a link to the source.
- **`DossierReader.svelte`**: dossier detail + stepper + timeline + recent stemmingen + betrokken artikelen + "Toon op grafiek" link.
- **`CommissieReader.svelte`**: commission overview, members, dossiers.
- **`LidReader.svelte`**: member profile, votes, touched instruments.
- **`FractieReader.svelte`**: party profile, members, touched instruments, vote summary.
- **`StemmingReader.svelte`**: single vote outcome with per-fractie breakdown.
- **`ActivityReader.svelte`**: committee activity (vergadering, behandeling), usually a thin meta-card.

These readers tend to be section-rich rather than text-rich. The pattern is: fetch a detail DTO + a small set of related queries (e.g. dossier + timeline + mutations), then lay out as `<section class="sec">` blocks.

### Special cases

- **`InstrumentReader.svelte`**: whole-law overview. Not text-heavy, more like a navigator: shows article structure (hoofdstukken, afdelingen, paragrafen) as a collapsible tree. Clicks navigate into individual articles.
- **`FallbackReader.svelte`**: last-resort for unknown kinds. Renders `node.label` and `node.collection` + a dump of `raw.props`. If you see it in the wild, you've added a node kind without a reader.

## Article reader internals

### Side-fetches

When an article loads, the reader also runs:

- `fetchArticleLegislativeHistory(bwb, art)`: fills the in-flux dossier chip list (entries with `status === 'voorgesteld'`, deduped by `dossier_nummer`).
- `recordInstrument({...})`: seeds the instrument-meta cache from `citation_formats.bibtex`, so the status bar and the citation panel show the law name.

Both are best-effort. The chip fetch has an empty failure handler; the reader shows what it has.

### Collapsible passages

`ArticleMvtPanel` keeps a `Map<string, 'idle' | 'loading' | 'error' | string>` per passage key, where a string other than the three markers is the loaded text. The panel fetches passages on first open and the full text on request (`getPublicationText`). Keeping the load state next to the data keeps the template short; follow the same pattern for a further collapsible group.

The panel remounts on every selection change because the reader passes through `loading`, so no reset logic is needed.

### In-flux chip list

A row of chips below the article title when `inFluxDossiers.length > 0`. Each chip links to a dossier-scoped graph:

```svelte
<a href="/explore?focus=kamerstukdossiers/{d.nummer}&overlay=dossier:{d.nummer}"
   title={d.titel}>
```

`focus` selects the dossier, `overlay=dossier:X` paints Mutatie badges for that dossier.

See [`overlays.md`](overlays.md) for the overlay side; [`gotchas.md`](gotchas.md#in-flux-mismatch) for why the chip list and Mutatie badge can disagree.

## Reader navigation

Three callback props show up across readers:

```ts
onNavigate?: (collection: string, key: string) => void;
onPrev?: () => void;
onNext?: () => void;
```

`onNavigate` is fired when the user clicks a citation chip or in-reader link. The route component (`/explore/+page.svelte`) wires it to `store.focusNode(graphNodeId(collection, key))`, which updates the URL and graph selection.

`onPrev`/`onNext` are wired to the article reader specifically, supporting `[` and `]` keyboard navigation through the article's siblings (next/previous article in the same instrument).

Not all readers expose all three. Add as needed when the kind has a natural prev/next ordering.

## Reader layout

The reader column lives in `routes/explore/+page.svelte` under `.explore-split .split-reader`. Width is user-resizable via the `panel-resize-handle` (drag).

The reader is wrapped in `LezenNav` only when in `mode=read` (a different surface entirely — `WholeLawReader`). In `mode=split` the `KindReader` is the direct child and renders selection-driven.

## CitationRail integration

The right-most column in `mode=split`. It listens for selection changes via `store.selection.subscribe(...)` and renders citation chips. Clicking a chip:

1. Fires the `onNavigate` callback up to the route.
2. Route calls `store.focusNode(...)` which updates URL + graph selection.
3. Reader re-renders via `$effect(() => { void selection })` and refetches.

The rail uses `setActiveArticle` and `setFocusedCitation` on `stores/reader.ts` so the reader can scroll-into-view the cited paragraph when the rail signals which citation was clicked. This is the one bit of cross-component state that genuinely needs a store (the reader and rail are siblings under the route, but the data flow is reader → rail → reader scroll, which doesn't lift cleanly).

## Per-kind reader inventory

| Reader | Kind | Backend calls | Notable features |
|---|---|---|---|
| `ArticleReader` | `article` | `getArticleDetail`, `fetchArticleLegislativeHistory`, `getMvtContext`, `getPublicationText` | In-flux chips, MvT panel, legislative history |
| `JudgmentReader` | `judgment` | `getJudgmentDetail` | Participants table, numbered paragraphs, subjects |
| `TkstukReader` | `tkstuk` | `getPublicationText` | Publication text, link to tweedekamer.nl |
| `DossierReader` | `dossier` | `fetchDossier`, `fetchDossierTimeline`, `fetchDossierMutations` | Stepper, timeline, betrokken artikelen, "Toon op grafiek" |
| `CommissieReader` | `commissie` | `fetchCommissie` | Members + dossiers |
| `LidReader` | `lid` | `fetchLid`, `fetchLidVotes`, `fetchLidTouchedInstruments` | Voting record, touched laws |
| `FractieReader` | `fractie` | `fetchFractie`, `fetchFractieTouchedInstruments` | Party profile (note: backend returns raw graph-node shape — normalised in helper) |
| `StemmingReader` | (collection-keyed) | `fetchStemming` | Per-fractie outcomes |
| `ActivityReader` | `activity` | parliamentary-client | Vergadering metadata |
| `InstrumentReader` | `instrument` | `fetchInstrument`, structure fetch | Article-tree navigator |
| `FallbackReader` | unknown | none | Renders raw props |

## Adding a new reader

If you've added a new node-kind (see [`graph-system.md`](graph-system.md#adding-a-new-node-kind)):

1. Create `src/lib/components/explore/readers/MyKindReader.svelte`.
2. Mirror an existing reader's shape (state machine, error/empty branches, section layout).
3. Register in `KindReader.svelte` by adding a `{:else if selection.kind === 'mykind'}` branch.
4. If the reader is text-heavy like article/judgment, wrap it in `ReaderFrame` and `ReaderHead`. If it's section-heavy like dossier, use `<section class="sec">` blocks.
5. Wire `onNavigate` if the reader exposes intra-graph navigation.
6. Add an entry to the inventory table above when you commit.

## Related files

| Concern | File |
|---|---|
| Dispatcher | `src/lib/components/explore/KindReader.svelte` |
| Text readers | `src/lib/components/explore/readers/ArticleReader.svelte`, `JudgmentReader.svelte`, `ReaderFrame.svelte`, `ReaderHead.svelte` |
| Judgment text parsing | `src/lib/components/explore/readers/judgment-text.ts` |
| Per-kind readers | `src/lib/components/explore/readers/*.svelte` |
| Whole-law reader (`mode=read`) | `src/lib/components/explore/WholeLawReader.svelte` |
| Reader navigation | `src/lib/components/explore/LezenNav.svelte` |
| Citation rail | `src/lib/components/explore/CitationRail.svelte` |
| Reader/rail bridge state | `src/lib/stores/reader.ts` |
| Status bar (top of reader) | `src/lib/components/explore/StatusBar.svelte` |

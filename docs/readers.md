# Readers

The reading surfaces of `/explore` for the selected source, in three places:

| Place                   | Modes           | Component                                                                                              |
| ----------------------- | --------------- | ------------------------------------------------------------------------------------------------------ |
| Reader                  | `split`, `read` | `KindReader.svelte`, which picks one reader per source                                                 |
| Overview (left, `read`) | `read`          | `LezenNav.svelte`: article list of a law; for parliamentary sources `readers/nav/*`                    |
| Rail (right)            | `split`, `read` | `CitationRail.svelte`: citations of an article or judgment; for parliamentary sources `readers/rail/*` |

`explore/+page.svelte` places them and passes `onNavigate` to each.

## Dispatch

`KindReader.svelte` is one flat `{#if}` chain on the selection. `collection` decides first for `decisions`, because a decision has kind `activity`; after that `kind` decides. `activities` are tested by collection for the same reason. No selection renders `ArticleReader` with a null selection, which shows the empty state of `ReaderFrame`.

| Selection     | Reader             | Reads                                                                                                                 |
| ------------- | ------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `decisions`   | `DecisionReader`   | `/api/decisions/{key}`, `/api/decisions/{key}/document`                                                               |
| `article`     | `ArticleReader`    | `getArticleDetail`, `/api/articles/{bwb_id}/{n}/in-flux`; `ArticleLegislativeHistory` reads `.../legislative-history` |
| `judgment`    | `JudgmentReader`   | `getJudgmentDetail`                                                                                                   |
| `document`    | `DocumentReader`   | `/api/documents/{key}`                                                                                                |
| `dossier`     | `DossierReader`    | `/api/dossiers/{number}`, `/api/dossiers/{number}/timeline`                                                           |
| `committee`   | `CommitteeReader`  | `/api/committees/{slug}`                                                                                              |
| `member`      | `MemberReader`     | `/api/members/{key}`, `.../touched-instruments`                                                                       |
| `faction`     | `FactionReader`    | `/api/factions/{key}`, `.../touched-instruments`                                                                      |
| `activities`  | `ActivityReader`   | `getNodeGraph`: the neighbours of the activity                                                                        |
| `instrument`  | `InstrumentReader` | Renders `WholeLawReader`: `/api/instruments/{bwb_id}/articles`, paged                                                 |
| anything else | `FallbackReader`   | Nothing: `collection`, label and the first twelve `props`                                                             |

`FallbackReader` appears when a kind has no reader.

The endpoints are described in the API's [`api.md`](../../lawgraph/docs/api.md). Calls go through `$lib/api/client` (see [`api-client.md`](api-client.md)).

## Structure of a reader

A reader that loads data holds its state as `view` (`loading`, `error`, `loaded`; the text readers add `empty`) and loads in an `$effect` that aborts its request (or ignores a late answer) when the selection changes. A reader depends on primitives such as the key or `bwb_id`, so a new selection object for the same source does not reload it.

`ArticleReader` and `JudgmentReader` render text and use `ReaderFrame` (scroll container, empty, loading and error states) and `ReaderHead` (sigil, kind label, title, and a snippet for extra rows). The frame is sized per mode by `explore/+page.svelte` (`.reader-frame`). `judgment-text.ts` holds the pure helpers that structure judgment text. Article and judgment text link to the sources they cite through `ArticleText` and `CitedText` (`src/lib/components/articles`).

The parliamentary readers are sections built from their own request. Shared helpers for them are in `src/lib/components/parliamentary/data.ts`, and the labels for stages and tracks in `stages.ts`. `_shared.ts` holds date formatting and `textProp`, which reads an untyped prop.

`ArticleReader` records the law name of the article with `recordInstrument`, so the status bar and the citation panel can show it.

## Navigation

```ts
onNavigate?: (collection: string, key: string) => void;
onPrev?: () => void;
onNext?: () => void;
```

`onNavigate` is called for a citation or an in-reader link. In `explore/+page.svelte` it is `handleRailNavigate`: it expands the node (`neighborLimit` 30), focuses it, writes `?focus=` and, where the network is visible, expands around it. `onPrev` and `onNext` exist in `mode=read` only; the page derives them from the article list that `LezenNav` reports through `onitems`.

## Adding a reader

1. Create `explore/readers/{Kind}Reader.svelte` with `node: GraphNode` (or `selection`) as prop and a `view` state.
2. Add a branch to `KindReader.svelte`, before any branch that also matches the source.
3. For a text source, use `ReaderFrame` and `ReaderHead`.
4. Add a nav or rail component and a branch in `LezenNav.svelte` or `CitationRail.svelte` if the source has a left or right column.
5. The kind itself is added as described in [`graph-system.md`](graph-system.md#adding-a-node-kind).

`StatusBar.svelte` (the bar above the panels: selection path, history, mode) and `CitationCopy.svelte` (citation formats in the rail) read the selection's props and need no change for a new reader.

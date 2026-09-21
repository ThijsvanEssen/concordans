# Gotchas

Things that are wrong or surprising but aren't bugs to fix on the frontend. Document so the next person doesn't re-debug them.

## In-flux mismatch

**Symptom:** A node has a Mutatie badge with count `2`, but selecting it in the reader shows no in-flux dossier chips, and no edges from any open dossier point at it in the graph.

**Root cause:** Backend endpoint disagreement.

| Endpoint                                                                       | Drives                 | For art. 140 Sv reports |
| ------------------------------------------------------------------------------ | ---------------------- | ----------------------- |
| `GET /api/nodes/in-flux`                                                       | Mutatie badges         | `count: 2`              |
| `GET /api/articles/{bwb}/{n}/in-flux`                                          | Reader badge           | `open_dossier_count: 0` |
| `GET /api/articles/{bwb}/{n}/legislative-history`                              | Reader chips           | `entries: []`           |
| Sum of `/api/dossiers/{X}/mutations.edges[].to_id` over first 50 open dossiers | Dossier-scoped overlay | `0 hits`                |

Multiple BWBR0001854 (Wetboek van Strafvordering) articles show the same pattern. The bulk endpoint over-reports.

**Frontend behaviour:** the Mutatie badge fires because we trust the bulk endpoint; the reader chips stay empty because we trust legislative-history. Don't patch by hiding the badge when chips are empty — that masks the bug. Report it backend-side.

**Investigation entry points:** `src/lib/api/parliamentary-client.ts` (`fetchInFluxMap`, `fetchDossierInFluxMap`), `src/lib/components/explore/readers/ArticleReader.svelte` (chip rendering).

## Search index is title-narrow

**Symptom:** Pasting the full title of a dossier into cmd-K returns 0 results. Words that demonstrably appear in the title (e.g. "volkshuisvesting", "versterking", "regie") also return 0.

**Root cause:** The backend search index for dossiers includes the `kamerstuknummer` and a short canonical title (e.g. `Huisvestingswet 2014`) but not the verbose `titel`. Searching by content of the verbose title is not supported.

**What does work:**

| Query                                | Hits |
| ------------------------------------ | ---- |
| `36881` (kamerstuknummer)            | 1    |
| `Huisvestingswet 2014`               | 4    |
| `Woningwet`                          | 4    |
| `volkshuisvesting`                   | 0    |
| `versterking regie volkshuisvesting` | 0    |

**Frontend behaviour:** none. The cmd-K and `/search` page both pass the user's literal query through to `/api/search`. The fix is backend (extend the index to include `titel`, ideally with stemming/tokenisation).

## Sigma node-size scaling vs overlay anchors

**Symptom:** Mutatie badges drift away from where graph edges visibly terminate when the user zooms.

**Root cause:** Sigma renders nodes at `attrs.size / zoomToSizeRatioFunction(cameraRatio)` pixels, but overlay code used `attrs.size` as if it were already pixels.

**Fix (in place):** compute `sizeDivisor = Math.min(Math.sqrt(cameraRatio), 1.5)` once per frame and divide `attrs.size` by it before using as a radius. The divisor must match the `zoomToSizeRatioFunction` setting passed to sigma at construction.

**Watch for:** if you change `zoomToSizeRatioFunction` in `GraphCanvas.svelte` sigma settings, change `sizeDivisor` in `updateViewportLabels` to match. They're not derived from each other.

## URL state survives, store state doesn't

**Symptom:** A user reloads `/explore?focus=...&overlay=heat:12&mode=split` and the graph is empty.

**Root cause:** `GraphStore` lives in memory only. Reload throws away nodes/edges. The URL contract says "focus + overlay + mode" — it doesn't say "the previous graph data". The page re-bootstraps from the focus.

This is by design — if URL state implied "restore the graph", we'd have to serialise hundreds of node ids into the URL or accept that deep links produce different graphs depending on prior history. The current contract is "deep links reseed from the focus point".

**Implication for new features:** if you add a feature that depends on a particular set of nodes being loaded, either trigger a load on mount (the seed pattern) or accept that the feature only works after manual expansion. Don't assume the store will be populated.

## Two routes that look like duplicates: `/search` vs cmd-K overlay

They share data but have different policies. Easy to wander into one expecting the other:

|                                | cmd-K (`SearchOverlay.svelte`)       | `/search` page                    |
| ------------------------------ | ------------------------------------ | --------------------------------- |
| `limit` param to `/api/search` | `FETCH_LIMIT = 25` (per type)        | `50` (per type)                   |
| Rendering                      | sliced to `RENDER_CAP` per type      | renders everything fetched        |
| Truncation hint                | `+ N meer →` row per group           | none — page shows all             |
| Anchor support                 | links to `/search?q=…#articles` etc. | hosts the `id="articles"` anchors |
| Keyboard nav                   | yes (ArrowDown/Up/Enter on rows)     | no                                |

If you raise one limit, consider whether the other should follow.

## `inFluxCount` was renamed to `inFluxDossiers` in the reader

The reader used to fetch only the open dossier count (`fetchArticleInFlux`) and show a small badge. It now fetches the full legislative-history list, filters `status === 'voorgesteld'`, and renders a chip per open dossier with a deep-link to a dossier-scoped graph view.

If you grep for `inFluxCount`, you'll find nothing. The state is `inFluxDossiers: InFluxDossier[]` and `inFluxDossiers.length` plays the role of the old count.

## Svelte 5 `{@const}` placement gotcha

Svelte 5 requires `{@const}` to be the **immediate child** of `{#if}`, `{#each}`, `{:else}`, `{#snippet}`, `<svelte:fragment>`, or a component. Putting it inside a regular `<div>` that's inside an `{#if}` fails to compile.

Workaround when you'd want a per-group const: inline the call twice in the `{#if}` predicate and body. Cheap if the function is a map lookup. Example in `SearchOverlay.svelte`:

```svelte
{#if moreOf('articles') !== 0}
	<a ...>{moreLabel(moreOf('articles'))} wetsartikelen →</a>
{/if}
```

## Variables named `state` or `props`

**Symptom:** `svelte-check` reports `Block-scoped variable '$state' used before its declaration`, `'state' implicitly has type 'any'`, or the same for `$props`. Everything derived from the variable degrades to `any`, which hides real type errors elsewhere in the file.

**Root cause:** Svelte treats `$name` as a store subscription to a variable `name`. A local `let state = $state(...)` or `const props = $derived(...)` makes the rune resolve to the variable.

**Fix:** name the variable `view`, `status`, `nodeProps` or similar. The readers use `view` for their load state.

## Generated API types lag the backend

`src/lib/api/generated/openapi-types.ts` comes from `openapi.json`, synced by hand with `npm run sync:api`. The backend has added fields since the last sync (article `leden` and `citation_formats`, judgment `subjects`, `shorthand`, `judgment_metadata` and `text`, instrument `citation_title`). `src/lib/api/types.ts` declares them as intersections over the generated types. After a sync, remove the intersections that the schema now covers.

`src/lib/api/openapi.json` is a second, older copy used only by the `/api` documentation page. It is not the sync target.

## Type check status

`npm run check` reports 0 errors. Warnings (unused CSS selectors in the docs pages, `autofocus`, one non-reactive `activeDrag` in `explore/+page.svelte`) are not fixed.

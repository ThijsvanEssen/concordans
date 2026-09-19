# Search

Two UI surfaces share one backend endpoint with different policies. This document covers both, the caps that mediate them, and the ranking limitations they sit on top of.

## Surfaces

| Surface | File | Purpose |
|---|---|---|
| cmd-K overlay | `src/lib/components/layout/SearchOverlay.svelte` | Fast typeahead from anywhere in the app |
| `/search` page | `src/routes/(main)/search/+page.svelte` | Full results, hash-anchored subgroups |

Both call `unifiedSearch(query, opts)` from `src/lib/api/search.ts`, which posts to `/api/search`.

### `unifiedSearch` shape

```ts
type UnifiedResults = {
  articles: SearchResultItem[];
  judgments: SearchResultItem[];
  instruments: SearchResultItem[];
  dossiers: SearchResultItem[];
  publications: SearchResultItem[];
  commissies: SearchResultItem[];
  leden: SearchResultItem[];
  fracties: SearchResultItem[];
};

async function unifiedSearch(
  query: string,
  opts: { types?: string; limit?: number; signal?: AbortSignal } = {}
): Promise<UnifiedResults>;
```

The `limit` is **per-type**, not total. The backend returns at most `limit` items in each requested type's bucket.

## Backend endpoint

`GET /api/search?q=...&types=articles,judgments,instruments,dossiers,publications,commissies,leden,fracties&limit=N`

Response shape:

```json
{
  "q": "...",
  "types": ["articles", "judgments", ...],
  "total": 47,
  "results": {
    "articles": [ { id, key, collection, type, display_name, snippet, score, extra }, ... ],
    "dossiers": [ ... ],
    ...
  }
}
```

`total` is the grand total across all returned buckets after the per-type cap. It's a useful display value but not a reliable signal of "more results exist server-side" — buckets that hit the cap silently truncate.

### Ranking surface area

The backend ranks each bucket independently. The frontend doesn't see the ranking logic. What we know from probing:

| Behaviour | Observed |
|---|---|
| Case sensitivity | Insensitive (`Huisvestingswet` ≡ `huisvestingswet`) |
| Token splitting | Yes — space-separated, AND-combined |
| Substring matching | No — `huisvesting` does not match `Huisvestingswet` |
| Whole-word matching | Partial — works for some fields, not all |
| Stemming | No |
| Verbose dossier `titel` indexed | No — only `kamerstuknummer` and short titles |

See [`gotchas.md`](gotchas.md#search-index-is-title-narrow) for the implications. The TL;DR is: pasting a long verbatim dossier title into search will not find it. Frontend can't fix this.

## cmd-K overlay

### Caps

```ts
const FETCH_LIMIT = 25;
const RENDER_CAP: Record<keyof UnifiedResults, number> = {
  articles: 10,
  instruments: 6,
  judgments: 8,
  dossiers: 8,
  commissies: 6,
  fracties: 6,
  leden: 6,
  publications: 8,
};
```

`FETCH_LIMIT` is what we send to the backend (per type). `RENDER_CAP` is what we render in the dropdown. Anything beyond the render cap gets a `+ N meer →` row at the bottom of the subgroup linking to `/search`.

### "More" detection

```ts
function moreOf(key: keyof UnifiedResults): number {
  const total = (results[key] ?? []).length;
  const shown = (vis[key] ?? []).length;
  if (total > shown) return total - shown;
  return total >= FETCH_LIMIT ? -1 : 0;   // -1 = "more exists, count unknown"
}
```

Two cases yield "more":

1. We rendered fewer than we fetched (rendered ≤ render cap < fetched).
2. We fetched exactly `FETCH_LIMIT` (the backend hit our fetch cap — there may be more server-side).

In case (1), `moreOf` returns the exact difference. In case (2), it returns `-1` and the label degrades to `+ meer dossiers →` without a number.

### Deep links

The `+ N meer →` rows link to `/search?q=...#dossiers` (or whichever subgroup). The `/search` page has matching `id="dossiers"` anchors, so the browser scrolls to the right section.

### Keyboard navigation

`flatItems` is the ordered list of *visible* results across all enabled domains, in the same order they appear on screen. Arrow keys move `focusedIndex` along this list. The `offsetX()` helpers compute where each subgroup starts in the flat index so the `class:result-row--focused={idx === focusedIndex}` highlighting matches.

Domain visibility chips (`showWet`, `showRecht`, `showTk`) filter what enters `flatItems`. Clicking a chip narrows both rendering and keyboard nav coherently.

### Debounce + cancellation

60 ms debounce on input, with `AbortController` cancelling the previous request the moment the user types another character. Previous results stay on screen during in-flight requests (no flash to empty); only `loading` flips.

```
type → clearTimeout → abort prev → setTimeout(60ms) → fetch → if not aborted, set results
```

See `state-and-stores.md` for the canonical debounce-with-abort pattern.

## `/search` page

### Caps

`limit=50` (per type). No `RENDER_CAP` — the page renders everything fetched. If a type still has 50 results, we're capped but the user has more recourse than in the dropdown (they can refine the query, or the missing results probably weren't useful anyway).

### Anchored subgroups

Every subgroup has an HTML `id`:

| id | Section |
|---|---|
| `instruments` | Wetgeving → Instrumenten |
| `articles` | Wetgeving → Artikelen |
| `judgments` | Rechtspraak (first tier — others have no id) |
| `dossiers` | Parlementair → Wetgevingsdossiers |
| `commissies` | Parlementair → Commissies |
| `fracties` | Parlementair → Fracties |
| `leden` | Parlementair → Kamerleden |
| `publications` | Parlementair → Publicaties |

These exist for the cmd-K "+ meer →" deep links. If you add a new bucket, add its anchor.

### Domain chips

Same `showWet` / `showRecht` / `showTk` toggles as the overlay. The page also re-runs the search form on submit, so users can refine the query without leaving the page.

## Ranking caveats and how to live with them

When a search query underperforms, the cause is almost always one of:

1. **Index narrowness** — the field the user expected to search isn't indexed. Verify with the backend.
2. **AND-token requirement** — every word must match. `vereenvoudiging Woningwet` returns fewer than `Woningwet` alone because `vereenvoudiging` isn't indexed for that document.
3. **No fuzzy matching** — typos return zero. We don't apply Levenshtein client-side.
4. **No partial-word matching** — `huisvest` won't match `huisvesting`. Substrings don't fire.

Frontend mitigations that *aren't* warranted:

- **Don't add client-side fuzzy matching** over the returned results — the results don't include enough text to fuzz against.
- **Don't synthesise queries** by splitting the input and OR-ing variants. The backend rate-limits, and we'd hammer it.
- **Don't add "did you mean" suggestions** without backend support — we don't have the data to compute them.

What *is* fair game:

- A "Try this in full search →" hint when the query is long and returns zero results, since the `/search` page is no worse.
- A "Search by Kamerstuknummer" prompt when input looks like `\d{5,6}`.
- Documenting the caveat for users in `/docs` section III.

## Search ranking inputs

The `score` field on each `SearchResultItem` is set by the backend. The frontend doesn't re-rank. Buckets are returned in (we believe) score-descending order, and we render them that way.

If we ever need cross-bucket re-ranking — e.g. "show the highest-scoring result first regardless of type" — that's a backend change. Don't mix bucket order client-side; the visual grouping by domain is part of the UX.

## SearchResultItem shape

```ts
interface SearchResultItem {
  id: string;            // canonical "{collection}/{key}"
  key: string;
  collection: string;
  type: string;          // alias for collection-derived display type
  display_name: string | null;
  snippet?: string | null;
  score: number;
  extra?: {              // type-specific fields
    bwb_id?: string;
    article_number?: string;
    ecli?: string;
    kamerstuknummer?: string;
    partij?: string;
    afkorting?: string;
    citation_title?: string;
    [k: string]: unknown;
  };
}
```

The `extra` bag carries domain-specific metadata used for sub-grouping (`bwb_id` for article→law grouping, `ecli` for judgment court-tier classification, `kamerstuknummer` for dossier display).

## Adding a new searchable type

1. Backend adds the type to `/api/search`'s allowed `types` set and returns a bucket for it.
2. Add the field to `UnifiedResults` in `src/lib/api/search.ts`.
3. Update `empty: UnifiedResults` literals where they appear (currently in `SearchOverlay.svelte` and `/search/+page.svelte`).
4. Add `RENDER_CAP[newType]` to the overlay.
5. Add render block + anchor id to both surfaces.
6. Update `flatItems` and the `offsetX()` helpers in `SearchOverlay.svelte`.
7. Update [`routes.md`](routes.md) (anchor list) and the docs page if you add user-facing copy.

That's ~7 touchpoints. The plumbing isn't elegant — there's no register-once API for search buckets — but each bucket has slightly different rendering (article→law grouping, judgment→court grouping, kamerstuk fallback, etc.) so the explicit listing is honest.

## Related files

| Concern | File |
|---|---|
| API wrapper | `src/lib/api/search.ts` |
| cmd-K overlay | `src/lib/components/layout/SearchOverlay.svelte` |
| `/search` page | `src/routes/(main)/search/+page.svelte` |
| Opener context | `src/lib/stores/search-trigger.ts` |
| Glossary tooltips | `src/lib/glossary.ts` |
| Court tier helpers | `src/lib/graph/types.ts` (`judgmentTier`, `formatEcliLabel`) |

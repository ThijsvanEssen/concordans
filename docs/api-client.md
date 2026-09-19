# API client

How the frontend talks to the FastAPI backend. Three primitives, a per-domain wrapper layer, and one source of truth for the contract.

## Primitives — `src/lib/api/client.ts`

Three functions cover every HTTP call in the app:

```ts
apiGet<T>(path: string, opts?: { signal?, params? }): Promise<T>
apiPost<T>(path: string, body: unknown, opts?: { signal? }): Promise<T>
apiDelete(path: string, opts?: { signal? }): Promise<void>
```

They share four invariants:

1. **Base URL** comes from `PUBLIC_CONCORDANS_API_BASE_URL` (default `http://localhost:8000`; `PUBLIC_LAWGRAPH_API_BASE_URL` is still honored as a legacy fallback). `new URL(path, API_BASE)` does the join, so callers always pass leading-slashed relative paths (`/api/articles/...`).
2. **Timeout** is always applied — `AbortSignal.timeout(10_000)` composed with the caller's signal via `AbortSignal.any`. Requests never hang forever.
3. **JSON in, JSON out.** `Accept: application/json` set on every request. `apiPost` also sets `Content-Type` and stringifies the body.
4. **Non-2xx → throw.** Every helper throws `Error('API {METHOD} {url} failed with status {N}')` on `!res.ok`. Callers handle errors via try/catch or `.catch(...)`. There is no global error handler.

### Performance logging

`apiGet` logs every call to the console with a `[perf]` (or `[perf!]` if > 300ms) prefix, broken into fetch/body/parse phases plus payload size. Useful when chasing "why is this slow" — usually the body parse for endpoints that return thousands of items.

If you find yourself bypassing `apiGet` to skip the log, lift it into a flag instead. Don't bypass the timeout.

### When to bypass

Never. Components must not call `fetch` directly. If you need a non-JSON response (e.g. SSE, binary), add a fourth primitive in `client.ts` and reuse the signal/timeout pattern.

## Domain helpers

The next layer down wraps `apiGet`/`Post` with typed signatures, default params, and the right path construction. There's one file per loose domain:

| File | Domain |
|---|---|
| `parliamentary-client.ts` | Dossiers, mutations, articles, in-flux, heat, commissies, leden, fracties, stemmingen, instruments, judgments, watches |
| `search.ts` | `/api/search` — both shapes (`searchSimple` and `unifiedSearch`) |
| `articles.ts` | Article detail + helpers |
| `nodes.ts` | `/api/nodes/expand`, `/api/nodes/{collection}/{key}` |
| `judgments.ts` | Judgment detail + citations |
| `mvt.ts` | Memorie van toelichting passage lookup |
| `stats.ts` | Corpus stats for the landing page |
| `instrument-cache.ts` | BWB → law metadata in-memory cache (writable store) |

`parliamentary-client.ts` is the largest — most domain calls live there because parliamentary data dominates the corpus. Don't worry about splitting it further unless one domain genuinely becomes its own bounded context.

### Helper conventions

- Always accept `signal?: AbortSignal` as the last parameter (or inside an `opts` object). Callers pass it when they need to cancel.
- Always return the typed DTO — no `any`. If the backend payload differs from the OpenAPI shape, normalise in the helper (see `fetchFractie` in `parliamentary-client.ts:163` for an example: it adapts a raw graph-node shape to the flat `FractieDTO`).
- Encode path components with `encodeURIComponent`. Even kamerstuknummers — they're usually numeric, but BWBs with slashes or apostrophes have existed.
- For map-shaped responses (`Record<string, number>` etc.), return a `Map` not the object so callers get O(1) `.get()` and `.set()`.

```ts
export async function fetchInFluxMap(signal?: AbortSignal): Promise<InFluxMap> {
  const raw = await apiGet<Record<string, number>>('/api/nodes/in-flux', { signal });
  return new Map(Object.entries(raw));
}
```

## Types — single source of truth

```
openapi.json  ────►  src/lib/api/generated/openapi-types.ts  ────►  src/lib/api/types.ts
   (backend)         (codegen — do not edit)                        (frontend-friendly aliases)
```

The pipeline:

1. **Backend publishes `openapi.json`** at the repo root.
2. **`openapi-typescript`** regenerates `src/lib/api/generated/openapi-types.ts`. Run via `npx openapi-typescript openapi.json -o src/lib/api/generated/openapi-types.ts`. CI doesn't enforce this — regenerate manually when the contract changes.
3. **`src/lib/api/types.ts`** re-exports clean aliases (e.g. `DossierDetailResponse` instead of `components["schemas"]["DossierDetailResponse"]`).
4. **Domain helpers and components** import from `types.ts` (via `parliamentary.ts` for the parliamentary domain), never from `generated/`.

See [`api-contract.md`](api-contract.md) for the regeneration steps.

### Why this pipeline

OpenAPI codegen gives us:
- Compile-time guarantees that the backend and frontend agree on shapes.
- Free updates when the backend changes — bumping `openapi.json` reveals every drift in `svelte-check`.
- No manual maintenance of DTOs.

The cost is one indirection (`generated → types.ts → consumers`) so we can rename ugly auto-generated names without monkey-patching the generated file.

## Endpoint surface

A non-exhaustive map, grouped by purpose. See `openapi.json` for the full contract.

### Graph data

| Endpoint | Purpose |
|---|---|
| `GET /api/nodes/expand` | Expand a node's neighbourhood (the workhorse for click-to-expand) |
| `GET /api/nodes/{collection}/{key}` | Single node detail |
| `GET /api/nodes/in-flux` | Bulk in-flux counts per node |
| `GET /api/nodes/heat?months=N` | Bulk citation counts per node over N-month window |

### Articles & instruments

| Endpoint | Purpose |
|---|---|
| `GET /api/articles/{bwb}/{n}` | Article detail (text, leden, citaties) |
| `GET /api/articles/{bwb}/{n}/legislative-history` | Article's mutation history including open dossiers |
| `GET /api/articles/{bwb}/{n}/in-flux` | Cheap in-flux check for one article |
| `GET /api/instruments` | Paginated instrument list |
| `GET /api/instruments/{bwb}` | Instrument detail |
| `GET /api/instruments/{bwb}/articles` | All articles in one law |

### Dossiers

| Endpoint | Purpose |
|---|---|
| `GET /api/dossiers/{kamerstuknummer}` | Detail |
| `GET /api/dossiers/{kamerstuknummer}/timeline` | Activity timeline |
| `GET /api/dossiers/{kamerstuknummer}/documents` | Attached kamerstukken |
| `GET /api/dossiers/{kamerstuknummer}/mutations` | Pending-mutation subgraph |
| `GET /api/dossiers/open` | All open dossiers |
| `GET /api/dossiers/recent` | Recently active |

### Search

| Endpoint | Purpose |
|---|---|
| `GET /api/search?q=&types=&limit=` | Grouped multi-type search. `types` is a comma-list; `limit` is per-type. |

### Parliament

| Endpoint | Purpose |
|---|---|
| `GET /api/commissies`, `/api/commissies/{slug}` | Commissions |
| `GET /api/leden`, `/api/leden/{key}` | Kamer members |
| `GET /api/leden/{key}/votes`, `/touched-instruments` | Member-scoped data |
| `GET /api/fracties`, `/api/fracties/{key}` | Parties |
| `GET /api/stemmingen`, `/api/stemmingen/{key}` | Votes |
| `GET /api/partijen/kleuren` | Party colour palette |
| `GET /api/parlement/zetels` | Seat distribution |

### Watches (server-backed)

| Endpoint | Purpose |
|---|---|
| `POST /api/watches`, `DELETE /api/watches/{id}` | Server-stored watches (when used) |

Note: the watch endpoints exist and `stores/watches.ts` wraps them, but `WatchControl.svelte` is not mounted anywhere, so no UI creates watches today.

## Caching

The app uses three layers of in-process caching:

1. **`instrument-cache.ts`** — BWB → metadata map. Populated lazily via `ensureInstrumentMeta(bwbId)`. Backs friendly law names in search results and reader headers. Survives the page session, not reloads.
2. **`GraphStore.cache`** — `NodeGraphResponse` keyed by `{collection}/{key}`. Avoids re-fetching the same expansion when the user navigates back/forward. Cleared on `store.reset()`.
3. **Browser HTTP cache** — relied on for static-ish endpoints (`/api/partijen/kleuren`, `/api/instruments`). The backend sets appropriate `Cache-Control` headers; the frontend doesn't override.

There is **no SWR / persistent client cache** (no `react-query` equivalent). If you find yourself needing one, lift the pattern into a typed helper rather than dropping in a library — most of the app's caches are domain-specific anyway.

## Error handling

The default policy is **let the helper throw, handle close to the user**:

```ts
try {
  const data = await fetchDossier(nummer);
  state = { kind: 'loaded', d: data };
} catch {
  state = { kind: 'error', message: 'Dossier kon niet geladen worden.' };
}
```

For overlay/sidekick data where empty-is-fine, the convention is silent best-effort:

```ts
fetchInFluxMap()
  .then((m) => { inFluxMap = m; })
  .catch(() => { /* best-effort — no visual if unavailable */ });
```

Aborts are not errors. Always check `(err as { name?: string })?.name === 'AbortError'` before showing a failure state, or scope the try/catch carefully so abort propagates up:

```ts
try {
  const r = await unifiedSearch(q, { signal: ctrl.signal });
  if (!ctrl.signal.aborted) results = r;
} catch (err) {
  if ((err as { name?: string })?.name === 'AbortError') return;
  // real error
}
```

## Rate limiting

The backend rate-limits aggressively (we hit `429` during dev investigation runs). The frontend doesn't have a retry/backoff layer — if you see `429s` in the console, you're either firing too many requests in a tight loop (audit `$effect` for missing deps) or doing it deliberately (in which case add a small `setTimeout`-based throttler local to the call site).

## Adding a new endpoint

1. Regenerate `openapi-types.ts` if the backend added the endpoint.
2. Add the DTO alias to `src/lib/api/types.ts` and re-export from `parliamentary.ts` if it's a parliamentary domain type.
3. Add the helper to the appropriate `*-client.ts` file (or create a new file if it's a genuinely new domain).
4. Components / store loaders import the helper, not `apiGet` directly.
5. If the endpoint produces overlay data, see [`overlays.md`](overlays.md) for the integration pattern.

## Related files

| Concern | File |
|---|---|
| Primitives | `src/lib/api/client.ts` |
| Domain helpers | `src/lib/api/parliamentary-client.ts`, `search.ts`, `articles.ts`, `nodes.ts`, `judgments.ts`, `mvt.ts`, `stats.ts` |
| Type aliases | `src/lib/api/types.ts`, `parliamentary.ts` |
| Generated types | `src/lib/api/generated/openapi-types.ts` (do not edit) |
| Caches | `src/lib/api/instrument-cache.ts`, `src/lib/graph/store/context.ts` (`cache` field) |
| Contract | `openapi.json` (repo root) |

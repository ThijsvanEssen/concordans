# Routes

Every URL the app responds to, what it does, and what query params it honours. The URL is the durable state surface — anything that should survive a reload or be deep-linkable lives here.

## Map

| URL | Purpose |
|---|---|
| `/` | Landing page with hero, search prompt, recent activity |
| `/explore` | The verkenner — graph + readers (the main app surface) |
| `/search` | Full search results page (target of cmd-K "+ meer →" deep links) |
| `/docs` | End-user documentation (Dutch, in-app) |
| `/docs/methode` | Methodology and architectural decisions |
| `/docs/sneltoetsen` | Keyboard shortcut reference |
| `/api` | Public API documentation |
| `/nodes/[collection]/[key]` | Canonical permalink for any node |
| `/publications` | Publication index (filterable list) |
| `/publications/[key]` | Single publication reader |
| `/alpha` | Status of the alpha release |
| `/colofon` | Imprint |
| `/contact` | Contact info |
| `/privacy` | Privacy notice |
| `/voorwaarden` | Terms of use |

## `/explore` — query contract

The richest route. All state that isn't kept in the in-memory `GraphStore` rides on query params.

| Param | Values | Default | Effect |
|---|---|---|---|
| `mode` | `graph`, `split`, `read`, `index` | `graph` | Which surface to show. See "Modes" below. |
| `focus` | `{collection}/{key}` (e.g. `instrument_articles/bwbr0001854_140`) | — | Node to focus. Triggers `store.expandNode` on mount/change. |
| `overlay` | `heat:N`, `open`, `dossier:X` | — | Activates an overlay. See [`overlays.md`](overlays.md). |
| `seed` | `dossier:X`, `commissie:slug`, `lid:key`, `fractie:key` | — | One-shot graph bootstrap. Consumed and stripped from URL on success. |
| `wet` | `BWBR...` | — | Read mode: which law to load whole-text. Inferred from `focus` if absent. |
| `all` | `1`, `unbound` | — | "Show all neighbours" toggle; `unbound` removes the convergence prune cap. |
| `kind` | `wetten`, `arresten`, `dossiers`, `commissies`, `leden`, `fracties`, `stemmingen` | `dossiers` | Index-mode category. |
| `q`, `fase`, `has_stage`, `traject_kind`, `aangenomen`, `from`, `to`, `dossier`, `partij` | filter values | — | Index-mode filters. Which apply depends on `kind`. |

### Modes

- **`graph`** (default) — full-bleed canvas + left sidebar (filters, layers, overlays, instruments). Use for free exploration.
- **`split`** — canvas + reader + citation rail, all three resizable. Use when reading a specific node with graph context.
- **`read`** — reader only, whole-law view. The graph still mounts behind the scenes (state preserved) but isn't visible.
- **`index`** — typed list view for one category at a time (dossiers, leden, etc.). Use for browsing rather than path-finding.

Mode switches don't unmount the `GraphStore` — the graph data and camera state persist across `mode=graph` ↔ `mode=split`. See `_cam` in `GraphView.svelte` for camera persistence across the unmount/remount cycle that the `{#if mode === ...}` blocks cause.

### Seed lifecycle

`?seed=X` is a one-shot. The handler in `explore/+page.svelte` is:

1. Detect `seed` ≠ previous seed.
2. Strip `seed` from the URL (so reload doesn't re-trigger).
3. Call the appropriate loader (`store.loadDossierGraph`, `loadCommissieGraph`, etc.).
4. `goto` with `replaceState: true` to commit the URL change.

The result is a deep link that produces a *graph* in the user's session but doesn't persist as part of the durable URL.

### Focus lifecycle

`?focus=` is *not* one-shot — it stays in the URL. The handler:

1. On mount, parse `focus` → `{ collection, key }`.
2. Call `store.expandNode(collection, key)`, which fetches `/api/nodes/expand` (or the focus' canonical detail endpoint) and adds nodes/edges.
3. Call `store.focusNode(id, { recordHistory: false })` to set the selection without pushing onto the back/forward history stack.

Subsequent in-app navigation (clicking a node) calls `store.focusNode(id)` with history enabled, which also updates the URL. Browser back/forward and the in-app `←`/`→` buttons both work via this stack.

### Showing all neighbours

`?all=1` toggles "load every direct neighbour on expand", overriding the default `neighborLimit`. `?all=unbound` further disables the convergence-based prune, so even nodes only reachable through a single path stay on the canvas. Use `unbound` sparingly — on dense nodes (heavily-cited articles) the canvas can balloon to thousands of nodes.

## `/search` — query contract

| Param | Effect |
|---|---|
| `q` | The search string. Empty → empty page. |

Plus hash anchors for direct linking to a subgroup: `#articles`, `#instruments`, `#judgments`, `#dossiers`, `#commissies`, `#fracties`, `#leden`, `#publications`. The cmd-K overlay's "+ N meer →" rows use these.

The page fetches with `limit=50` per type (vs cmd-K's `FETCH_LIMIT=25`). See [`search.md`](search.md).

## `/nodes/[collection]/[key]`

Canonical permalink for any node. Currently a thin page that redirects (or re-routes) into `/explore?mode=split&focus={collection}/{key}` — useful when external sites link to a node and we want to give them a stable URL that doesn't bake the explore-page query contract in.

If you add a new node-kind, the permalink is automatically supported as long as the kind has a route in `KindReader.svelte`.

## `/publications`

Two views in one route:

| URL | Effect |
|---|---|
| `/publications` | Filterable index of all publications |
| `/publications/[key]` | Single publication reader |

The index supports filtering by `soort` (kind of publication: Voorstel van wet, Memorie van toelichting, …) using the `SoortChipFilter` component. Filter state is component-local — not in the URL. (If we ever need shareable filter state, move it to `?soort=`.)

## `/docs` and friends

Three Svelte pages, no API calls:

- `/docs` — long sectioned page (Corpus, Verkenner, Zoeken, Verbindingen, Dossiers & Parlement, API, Verder lezen).
- `/docs/methode` — methodology and design decisions.
- `/docs/sneltoetsen` — keyboard shortcuts reference.

Content lives directly in `+page.svelte` files (no markdown content store). If you make substantial changes, prefer extending the existing section structure rather than introducing a new top-level section unless a topic genuinely doesn't fit.

## Adding a new route

1. Create `src/routes/{path}/+page.svelte`. SvelteKit picks it up.
2. If the route needs URL-driven state, use `$derived($page.url.searchParams.get('foo'))` and `goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true })` for writes. Don't reach for stores unless multiple components on the page need the same state.
3. If the route needs a SvelteKit data load (very rare here — most fetches are client-side), add `+page.ts`. Avoid `+page.server.ts` unless you genuinely need server-side rendering with data.
4. If the route is internal-only or temporary, prefix with `/_` and add to the sitemap exclusion. There's no convention for this yet — add one if you find yourself wanting it.

## Adding a new query param to `/explore`

The page is already heavy. Before you add a param:

1. Can the state live in the `GraphStore` instead? Use that if the state is graph-scoped and doesn't need to be deep-linkable.
2. Can it live in local `$state`? Use that for ephemeral UI state (collapsed panels, filter chips, etc.).
3. If it must be URL-bound, document the contract here and add a parser in `lib/stores/{name}.ts` (mirror the pattern in `stores/overlay.ts` — parser + serializer + discriminated union for non-trivial shapes).

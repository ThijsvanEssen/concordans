# Architecture

High-level shape of the codebase, the data flow, and the lifecycle of a typical request. If you're touching the frontend for the first time, read this before anything else.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | SvelteKit 2 | Routing + client-side hydration. Most rendering is client-side. |
| Reactivity | Svelte 5 runes (`$state`, `$derived`, `$effect`, `$props`) | Newer, no `<script>`-level reactive statements. Compatible with `writable` stores for cross-component data. |
| Graph data | graphology | Mutable in-memory graph. Source of truth for nodes/edges on screen. |
| Graph rendering | Sigma 3 (WebGL) | Fast at 1k+ nodes. Custom node programs (`node-border`, `node-square`) and a dashed-edge program. |
| Overlays | Plain HTML positioned over the canvas | Halos, badges, cluster labels — projected from graph coords via `renderer.graphToViewport()`. |
| Backend client | `fetch` wrapped in `apiGet`/`Post`/`Delete` | Single timeout policy, single error shape, signal threading. |
| API types | OpenAPI codegen → `openapi-types.ts` → aliases in `types.ts` | One source of truth. See [`api-contract.md`](api-contract.md). |

## Directory map

```
src/
├── routes/                            SvelteKit routes
│   ├── explore/+page.svelte           The main app: graph + readers (outside the (main) group)
│   └── (main)/                        Pages with the site chrome
│       ├── +page.svelte               Landing / hero
│       ├── search/+page.svelte        Full search results page
│       ├── docs/                      In-app end-user docs (3 sub-routes)
│       ├── publications/              Per-publication and index pages
│       ├── nodes/[collection]/[key]/  Canonical node permalink
│       ├── api/+page.svelte           Public API documentation page
│       └── (prose)/                   alpha, colofon, contact, privacy, voorwaarden
│
├── lib/
│   ├── api/                           Backend client
│   │   ├── client.ts                  Low-level apiGet / apiPost / apiDelete
│   │   ├── parliamentary-client.ts    Most domain endpoints live here
│   │   ├── search.ts                  /api/search + UnifiedResults shape
│   │   ├── articles.ts, nodes.ts, judgments.ts, mvt.ts, stats.ts
│   │   ├── parliamentary.ts           Domain types (re-exports + aliases)
│   │   ├── types.ts                   Frontend-friendly aliases over generated types
│   │   ├── instrument-cache.ts        BWB → law metadata cache (writable store)
│   │   └── generated/openapi-types.ts (codegen — do not edit)
│   │
│   ├── graph/                         Graph data layer (no UI)
│   │   ├── graph-store.ts             The GraphStore: graphology + history + filters
│   │   ├── types.ts                   GraphNode / GraphEdge + helpers (kind, tier)
│   │   └── profile-seeds.ts           Profile-driven graph bootstrap
│   │
│   ├── components/
│   │   ├── layout/                    AppShell, SearchOverlay, site chrome
│   │   ├── graph/                     GraphView, GraphCanvas, GraphSidebar, panels
│   │   ├── explore/                   Reader, citation rail, status bar, index view
│   │   ├── explore/readers/           One reader per node-kind (Article, Judgment, …), plus ReaderFrame/ReaderHead
│   │   ├── parliamentary/             Dossier-specific UI (stepper, timeline, watch)
│   │   ├── articles/, judgment/, home/, common/, ui/
│   │
│   ├── stores/                        Cross-component state (writable stores)
│   │   ├── overlay.ts                 ?overlay= parser/serializer + Overlay union
│   │   ├── reader.ts                  Reader cache and dispatch state
│   │   ├── watches.ts, profile.ts, search-trigger.ts
│   │
│   ├── search/                        Search-specific utilities (ranking, snippets)
│   ├── articles/                      Article rendering helpers
│   ├── glossary.ts                    Term definitions shown in tooltips
│   ├── util/, utils/                  Generic helpers (perf, dates, law-id, etc.)
│   └── assets/                        Static frontend assets
│
└── app.css, app.html                  Global styles + HTML shell
```

## The two main surfaces

### `/explore` — the verkenner

Single route with three modes selected by `?mode=`:

- `mode=graph` — full-bleed graph, sidebar with filters/overlays/layers
- `mode=split` — graph + reader + citation rail, all three resizable
- `mode=read` — reader only (whole-law mode)
- `mode=index` — typed index view (e.g. all dossiers, all leden)

The mode is a query param, not a route; the page mounts the same `GraphStore` regardless and swaps which components are visible. This makes the graph survive mode switches without refetching.

See [`routes.md`](routes.md) for the full URL contract.

### `/search` and the cmd-K overlay

Two surfaces, one data source (`/api/search`):

- **cmd-K overlay** (`components/layout/SearchOverlay.svelte`) — capped at `FETCH_LIMIT=25` per type, sliced to `RENDER_CAP` per type for the dropdown. Per-group "+ N meer →" links deep-link into `/search`.
- **`/search` page** (`routes/search/+page.svelte`) — `limit=50` per type, no slicing, anchored subgroup ids for deep links.

See [`search.md`](search.md).

## Data flow

```
URL params  ──────────► reads in $derived
                              │
                              ▼
                  state / fetch decisions
                              │
                              ▼
       ┌─────────── api client (apiGet) ───────────┐
       │                                            │
       ▼                                            ▼
  GraphStore  (graphology + history)          local $state
       │                                            │
       ▼                                            ▼
  GraphView ─► GraphCanvas (sigma)        KindReader / readers
                  │
                  └─► HTML overlays positioned on canvas
```

The pattern in `routes/explore/+page.svelte` is canonical: a single `GraphStore` instance per page-life, URL params drive `$effect`s that decide what to fetch, and fetched data either lands in the store (graph data) or in local `$state` (overlay maps, in-flux lists, etc.).

## Lifecycle of a typical user action

The user opens `/explore?focus=instrument_articles/bwbr0001854_140&overlay=open&mode=split`. What happens, top to bottom:

1. **SvelteKit routes** the URL to `src/routes/explore/+page.svelte` and hydrates it.
2. **`overlay` is parsed** by `parseOverlay($page.url.searchParams.get('overlay'))` → `{ kind: 'open' }`.
3. **An `$effect` keyed on `overlay`** calls `fetchInFluxMap()` → `GET /api/nodes/in-flux` → `Map<nodeId, count>` lands in `inFluxMap` local state.
4. **A different effect keyed on `focus`** asks `store.expandNode('instrument_articles', 'bwbr0001854_140')`, which calls `/api/nodes/expand`, hydrates graphology, and re-runs the FA2 layout worker.
5. **`GraphView` re-renders.** It reads `store.nodes`/`store.edges` via subscriptions, passes data to `GraphCanvas`, which feeds it to Sigma.
6. **`GraphCanvas` projects overlay positions** for in-flux nodes through `renderer.graphToViewport()` and renders Mutatie badges in absolute-positioned divs above the canvas.
7. **`KindReader` mounts** because `mode=split` is set. It reads the current selection from `store.selection`, dispatches on `collection`, and renders `ArticleReader` for `instrument_articles`. The reader fires `fetchArticleLegislativeHistory` in the background to populate the in-flux chip list.
8. **The user clicks a dossier chip.** It's a plain `<a>` to `/explore?seed=dossier:NNNNN&overlay=dossier:NNNNN`. SvelteKit navigates, the seed-handling `$effect` calls `store.loadDossierGraph`, and the dossier-scoped mutation subgraph paints.

## Where state lives

| Kind of state | Lives in | Survives across |
|---|---|---|
| Selected node, hover, history | `GraphStore` (subscriptions) | mode switches; lost on reload |
| Nodes/edges on the canvas | `GraphStore` (graphology) | mode switches; lost on reload |
| Filters, neighbour limit, hide-edges | `$state` in `GraphView` | nothing (resets on page mount) |
| Overlay choice | URL `?overlay=` | reloads, deep links |
| Selected focus | URL `?focus=` | reloads, deep links |
| Watches, profile | `localStorage` via `stores/watches.ts` etc. | reloads, browser sessions |
| Active search query | local `$state` in overlay; URL `?q=` on `/search` | overlay closes → lost; `/search` survives reload |

If you find yourself wanting "global state for X", first check whether X belongs in the URL or in the store you already have.

## Build & dev

```bash
npm install
npm run dev      # vite + sveltekit dev server on :5173
npm run build    # static-ish build via @sveltejs/adapter-auto
npm run check    # svelte-check (TS + Svelte template checks)
npm run lint     # prettier + eslint
```

Backend defaults to `http://localhost:8000`. Override with `PUBLIC_CONCORDANS_API_BASE_URL` (the older `PUBLIC_LAWGRAPH_API_BASE_URL` is still read as a fallback). See [`api-client.md`](api-client.md) for details.

## What this codebase does *not* do

- **No server-side rendering of dynamic data.** SvelteKit's SSR is used only for the shell. All API calls happen client-side. There's no `+page.server.ts`.
- **No authentication state.** All API calls are public. Watches and profile are purely client-side (`localStorage`).
- **No service worker, no offline mode.** The app needs the backend reachable to work.
- **No global error boundary above route level.** Each fetch handles its own error state with explicit `state = { kind: 'error', message }` discriminators in readers, or silent best-effort skipping for overlay/sidekick data.

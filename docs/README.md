# Concordans — developer documentation

A frontend for exploring Dutch legal documents (wetten, jurisprudentie, parlementaire dossiers) as an interactive graph plus a paired reader. This directory documents the codebase for **contributors**.

End-user documentation lives inside the app at [`/docs`](<../src/routes/(main)/docs/+page.svelte>), [`/docs/methode`](<../src/routes/(main)/docs/methode/+page.svelte>), and [`/docs/sneltoetsen`](<../src/routes/(main)/docs/sneltoetsen/+page.svelte>). When in doubt about who a piece of writing is for: code paths and architectural decisions go here, feature walkthroughs and domain explanations go in the in-app docs.

## How to read these docs

| File                                         | Read when                                                         |
| -------------------------------------------- | ----------------------------------------------------------------- |
| [`architecture.md`](architecture.md)         | First read — stack, data flow, request lifecycle                  |
| [`routes.md`](routes.md)                     | You're adding a page or changing URL contracts                    |
| [`graph-system.md`](graph-system.md)         | You're touching anything in `src/lib/graph` or `components/graph` |
| [`overlays.md`](overlays.md)                 | You're working on Activiteit/Mutatie or the `?overlay=` param     |
| [`search.md`](search.md)                     | You're changing cmd-K, `/search`, or the search ranking           |
| [`readers.md`](readers.md)                   | You're adding a new node-type reader or touching reader dispatch  |
| [`api-client.md`](api-client.md)             | You're adding an endpoint or changing the API contract            |
| [`state-and-stores.md`](state-and-stores.md) | You're adding a store or unsure how state is shared               |
| [`gotchas.md`](gotchas.md)                   | Something looks wrong and you suspect it's not your fault         |
| [`api-contract.md`](api-contract.md)         | You're regenerating types from the OpenAPI schema                 |

## Stack at a glance

- **SvelteKit 2** with the Svelte 5 runes API (`$state`, `$derived`, `$effect`, `$props`). Static-ish — most pages are client-rendered from a small SvelteKit shell.
- **Sigma 3 + graphology** for the graph canvas. Sigma owns WebGL rendering; graphology is the in-memory mutable graph. Overlays (halos, badges, cluster labels) are HTML positioned on top of the canvas.
- **FastAPI backend** at a separate origin, contracted via `openapi.json`. Types are codegen'd into `src/lib/api/generated/openapi-types.ts` and used as the source of truth for DTOs in `src/lib/api/types.ts`.
- **No global state framework.** Svelte stores (`writable`) carry cross-component state where rune scope can't reach (watches, profile, overlay parser, etc.). The graph itself is held in a custom `GraphStore` that wraps a graphology instance + history.

## Conventions

- **URL is the state.** Anything that should survive a page refresh or be deep-linkable lives in the URL: `mode`, `focus`, `overlay`, `seed`, `wet`, query params for filters. Components read from `$page.url.searchParams` and write via `goto(..., { replaceState: true })`. Stores are for ephemeral state.
- **Components own their UI, stores own data, routes own URL.** Components don't fetch directly from `apiGet` — they call helpers in `src/lib/api/`. Routes don't render UI primitives — they compose components.
- **Comments explain WHY, not WHAT.** Identifier names should carry the _what_. Comments are for invariants, references to external decisions, and surprises.
- **Dutch in the UI, English in code.** Strings in templates are Dutch ("Wetgeving", "Activiteit"). Identifiers, comments, and docs are English.

## Backend contract

This frontend talks exclusively to the Concordans FastAPI backend documented by `openapi.json` at the repo root. The base URL is set by `PUBLIC_CONCORDANS_API_BASE_URL` (with `PUBLIC_LAWGRAPH_API_BASE_URL` honored as a legacy fallback; default `http://localhost:8000`). All client helpers ride on top of `apiGet`/`apiPost`/`apiDelete` in `src/lib/api/client.ts` — never `fetch` directly in a component.

# Gotchas

## Node size on screen

Sigma draws a node with radius `size / zoomToSizeRatioFunction(cameraRatio)`, not `size`. `GraphCanvas.svelte` sets `zoomToSizeRatioFunction` to `min(sqrt(ratio), 1.5)`, and `updateViewportLabels` computes the same `sizeDivisor` to place halos and badges. The two expressions are not derived from each other: change both, or the overlays drift from the nodes when zooming.

## URL state and store state

The URL holds the view (path and query, see [`routes.md`](routes.md)). The `GraphStore` lives in memory. After a reload the page loads the focus and expands around it; it does not restore the previous canvas. A feature that depends on particular bronnen being on the canvas must load them itself.

`bronHref` reads `page.url`, so a link is reactive only where it is read in a template or a `$derived`.

## Identifiers

- Node keys are lower case in the API and its routes are case-sensitive. `nodes.ts` and `nodeResponse` lower-case the key. `nodeId()` does not: lower-case an ECLI or BWB id before building an id from it.
- The key of a committee is a GUID. The `slug` (a prop) only addresses `/api/committees/{slug}`. Never build a node id from a slug.
- The API addresses a dossier as `29684-I`; its node key is `29684_i`.
- A `decisions` node has `GraphNodeKind` `activity`, like activities, cases and commitments; a cabinet has `committee`, like a commissie. Code that must tell them apart checks `node.collection`, as `KindReader.svelte` does.
- Node `props` are `{ [key: string]: any }` in the schema. Check a real response before reading a prop.

## Cached responses

The API sends `max-age=60` with an ETag that changes after every migration ([`api-client.md`](api-client.md#caching)). Within a minute of a migration a reload can still show the old answer. Records the app has read stay for the session (`once` in `records.ts`); a new tab starts empty.

## Svelte 5

- `{@const}` must be the direct child of `{#if}`, `{#each}`, `{:else}`, `{#snippet}`, `<svelte:fragment>` or a component. Inside a plain element it does not compile.
- A variable named `state` or `props` makes the compiler read `$state` and `$props` as store subscriptions of that variable, and everything derived from it degrades to `any`. Name it `view`, `status` or `nodeProps`. The readers use `view` for their load state.

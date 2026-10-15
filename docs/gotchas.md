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

## Navigation callbacks

`afterNavigate` and `beforeNavigate` can get a `from` or `to` without a url: on the first page `from.url` is null. Read it as `from?.url` and work with that value. A callback that throws on the first page stops SvelteKit's start before the router runs, and from then on every link loads the whole page, with the server HTML first. This shows only in a production build; `npm run dev` navigates as usual. `eerste-verf.test.ts` rejects `from.url` and `to.url` in a file with such a callback.

## Narrow screens

Nothing scrolls sideways on a phone. A flex or grid child that holds text gets `min-width: 0`. A long word gets `overflow-wrap: anywhere`, and an ECLI may break after a colon (`<wbr>`). Text also must not run past its box: a label that overflows its cell still makes the column wider than the screen.

In development, `src/lib/dev/zijscroll.ts` checks each page after navigation at 640 px or less and warns in the console about what scrolls sideways. An area that pans on purpose, such as the categories of Bladeren, the cabinets in time or the line of tekstversies, carries `data-zijscroll`. `src/lib/guards/pagina.test.ts` requires the mark wherever a file sets `overflow-x: auto` or `scroll`.

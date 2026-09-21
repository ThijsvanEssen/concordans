# Gotchas

## Node size on screen

Sigma draws a node with radius `size / zoomToSizeRatioFunction(cameraRatio)`, not `size`. `GraphCanvas.svelte` sets `zoomToSizeRatioFunction` to `min(sqrt(ratio), 1.5)`, and `updateViewportLabels` computes the same `sizeDivisor` to place halos and badges. The two expressions are not derived from each other: change both, or the overlays drift from the nodes when zooming.

## URL state and store state

The URL holds `mode`, `focus`, `overlay`, `seed`, `wet` and the index filters. The `GraphStore` lives in memory. After a reload the page loads the focus and expands it; it does not restore the previous canvas. A feature that depends on particular sources being on the canvas must load them itself.

## Identifiers

- Node keys are lower case in the API and its routes are case-sensitive. `getNodeGraph` and `expandNode` lower-case the key. `nodeId()` does not: lower-case an ECLI or BWB id before building an id from it.
- The key of a committee is a GUID. The `slug` only addresses `/api/committees/{slug}`. Never build a node id from a slug; `?seed=committee:{slug}` looks the key up in `/api/committees`.
- A `decisions` node has `GraphNodeKind` `activity`, like activities, cases and commitments. Code that must tell them apart checks `node.collection`, as `KindReader.svelte` does.
- Node `props` are `{ [key: string]: any }` in the schema. Check a real response before reading a prop.

## Svelte 5

- `{@const}` must be the direct child of `{#if}`, `{#each}`, `{:else}`, `{#snippet}`, `<svelte:fragment>` or a component. Inside a plain element it does not compile.
- A variable named `state` or `props` makes the compiler read `$state` and `$props` as store subscriptions of that variable, and everything derived from it degrades to `any`. Name it `view`, `status` or `nodeProps`. The readers use `view` for their load state.

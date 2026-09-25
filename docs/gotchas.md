# Gotchas

## Node size on screen

Sigma draws a node with radius `size / zoomToSizeRatioFunction(cameraRatio)`, not `size`. `GraphCanvas.svelte` sets `zoomToSizeRatioFunction` to `min(sqrt(ratio), 1.5)`, and `updateViewportLabels` computes the same `sizeDivisor` to place halos and badges. The two expressions are not derived from each other: change both, or the overlays drift from the nodes when zooming.

## URL state and store state

The URL holds `mode`, `focus`, `naast`, `overlay`, `kind`, the index filters and the fragment. The `GraphStore` lives in memory. After a reload the page loads the focus and expands around it; it does not restore the previous canvas. A feature that depends on particular bronnen being on the canvas must load them itself.

`bronHref` reads `page.url`, so a link is reactive only where it is read in a template or a `$derived`.

## Identifiers

- Node keys are lower case in the API and its routes are case-sensitive. `nodes.ts` and `nodeResponse` lower-case the key. `nodeId()` does not: lower-case an ECLI or BWB id before building an id from it.
- The key of a committee is a GUID. The `slug` (a prop) only addresses `/api/committees/{slug}`. Never build a node id from a slug.
- The API addresses a dossier as `29684-I`; its node key is `29684_i` (`dossierNumber` in `parliamentary/data.ts`).
- A `decisions` node has `GraphNodeKind` `activity`, like activities, cases and commitments. Code that must tell them apart checks `node.collection`, as `KindReader.svelte` does.
- Node `props` are `{ [key: string]: any }` in the schema. Check a real response before reading a prop.

## Backend data gaps

- `InstrumentArticleNodeDTO.breadcrumb` (the chapter/section path of an article, from `/api/instruments/{bwb_id}/articles`) is a real field in the contract but currently always `[]` — checked against BWBR0001903 (Sv), BWBR0001854 (Sr) and others on the 0.5 API at `:8001`. `LezenNav.svelte`'s `buildGroups()` already groups by it and falls back to a flat list when every article's breadcrumb is empty, so the grouping is dormant rather than broken: it activates the moment the field is populated, for any depth and any type names (boek/titel/afdeling/hoofdstuk/paragraaf), nothing to change on this side. The BWB toestand XML the ingest pipeline reads already carries this structure as nested `<boek>`/`<titeldeel>`/`<afdeling>`/`<hoofdstuk>`/`<paragraaf>` elements around each `<artikel>`; populating `breadcrumb` is a matter of walking that nesting during ingest, not new source data.

## Svelte 5

- `{@const}` must be the direct child of `{#if}`, `{#each}`, `{:else}`, `{#snippet}`, `<svelte:fragment>` or a component. Inside a plain element it does not compile.
- A variable named `state` or `props` makes the compiler read `$state` and `$props` as store subscriptions of that variable, and everything derived from it degrades to `any`. Name it `view`, `status` or `nodeProps`. The readers use `view` for their load state.

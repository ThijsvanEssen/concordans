# Overlays

Two visual layers paint signal on top of the graph: **Activiteit** (citation density over time) and **Mutatie** (open dossiers targeting a node). They are mutually exclusive — exactly one or neither is active at any moment.

End-user description lives at `/docs` section V (Dossiers & Parlement). This document covers the data flow, URL contract, scaling math, and rendering pipeline.

## URL contract

A single query param drives both overlays:

```
?overlay=heat:N         Activiteit, sliding N-month window (N ∈ {3, 6, 12, 24})
?overlay=open           Mutatie, all open dossiers
?overlay=dossier:X      Mutatie, scoped to dossier kamerstuknummer X
(absent)                no overlay
```

Parsing and serialisation live in [`src/lib/stores/overlay.ts`](../src/lib/stores/overlay.ts):

```ts
type Overlay =
  | { kind: 'none' }
  | { kind: 'heat'; months: number }
  | { kind: 'open' }
  | { kind: 'dossier'; id: string };

parseOverlay(param: string | null): Overlay
serializeOverlay(o: Overlay): string | null
```

The toggles in the sidebar are **radio behaviour**: activating one clears the other. Deep links from the empty state, ArticleReader, and DossierReader use these patterns:

| Source                                       | Deep link                                                    |
| -------------------------------------------- | ------------------------------------------------------------ |
| Empty-state example CTA (`GraphView.svelte`) | `?overlay=open`                                              |
| ArticleReader in-flux chip                   | `?focus=kamerstukdossiers/{nummer}&overlay=dossier:{nummer}` |
| DossierReader "Toon op grafiek"              | `?seed=dossier:X&overlay=dossier:X`                          |
| Reader in-flux chip                          | `?seed=dossier:X&overlay=dossier:X`                          |

## Data flow

```
URL ?overlay= ───► parseOverlay() ───► overlay: Overlay (derived in routes/explore/+page.svelte)
                                              │
                                              ▼
                                       $effect (overlay) ─► fetch on demand
                                              │
              ┌───────────────────┬───────────┴───────────┬───────────────────┐
              ▼                   ▼                       ▼                   ▼
        kind='heat'          kind='open'           kind='dossier'          kind='none'
              │                   │                       │                   │
   fetchHeatMap(months)   fetchInFluxMap()  fetchDossierInFluxMap(id)   (both maps cleared)
              │                   │                       │
              ▼                   ▼                       ▼
         heatMap: Map           inFluxMap: Map         inFluxMap: Map
              └────────┬──────────┴───────────┬───────────┘
                       ▼                      ▼
              GraphView passes both, plus active flags ──► GraphCanvas
                                              │
                                              ▼
                            updateViewportLabels() on afterRender
                                              │
                       ┌──────────────────────┴──────────────────────┐
                       ▼                                             ▼
                activityHalos[]                              mutatieBadges[]
                       │                                             │
                       └──────► HTML overlay layers on top of canvas ◄
```

The fetch happens **only when the overlay is active** — the prior unconditional `fetchInFluxMap()` call on every page mount was removed. When `overlay.kind` changes, the active overlay's data is fetched and the other map is cleared.

`fetchDossierInFluxMap` is a small reducer over `/api/dossiers/{X}/mutations`: it sums edges by `to_id` into the same `Map<nodeId, count>` shape that the bulk endpoint produces, so `GraphCanvas` doesn't need to know which scope is active.

## Activiteit (heat)

### What it shows

Citation density per node, over a sliding window. Bigger halo = more citations per month in the chosen period. A faint halo means "occasionally cited", a bold halo means "currently hot".

### Scaling math

The halo radius is computed in `GraphCanvas.updateViewportLabels()`:

```ts
const rate = activity / months; // citations per month
const t = Math.min(rate / HEAT_SATURATION_RATE, 1); // [0..1]; saturates at 5/mo
const baseR = attrs.size / sizeDivisor; // effective pixel radius
const ringPx = baseR + 4 + t * 16; // 4..20 px beyond the node edge
const opacity = 0.35 + 0.55 * t; // pale → solid
```

Two design decisions are worth keeping intact:

1. **Per-month rate, not absolute count.** Switching the window from 3 to 24 months on the same node yields a _different_ halo even if total citations rise proportionally — because we divide by `months`. The earlier version normalised against the bulk max, which made periods look identical. Don't revert.
2. **`HEAT_SATURATION_RATE = 5`.** A node cited five or more times per month saturates the halo. The number is empirical — tune it if the cohort of "hot" nodes is wrong, but be aware of the legend (`0/mnd → 5+/mnd`) in the sidebar which must move with it.

### Period selector

Buttons `3m / 6m / 12m / 24m` in the sidebar. Each writes `?overlay=heat:N` and the data effect refetches. The set lives at `HEAT_PERIODS` in `stores/overlay.ts`.

## Mutatie (in-flux)

### What it shows

A small spine-coloured badge at the top-right of nodes that are targets of at least one open wetsvoorstel. The badge body shows the dossier count if `> 1`, otherwise renders as a plain dot.

### Visual

- Single dossier: 14 px circular dot, spine red, white border.
- Multi dossier: pill with the count, darker spine (`--spine-2` token).

The styling lives in `GraphCanvas.svelte` (`.mutatie-badge`, `.mutatie-badge--multi`). The sidebar legend uses parallel `.sb-mutatie-dot` styles so the on-canvas marker and the legend swatch read as the same thing.

### Anchor math

The badge is corner-anchored, so it must line up with where edges actually terminate — otherwise it floats away from the rendered node edge:

```ts
const sizeDivisor = Math.min(Math.sqrt(cameraRatio), 1.5); // same as sigma's zoomToSizeRatioFunction
const baseR = attrs.size / sizeDivisor;
const offset = baseR * 0.707; // cos 45°
const vp = renderer.graphToViewport({ x, y });
const badgeCentre = { x: vp.x + offset, y: vp.y - offset };
```

`sizeDivisor` mirrors the `zoomToSizeRatioFunction` setting on the sigma renderer (configured at instantiation). Don't change one without the other — the badge will drift on zoom.

The same `sizeDivisor` is applied to halos, where it matters less because halos are centred, but consistency is worth keeping.

## Coexistence with rendering

Both halos and badges live in their own HTML overlay layers, drawn above the sigma canvas:

```html
<div class="canvas-wrap">
	<!-- sigma canvas (z 0) -->
	{#if activityHalos.length > 0}
	<div class="activity-overlay" />
	<!-- z 5 -->{/if} {#if mutatieBadges.length > 0}
	<div class="mutatie-overlay" />
	<!-- z 6 -->{/if}
</div>
```

They're recomputed every frame in `updateViewportLabels()`, which sigma fires via `afterRender`. The cost is bounded by `latestHeatMap.size` / `latestInFluxMap.size` and an iteration over `graph.forEachNode`, both O(visible nodes). Cluster-overlap resolution for cluster labels happens in the same function — combine the position passes if you ever need to add a third overlay.

## Known issues

### Backend in-flux mismatch

`/api/nodes/in-flux` (the bulk endpoint that drives the Mutatie overlay) sometimes disagrees with `/api/articles/{bwb}/{n}/in-flux` and `/api/articles/{bwb}/{n}/legislative-history`. For example, `bwbr0001854_140` (art. 140 Sv) is reported with `count=2` by the bulk endpoint, but per-article and legislative-history both report `0`, and no open dossier's `/mutations` subgraph contains it as a `to_id`.

The frontend renders what the bulk endpoint claims; the reader's in-flux chip list reads legislative-history, so for these inconsistent nodes the chip list is empty even though a badge appears. This is a **backend issue**; the frontend should not paper over it.

See [`gotchas.md`](gotchas.md#in-flux-mismatch) for the full investigation.

## Extending

If you add a third overlay variant:

1. Extend the `Overlay` union and `parseOverlay` / `serializeOverlay`.
2. Add a fetcher in `parliamentary-client.ts` that returns a `Map<nodeId, number>` (or your own shape — but match the existing pattern if possible).
3. Wire the fetch in the `$effect(() => { const o = overlay; ... })` block in `routes/explore/+page.svelte`.
4. Add the toggle block in `GraphSidebar.svelte` — copy the structure of the Activiteit or Mutatie block, including the radio behaviour in the click handler.
5. Add a new HTML overlay layer in `GraphCanvas.svelte`. Add its position pass inside `updateViewportLabels()`; don't introduce a separate frame loop.
6. Decide on stacking: are all three mutually exclusive, or does the new one stack? The current toggle handlers assume exclusion (`toggleHeat` clears mutatie and vice versa). If you stack, split the URL param into two separate keys instead of overloading `?overlay=`.

## Related files

| Concern                              | File                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------- |
| URL parser/serializer + Overlay type | `src/lib/stores/overlay.ts`                                                                       |
| Per-route fetch orchestration        | `src/routes/explore/+page.svelte` (effect on `overlay`)                                           |
| Sidebar UI for both toggles          | `src/lib/components/graph/GraphSidebar.svelte`                                                    |
| Halo + badge rendering               | `src/lib/components/graph/GraphCanvas.svelte`                                                     |
| Bulk fetchers                        | `src/lib/api/parliamentary-client.ts` (`fetchHeatMap`, `fetchInFluxMap`, `fetchDossierInFluxMap`) |
| End-user description                 | `src/routes/(main)/docs/+page.svelte` (section V — parl-card--overlay)                            |

# Overlays

Two overlays paint counts on the network: **Activiteit** (edges created recently, per source) and **Mutatie** (open proposed changes, per source). At most one is active.

## URL

`?overlay=` holds the overlay. Parsing and serialising are in `src/lib/stores/overlay.ts` (`parseOverlay`, `serializeOverlay`).

| Value              | Overlay                                                             |
| ------------------ | ------------------------------------------------------------------- |
| `heat:{months}`    | Activiteit over a window of `months` (`HEAT_PERIODS`: 3, 6, 12, 24) |
| `open`             | Mutatie for all open dossiers                                       |
| `dossier:{number}` | Mutatie for one dossier                                             |
| absent             | none                                                                |

The Mutatie toggle in the sidebar sets `open`, or clears an active Mutatie overlay including `dossier:{number}`. `dossier:{number}` is entered by link only (the dossier reader's "Toon in netwerk").

## Data

`explore/+page.svelte` derives the overlay from the URL and fetches only the active overlay's data when the parameter changes. A request of an overlay that is left is aborted.

| Overlay          | Function in `src/lib/api/overlays.ts` | API                                |
| ---------------- | ------------------------------------- | ---------------------------------- |
| Activiteit       | `getHeat(months)`                     | `/api/nodes/heat` (`min_count` 2)  |
| Mutatie, `open`  | `getInFlux()`                         | `/api/nodes/in-flux`               |
| Mutatie, dossier | `getDossierInFlux(number)`            | `/api/dossiers/{number}/mutations` |

All three return `NodeCounts`, a map from node id to count; `getDossierInFlux` counts the `to_id` of the edges. `GraphView` passes the maps and the active flags to `GraphCanvas`. The endpoints are described in the API's [`api.md`](../../lawgraph/docs/api.md).

## Rendering

`GraphCanvas` draws both overlays as HTML layers over the Sigma canvas (`.activity-overlay`, `.mutatie-overlay`). `updateViewportLabels()` recomputes their positions on every Sigma `afterRender` with `renderer.graphToViewport()`, for the visible nodes that appear in the map.

**Halo (Activiteit).** The radius grows with the rate `count / months`. `HEAT_SATURATION_RATE` (5 per month) is the rate at which it stops growing. The rate is per month, so that a different window changes the halo for the same source.

**Badge (Mutatie).** A dot at the top right of the source, with the count when it is above 1. It sits at the edge of the drawn node, offset by `badgeAxisOffset(kind)` (`nodeSprites.ts`), which depends on the shape of the kind.

Both need the drawn radius of a node, which is not the `size` attribute. See [`gotchas.md`](gotchas.md#node-size-on-screen).

## Adding an overlay

1. Extend `Overlay`, `parseOverlay` and `serializeOverlay`.
2. Add a fetcher to `src/lib/api/overlays.ts` that returns `NodeCounts`.
3. Add it to the effect on `overlay` in `explore/+page.svelte`.
4. Add the toggle to `GraphSidebar.svelte`. The current handlers assume exclusion; overlays that stack need their own URL parameter.
5. Add a layer and a position pass to `GraphCanvas.svelte`, inside `updateViewportLabels()`.

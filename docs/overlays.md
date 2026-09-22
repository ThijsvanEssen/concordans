# Overlays

Two overlays paint counts on the network: **In behandeling** (open proposed changes, per bron) and **Citaties per maand** (edges created recently, per bron). At most one is active; the sidebar offers them as a three-way switch with "none".

## URL

`?overlay=` holds the overlay. Parsing and serialising are in `src/lib/stores/overlay.ts` (`parseOverlay`, `serializeOverlay`, type `Overlay` with kinds `none`, `open`, `dossier`, `heat`).

| Value              | Overlay                                                                                               |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `open`             | In behandeling for all open dossiers                                                                  |
| `dossier:{number}` | In behandeling for one dossier                                                                        |
| `heat:{months}`    | Citaties per maand over a window of `months` (`HEAT_PERIODS`: 3, 6, 12, 24; `DEFAULT_HEAT_MONTHS` 12) |
| absent             | none                                                                                                  |

The switch sets `open` or `heat:12`, or clears the active overlay; clearing covers `dossier:{number}` too. `dossier:{number}` is entered by URL only: no page builds such a link. `bronHref` carries `overlay` along, so the overlay stays while moving between bronnen.

## Data

`explore/+page.svelte` derives the overlay from the URL and fetches only the active overlay's data when the parameter changes. A request of an overlay that is left is aborted.

| Overlay                     | Function in `src/lib/api/overlays.ts` | API                                |
| --------------------------- | ------------------------------------- | ---------------------------------- |
| Citaties per maand          | `getHeat(months)`                     | `/api/nodes/heat` (`min_count` 2)  |
| In behandeling, `open`      | `getInFlux()`                         | `/api/nodes/in-flux`               |
| In behandeling, one dossier | `getDossierInFlux(number)`            | `/api/dossiers/{number}/mutations` |

All three return `NodeCounts`, a map from node id to count; `getDossierInFlux` counts the `to_id` of the edges. `GraphView` passes the maps and the active flags to `GraphCanvas`; the sidebar shows the number of bronnen in behandeling while that overlay is active.

## Rendering

`GraphCanvas` draws both overlays as HTML layers over the Sigma canvas (`.activity-overlay` for the halos, `.mutatie-overlay` for the badges). `updateViewportLabels()` recomputes their positions on every Sigma `afterRender` with `renderer.graphToViewport()`, for the visible nodes that appear in the map.

**Halo (Citaties per maand).** The radius grows with the rate `count / months`. `HEAT_SATURATION_RATE` (5 per month) is the rate at which it stops growing. The rate is per month, so that a different window changes the halo for the same bron.

**Badge (In behandeling).** A dot at the top right of the bron, with the count when it is above 1. It sits at the edge of the drawn node, offset by `badgeAxisOffset(kind)` (`nodeSprites.ts`), which depends on the shape of the kind.

Both need the drawn radius of a node, which is not the `size` attribute. See [`gotchas.md`](gotchas.md#node-size-on-screen).

## Adding an overlay

1. Extend `Overlay`, `parseOverlay` and `serializeOverlay`.
2. Add a fetcher to `src/lib/api/overlays.ts` that returns `NodeCounts`.
3. Add it to the effect on `overlay` in `explore/+page.svelte`.
4. Add a position to the switch in `GraphSidebar.svelte`. The switch assumes exclusion; overlays that stack need their own URL parameter.
5. Add a layer and a position pass to `GraphCanvas.svelte`, inside `updateViewportLabels()`.

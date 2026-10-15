# Overlays

Two overlays paint counts on the network: **Open dossiers** (open proposed changes, per bron) and **Verwijzingen per maand** (edges created recently, per bron). At most one is active; the legend of the network offers them under Meer: Geen, Open dossiers, Verwijzingen per maand (with a period of 3 to 24 months).

## URL

`?overlay=` holds the overlay. Parsing and writing are in `src/lib/netwerk/overlay.ts` (`parseOverlay`, `overlayParam`, type `Overlay` with kinds `none`, `open`, `heat`).

| Value           | Overlay                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `open`          | Open dossiers for all open dossiers                                                                       |
| `heat:{months}` | Verwijzingen per maand over a window of `months` (`HEAT_PERIODS`: 3, 6, 12, 24; `DEFAULT_HEAT_MONTHS` 12) |
| absent          | none                                                                                                      |

The switch sets `open` or `heat:12`, or clears the active overlay. `bronHref` carries `overlay` along, so the overlay stays while moving between bronnen.

## Data

`explore/+page.svelte` derives the overlay from the URL; `explore/overlay-counts.svelte.ts` fetches only the active overlay's data when the parameter changes. A request of an overlay that is left is aborted.

| Overlay                | Function in `src/lib/api/overlays.ts` | API                               |
| ---------------------- | ------------------------------------- | --------------------------------- |
| Verwijzingen per maand | `getHeat(months)`                     | `/api/nodes/heat` (`min_count` 2) |
| Open dossiers          | `getInFlux()`                         | `/api/nodes/in-flux`              |

Both return `NodeCounts`, a map from node id to count. `GraphView` passes the maps and the active flags to `GraphCanvas`; the sidebar shows the number of bronnen in behandeling while that overlay is active.

## Rendering

`GraphCanvas` draws both overlays as HTML layers over the Sigma canvas (`.activity-overlay` for the halos, `.mutatie-overlay` for the badges). `updateViewportLabels()` recomputes their positions on every Sigma `afterRender` with `renderer.graphToViewport()`, for the visible nodes that appear in the map.

**Halo (Verwijzingen per maand).** The radius grows with the rate `count / months`. `HEAT_SATURATION_RATE` (5 per month) is the rate at which it stops growing. The rate is per month, so that a different window changes the halo for the same bron.

**Badge (Open dossiers).** A dot at the top right of the bron, with the count when it is above 1. It sits on the edge of the drawn vorm, offset by `badgeAxisOffset(vorm)` (`nodeSprites.ts`): where a ray at 45° leaves the vorm's path. The mark of a note stands at the same edge, top left.

Both need the drawn radius of a node, which is not the `size` attribute. See [`gotchas.md`](gotchas.md#node-size-on-screen).

## Adding an overlay

1. Extend `Overlay`, `parseOverlay` and `overlayParam`.
2. Add a fetcher to `src/lib/api/overlays.ts` that returns `NodeCounts`.
3. Add it to `OverlayCounts` in `explore/overlay-counts.svelte.ts`.
4. Add a position to the switch in `GraphSidebar.svelte`. The switch assumes exclusion; overlays that stack need their own URL parameter.
5. Add a layer and a position pass to `GraphCanvas.svelte`, inside `updateViewportLabels()`.

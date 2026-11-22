# Overlays

Two overlays paint counts on the network: **Openstaande dossiers** (open proposed changes, per bron) and **Verwijzingen per maand** (edges created recently, per bron). At most one is active; the legend of the network offers them under Meer: Geen, Openstaande dossiers, Verwijzingen per maand (with a period of 3 to 24 months).

## URL

`?overlay=` holds the overlay. Parsing and writing are in `src/lib/selection/overlay.ts` (`parseOverlay`, `overlayParam`, type `Overlay` with kinds `none`, `open`, `heat`).

| Value           | Overlay                                                                                                   |
| --------------- | --------------------------------------------------------------------------------------------------------- |
| `open`          | Openstaande dossiers for all open dossiers                                                                |
| `heat:{months}` | Verwijzingen per maand over a window of `months` (`HEAT_PERIODS`: 3, 6, 12, 24; `DEFAULT_HEAT_MONTHS` 12) |
| absent          | none                                                                                                      |

The switch sets `open` or `heat:12`, or clears the active overlay. `bronHref` carries `overlay` along, so the overlay stays while moving between bronnen.

## Data

`explore/+page.svelte` derives the overlay from the URL; `explore/overlay-counts.svelte.ts` fetches only the active overlay's data when the parameter changes. A request of an overlay that is left is aborted.

| Overlay                | Function in `src/lib/api/overlays.ts` | API                               |
| ---------------------- | ------------------------------------- | --------------------------------- |
| Verwijzingen per maand | `getHeat(months)`                     | `/api/nodes/heat` (`min_count` 2) |
| Openstaande dossiers   | `getInFlux()`                         | `/api/nodes/in-flux`              |

Both return `NodeCounts`, a map from node id to count. `GraphView` passes the maps and the active flags on; the sidebar shows the number of bronnen in behandeling while that overlay is active.

## Adding an overlay

1. Extend `Overlay`, `parseOverlay` and `overlayParam`.
2. Add a fetcher to `src/lib/api/overlays.ts` that returns `NodeCounts`.
3. Add it to `OverlayCounts` in `explore/overlay-counts.svelte.ts`.
4. Add a position to the switch in `GraphSidebar.svelte`. The switch assumes exclusion; overlays that stack need their own URL parameter.

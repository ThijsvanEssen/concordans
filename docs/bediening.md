# Controls

How a control looks and where it stands, on every page and in every panel (Thijs, 10 October 2026: "alle dingen versimpelen is akkoord", concept `ux-voorstel/9-bediening`). The text speaks, the controls stay quiet: each has one form and one place, so a reader neither searches for it nor reads past it.

## Five forms

| Form      | For                                                       | Component                                              | Looks                                                                                                         |
| --------- | --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Knop      | doing something: Citeer, Vergelijken, CSV, Deel, Volg     | a `button` with a frame                                | Schibsted, `--t-ui`, 500; `--veld-h` (32) on a page, `--veld-h-klein` (24) in a panel                         |
| Keuze     | one of 2 to 5 visible options: Periode, Netwerk/Tekst     | `ui/Keuze.svelte`                                      | joined boxes, the chosen one filled in ink                                                                    |
| Tekstmenu | one of many, or a setting: Alle bronnen, Nieuwste eerst   | `ui/TekstMenu.svelte`                                  | the word of its value with a caret, no frame; the chosen option in weight                                     |
| Vinkje    | switching a thing on or off in a list: facets, in netwerk | `ui/FilterOptie.svelte` (`inline` beside other things) | the box (`ui/Vinkje.svelte`: 12 px, `--r-1`, a drawn tick), the label, a count at the right; chosen in weight |
| Tekstlink | going somewhere: Alle 244 uitspraken, Wis alle filters    | `ui/TekstLink.svelte`, `ui/AlleN.svelte`               | the serif in ink, underlined; red only on hover and focus                                                     |

And one icon button, `ui/IconKnop.svelte`, 24 px, for +, ×, zoom and ⋯; it names what it does.

No chips: a choice shows in its control (in weight in the facet, as the value of the text menu). No native `select`: it is a text menu. The chips of the panel Netwerk are content (the chosen bronnen), not a filter.

## Four layers

Every page and panel, from top to bottom:

1. **Heading**: the title at the left, its actions at the right, at most three buttons (more in ⋯).
2. **Choose-line**: what is shown, in `ui/Bepaalregel.svelte`: Zoeken, Periode and Kamer where the list has them, each labelled above its left edge, all 32 px on one line (Thijs, 10 Oct 2026: "Dan hebben we overal netjes een zelfde soort zoekbalk"); on a phone under each other. Nothing else.
3. **Refine**: on a page the facets at the left with their counts; in a narrow panel behind one text menu or Filter; on a phone behind Verfijnen (N), opened in place.
4. **List**: a group's heading is its fold; at most one switch at its right (in netwerk); at most one line of controls under it (order, refine); one text link at the foot, Alle N.

A row has no buttons of its own: a click on the row does it; the + shows on hover (always on a phone).

This holds for Bladeren too (Thijs, 10 October 2026, choice (a)): a row's title opens the bron in Netwerk, Lezen is one step from there. It replaces the earlier wish of the same day for buttons at the end of the row (Lezen, Netwerk, Openen). Those buttons do not come back.

## Measure, letter, colour, words

- Height: 32 on a page, 24 in a panel or group; one line of controls has one height. On the 4 px grid; `--s-2` between controls, `--s-4` between groups.
- Letter: a control in Schibsted at `--t-ui` or `--t-ui-micro`, 500. A text link and a facet's label are text, in the serif.
- Colour: ink for everything; chosen is filled (Keuze) or in weight. Red (`--accent`) only on hover and focus, and for the outcome "nee".
- Words: a text menu shows its value ("Alle bronnen"), not a label with a colon; a button is a verb or a destination; counts stand in the control ("Alle 244 uitspraken"), not in a sentence; no explanatory sentences between controls.

## Size in a timeline

Two things at one level do not differ in size. In a timeline (Actueel, Onderwerpen, the home page, a dossier's procedure) the large line is kept for the bill, its own decisions, and a close vote, where the size carries meaning (decided by a narrow margin). A toezegging, a motie or a brief stands at the size of the lines beside it (`major` in `src/lib/components/actueel/timeline.ts`).

## Layout

Two kinds of page, no third (Thijs, 10 Oct 2026: "Houd de bladeren pagina's aan voor breedte van hele breedte dingen").

- **Full width**: lists, overviews, timelines and text: the home page, Bladeren and each of its categories, Actueel, Onderwerpen and its Overzicht, the API reference, /docs, /over, /bronnen, /voorwaarden, /privacy.
  - Every one sits in the frame of Bladeren: `.blad` (at most 1440 px, gutter `--s-6`; on a phone `--s-4`), with `.blad__indeling` for a facet column of 240 px, a gap of 40 px and the rest.
  - The facet column is `.blad__facetten`: sticky, a quiet scroll bar clear of the counts, one right edge for controls and counts.
  - A text page keeps a reading width of 720 px inside the frame, on the same left edge (`.blad--tekst`).
  - The classes live in AppShell; no page sets a width of its own. The footer stands on the same edge.
- **Panels**: the Verkenner and its readers beside Netwerk and Verbonden, each column its own measure (`--reader-*`). Unchanged.

## Kamer

Kamer is one choice, never a set of boxes (Thijs, 10 Oct 2026: "Dit is raar ten opzichte van de rest van de TK/EK selectors"): a Keuze in the choose-line under its label Kamer (Bepaalregel), on a phone under the period. Where both may stand, Beide | Tweede Kamer | Eerste Kamer, Beide filtering nothing (Actueel, the Overzicht); where one must, Tweede Kamer | Eerste Kamer (the halls, Bladeren's Kamerleden and Fracties).

## Cards over the network

Netwerk and the Legenda stand in one column on the canvas, Netwerk on top and the Legenda under it, as wide as each other (Thijs, 10 Oct 2026: "legenda en netwerk onder elkaar"). Both may stand open while the canvas has the height. When the one opened last leaves no room for the other, the other folds, and opens again by itself once there is room, unless someone closed it (`src/lib/stores/zwevend.ts`). Each remembers open or closed per browser.

## Gemarkeerd

What a reader keeps while reading goes into a map (`src/lib/map`; concept ux-voorstel/13-map, variant 7, steps 1 and 2). Gemarkeerd is a page, as every item of the menu (Thijs, 10 Oct: one behaviour for every menu item); there is no panel.

- **Keeping:** a box (Vinkje, `map/Bewaar.svelte`) beside each lid and each overweging, beside their Citeer. In the head of a reader, Bewaar follows the place chosen (`Bewaar lid 3`), with `in <map>` beside it: a menu of the maps and Nieuwe map. A map chosen there becomes the active map and holds the item; Nieuwe map starts a map with the item, named Map 2, Map 3, and renamed on the page. The count beside Gemarkeerd in the menu follows each box at once. In each row of Verbonden, beside the +; it replaced Verzamel.
- **The page:** `/gemarkeerd`, the menu item with the active map's count, underlined there as the others. In the frame of a page of text (`.blad--tekst`): the heading is the active map's name, a menu to switch maps, Nieuwe map, Hernoem and Verwijder map, with Kopieer link, Citaten and CSV at its right. Under it the number of bronnen and the order (Per wet of dossier, or Eigen volgorde); the items, each a link to its place, with Aantekening, ↑ ↓ and × on hover; and Wis de map.
- **Notes:** Aantekening beside an item opens a field in place; Enter keeps it, Escape leaves it. The note stands in italics under the item and goes into the link, the citations and the CSV.
- **Order:** per law, dossier or judgment, or the reader's own. ↑ and ↓ move an item within its group, or among all items in the own order.
- **Alle mappen:** a section under the active map (`map/AlleMappen.svelte`), a table of the maps by name, number of bronnen and last change, the active one in weight, with Verwijder per map. A name makes its map active, shown above.
- **Sharing:** a link (`?map=`, with `mapnaam=` and, in the own order, `mapvolgorde=eigen`) opens `/gemarkeerd` with the shared map framed above the own one, under its name: Bewaar als map, Voeg toe aan the active map, or Niet bewaren; after the choice the link leaves the address. A link of before (`/explore?map=`) goes there too (AppShell). Fields per item `id~at~kort~groep~notitie`, items separated by `;`; only `%`, `~` and `;` are escaped.
- **Storage:** the maps live in this browser (`concordans:mappen`), without an account. The one map of step 1 (`concordans:map`) became the first map.

## Marks on a timeline

A line of a timeline (Actueel on the home page, Onderwerpen, a dossier's procedure) carries the mark of its kind from `src/lib/bron/vormen.ts`, the table KindGlyph and the network draw from (Thijs, 10 Oct 2026: "Dit hebben we toch al door de rest van de site?"). A vote is the triangle of a decision, a paper the sheet, a bill the sheet with its window, a toezegging the flag, a law in force the square of a law. A bundle has the mark of its kind (Stemmingen the triangle). The outcome is in the fill: aangenomen or afgedaan filled in moss, verworpen open in the accent, open or still to come dashed. The Tijdlijn has no circle or square of its own.

## Rules

`src/lib/consistency.test.ts`, "controls in five forms": no native `select` outside TekstMenu, no chips outside the panel Netwerk, no "meer" of its own beside AlleN, no control height but `--veld-h` or `--veld-h-klein`. A place that keeps an older form is a named entry with its reason and the step that rebuilds it; the entry comes out with that step.

# Controls

How a control looks and where it stands, on every page and in every panel (Thijs, 10 October 2026: "alle dingen versimpelen is akkoord", concept `ux-voorstel/9-bediening`). The text speaks, the controls stay quiet: each has one form and one place, so a reader neither searches for it nor reads past it.

## Five forms

| Form      | For                                                       | Component                                              | Looks                                                                                 |
| --------- | --------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Knop      | doing something: Citeer, Vergelijken, CSV, Deel, Volg     | a `button` with a frame                                | Schibsted, `--t-ui`, 500; `--veld-h` (32) on a page, `--veld-h-klein` (24) in a panel |
| Keuze     | one of 2 to 5 visible options: Periode, Netwerk/Tekst     | `ui/Keuze.svelte`                                      | joined boxes, the chosen one filled in ink                                            |
| Tekstmenu | one of many, or a setting: Alle bronnen, Nieuwste eerst   | `ui/TekstMenu.svelte`                                  | the word of its value with a caret, no frame; the chosen option in weight             |
| Vinkje    | switching a thing on or off in a list: facets, in netwerk | `ui/FilterOptie.svelte` (`inline` beside other things) | the box, the label, a count at the right; chosen in weight                            |
| Tekstlink | going somewhere: Alle 244 uitspraken, Wis alle filters    | `ui/TekstLink.svelte`, `ui/AlleN.svelte`               | the serif in ink, underlined; red only on hover and focus                             |

And one icon button, `ui/IconKnop.svelte`, 24 px, for +, ×, zoom and ⋯; it names what it does.

No chips: a choice shows in its control (in weight in the facet, as the value of the text menu). No native `select`: it is a text menu. The chips of the panel Netwerk are content (the chosen bronnen), not a filter.

## Four layers

Every page and panel, from top to bottom:

1. **Heading**: the title at the left, its actions at the right, at most three buttons (more in ⋯).
2. **Choose-line**: what is shown: the field and Periode, on one line. Nothing else.
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

Kamer is one choice, never a set of boxes (Thijs, 10 Oct 2026: "Dit is raar ten opzichte van de rest van de TK/EK selectors"): a Keuze in the facet column under its heading Kamer, on a phone under Verfijnen. Where both may stand, Beide | Tweede Kamer | Eerste Kamer, Beide filtering nothing (Actueel, the Overzicht); where one must, Tweede Kamer | Eerste Kamer (the halls, Bladeren's Kamerleden and Fracties).

## Marks on a timeline

A line of a timeline (Actueel on the home page, Onderwerpen, a dossier's procedure) carries the mark of its kind from `src/lib/bron/vormen.ts`, the table KindGlyph and the network draw from (Thijs, 10 Oct 2026: "Dit hebben we toch al door de rest van de site?"). A vote is the triangle of a decision, a paper the sheet, a bill the sheet with its window, a toezegging the flag, a law in force the square of a law. A bundle has the mark of its kind (Stemmingen the triangle). The outcome is in the fill: aangenomen or afgedaan filled in moss, verworpen open in the accent, open or still to come dashed. The Tijdlijn has no circle or square of its own.

## Rules

`src/lib/consistency.test.ts`, "controls in five forms": no native `select` outside TekstMenu, no chips outside the panel Netwerk, no "meer" of its own beside AlleN, no control height but `--veld-h` or `--veld-h-klein`. A place that keeps an older form is a named entry with its reason and the step that rebuilds it; the entry comes out with that step.

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

## Measure, letter, colour, words

- Height: 32 on a page, 24 in a panel or group; one line of controls has one height. On the 4 px grid; `--s-2` between controls, `--s-4` between groups.
- Letter: a control in Schibsted at `--t-ui` or `--t-ui-micro`, 500. A text link and a facet's label are text, in the serif.
- Colour: ink for everything; chosen is filled (Keuze) or in weight. Red (`--accent`) only on hover and focus, and for the outcome "nee".
- Words: a text menu shows its value ("Alle bronnen"), not a label with a colon; a button is a verb or a destination; counts stand in the control ("Alle 244 uitspraken"), not in a sentence; no explanatory sentences between controls.

## Size in a timeline

Two things at one level do not differ in size. In a timeline (Actueel, Onderwerpen, the home page, a dossier's procedure) the large line is kept for the bill, its own decisions, and a close vote, where the size carries meaning (decided by a narrow margin). A toezegging, a motie or a brief stands at the size of the lines beside it (`major` in `src/lib/components/actueel/timeline.ts`).

## Rules

`src/lib/consistency.test.ts`, "controls in five forms": no native `select` outside TekstMenu, no chips outside the panel Netwerk, no "meer" of its own beside AlleN, no control height but `--veld-h` or `--veld-h-klein`. A place that keeps an older form is a named entry with its reason and the step that rebuilds it; the entry comes out with that step.

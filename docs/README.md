# Concordans: developer documentation

For users the app has `/docs`, `/docs/methode` and `/docs/sneltoetsen`. The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`); these files do not repeat it.

| File                                         | Covers                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| [`architecture.md`](architecture.md)         | Stack, layout, the views of the Verkenner, data flow                           |
| [`routes.md`](routes.md)                     | Pages, readable addresses, the query of the Verkenner, links to a bron         |
| [`api-contract.md`](api-contract.md)         | The schema snapshot and how it is kept current                                 |
| [`api-client.md`](api-client.md)             | Calling the API, caching, errors                                               |
| [`state-and-stores.md`](state-and-stores.md) | Where state lives                                                              |
| [`graph-system.md`](graph-system.md)         | GraphStore, the composed netwerk, hulls and clusters, rendering                |
| [`overlays.md`](overlays.md)                 | The overlays Open dossiers and Verwijzingen per maand                          |
| [`readers.md`](readers.md)                   | Readers per kind of bron, text anchors, the panel Verbonden                    |
| [`search.md`](search.md)                     | The search component and citation resolving                                    |
| [`gotchas.md`](gotchas.md)                   | Things that look wrong and are not                                             |
| [`hierarchie.md`](hierarchie.md)             | Where every bron stands: axes, layers in the source's terms, relations, routes |
| [`typografie.md`](typografie.md)             | The text hierarchy: page title down to a count, in tokens; how a stem looks    |
| [`bediening.md`](bediening.md)               | The five forms of a control, the four layers of a page, the rules              |

Conventions:

- The URL holds the state a link should keep.
- Components call the API through `$lib/api` and never call `fetch`.
- Every page loads as lazily as it can:
  - The first paint waits only for the cheapest call that gives the head and the main text: a person's reader on `/api/members/{id}`, a judgment on its text, not on the node.
  - Everything else follows in parallel, each part with its own "laden…": Verbonden, the network, counts, lists, votes, facets. Where it can, a part loads when it comes into view or is opened.
  - A slow or failed part never holds up or empties the rest; it says so in its own place.
  - A call the API may take long for (search lanes, the feed, a full node, a person's votes) waits as long as the API does (`slowApi`, 30 s), not the 10 s of `api`.
  - A new or changed page is checked for what is on its critical path: which calls the first paint waits for, and whether each must.
- A click on a bron in the network marks it; it does not open it:
  - One click (a tap on a phone) lights the bron and its own lines, with its card beside it: Tekst lezen, Omgeving tonen, In netwerk. The network keeps its size.
  - The reader opens with Tekst lezen, a second click on the bron (a double click too) or Enter.
  - A click on the empty network or Escape removes the mark. Omgeving tonen shows the bron's own neighbourhood in place of the netwerk.
- On a phone, whatever puts a bron in the network or opens it there goes to the Netwerk tab: In netwerk, toon in netwerk, Alleen de omgeving (O, or its line in the panel Netwerk), a row of Verbonden, and a link to the network from Bladeren or Actueel (`bronHref(…, { mode: 'graph' })` carries `paneel=netwerk`, read once). What it did stands at the foot of the network, with Ongedaan maken (`meldNetwerk`).
- A bron's place (what it belongs to, what stands beside it, what falls under it) follows [`hierarchie.md`](hierarchie.md), in the source's terms; the band "Behoort bij" and the groupings of the network read it from there.
- Every list with dates has the same period filter: `Periode.svelte` in `src/lib/components/ui`, first in every filter pane: Alles, Maand, Kwartaal, Jaar (back from today) or Eigen as one segmented row over the full width of the column (Keuze `vol`), and van and tot as day fields only under Eigen, aligned with the row (one line where both fit, else under each other). The search has the same component. The bounds are days (YYYY-MM-DD) in the URL and to the API. Verbonden and the network have it in the filter sheet. Actueel and Bladeren follow [`bediening.md`](bediening.md); Bladeren takes the `range` group out of its facets into its choose-line. Actueel has the page's field and Periode on one line above the list, the facets with their counts on the left (Kamer, Soort, Fractie, Ministerie, then the rest), a chosen option in bold where it is chosen and no chips; on a phone the facets behind Verfijnen (N); the actions (Atom-feed, Volg als onderwerp) beside the heading. The other filter panes follow the same pattern. A list whose route has no period yet waits for the back end; a list whose dates are its own rows (the kabinetten) filters them itself. Onderwerpen excepted: a signal page with its own window (30 days, or since the visit before); the lists it leads to have the period (the Overzicht, Actueel).
- The interface explains itself. No paragraph of explanation above or under a panel, a list or a form: what a user needs to know follows from the controls, their labels, a placeholder with an example ("AI; kunstmatige intelligentie"), a marker on a row ("nieuw"), the period in the filter. A title (tooltip) only where a control is unclear without it. A status line that says how far the data or a search reaches ("tot en met 8 okt.", "Doorzocht vanaf …") is data, not explanation. The documentation (`/docs`, `/privacy`) keeps its explanation: that browser storage stays in the browser is said there, not beside the control.
- The plenaire zaal is drawn as the Kamers draw it themselves. The Tweede Kamer as on its "Zetelverdeling plenaire zaal" (https://www.tweedekamer.nl/kamerleden-en-commissies/wie-zit-waar): seen from the public tribune, the front at the top (1 Voorzitter, 2 Griffier, 3 Kabinet (vak-K), 4 Verslag en Redactie, 5 Spreekgestoelte, 6 Interruptiemicrofoons, 7 Bodedienst, the Kamer's own numbers), the rows in six blocks below it, the fracties from the Voorzitter's left (`order`) starting on the right of the picture (`Hemicycle.svelte`). The Eerste Kamer as on https://www.eerstekamer.nl/wie_zit_waar: two blocks facing each other, the regering at the top, the Voorzitter at the bottom (`ZaalTegenover.svelte`). A mark per fractie (coalitie and oppositie, voor and tegen) is a seat in the fractie's colour against an open one, never colour alone. The majority (76 of 150, 38 of 75) is a line in the course of a cabinet's seats, at its true height on the Kamer's whole scale (`KamerZetels.svelte`).
- Comments say why, not what.
- The interface is Dutch; code and these files are English. The interface calls a node a bron and an edge a verbinding.
- Styles take their sizes from the tokens in `src/lib/styles/tokens.css` (`--t-*` for type, `--s-1` to `--s-8` for space). `src/lib/style-scale.test.ts` fails on a font size in pixels and on more spacing off the 4px scale than `OFF_SCALE_MAX`; a rule that is changed moves to the tokens, and `OFF_SCALE_MAX` goes down to the new count.
- A rule that holds across the code (one form, one place, one name) is a guard in `src/lib/guards/`, one file per theme; a new guard is a new file. Guards read the sources through `src/lib/test/bronnen.ts`: `bron(path)` fails on a missing file, `overtreders` and `regelOvertreders` give the files or lines that break a rule, and an exception is an `Uitzondering` with its reason that fails the guard once it excepts nothing.

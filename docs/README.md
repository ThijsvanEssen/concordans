# Concordans: developer documentation

For users the app has `/docs`, `/docs/methode` and `/docs/sneltoetsen`. The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`); these files do not repeat it.

| File                                         | Covers                                                                         |
| -------------------------------------------- | ------------------------------------------------------------------------------ |
| [`architecture.md`](architecture.md)         | Stack, layout, the views of the Verkenner, data flow                           |
| [`routes.md`](routes.md)                     | Pages, readable addresses, the query of the Verkenner, links to a bron         |
| [`api-contract.md`](api-contract.md)         | The schema snapshot and how it is kept current                                 |
| [`api-client.md`](api-client.md)             | Calling the API, caching, the stopgaps still open                              |
| [`state-and-stores.md`](state-and-stores.md) | Where state lives                                                              |
| [`graph-system.md`](graph-system.md)         | GraphStore, the composed netwerk, hulls and clusters, rendering                |
| [`overlays.md`](overlays.md)                 | The overlays Open dossiers and Verwijzingen per maand                          |
| [`readers.md`](readers.md)                   | Readers per kind of bron, text anchors, the panel Verbonden                    |
| [`search.md`](search.md)                     | The search component and citation resolving                                    |
| [`gotchas.md`](gotchas.md)                   | Things that look wrong and are not                                             |
| [`hierarchie.md`](hierarchie.md)             | Where every bron stands: axes, layers in the source's terms, relations, routes |
| [`typografie.md`](typografie.md)             | The text hierarchy: page title down to a count, in tokens; how a stem looks    |

Conventions:

- The URL holds the state a link should keep.
- Components call the API through `$lib/api` and never call `fetch`.
- Every page loads as lazily as it can (Thijs, 9 October 2026):
  - The first paint waits only for the cheapest call that gives the head and the main text: a person's reader on `/api/members/{id}`, a judgment on its text, not on the node.
  - Everything else follows in parallel, each part with its own "laden…": Verbonden, the network, counts, lists, votes, facets. Where it can, a part loads when it comes into view or is opened.
  - A slow or failed part never holds up or empties the rest; it says so in its own place.
  - A call the API may take long for (search lanes, a full node, a person's votes) waits as long as the API does (`zoekApi`, 30 s), not the 10 s of `api`.
  - A new or changed page is checked for what is on its critical path: which calls the first paint waits for, and whether each must.
- A click on a bron in the network marks it; it does not open it (Thijs, 9 October 2026; this replaces "a click chooses, the reader follows" of 24 September):
  - One click (a tap on a phone) lights the bron and its own lines, with its card beside it: Tekst lezen, Omgeving tonen, In netwerk. The network keeps its size.
  - The reader opens with Tekst lezen, a second click on the bron (a double click too) or Enter.
  - A click on the empty network or Escape removes the mark. Omgeving tonen does what a double click did before: the bron's own neighbourhood in place of the netwerk.
- On a phone, whatever puts a bron in the network or opens it there goes to the Netwerk tab (Thijs, 9 October 2026): In netwerk, toon in netwerk, Alleen de omgeving, and a link to the network from Bladeren or Actueel (`bronHref(…, { mode: 'graph' })` carries `paneel=netwerk`, read once). What it did stands at the foot of the network, with Ongedaan maken (`meldNetwerk`).
- A bron's place (what it belongs to, what stands beside it, what falls under it) follows [`hierarchie.md`](hierarchie.md), in the source's terms; the band "Behoort bij" and the groupings of the network read it from there.
- Comments say why, not what.
- The interface is Dutch; code and these files are English. The interface calls a node a bron and an edge a verbinding.
- Styles take their sizes from the tokens in `AppShell.svelte` (`--t-*` for type, `--s-1` to `--s-8` for space). `src/lib/style-scale.test.ts` fails on a font size in pixels and on more spacing off the 4px scale than `OFF_SCALE_MAX`; a rule that is changed moves to the tokens, and `OFF_SCALE_MAX` goes down to the new count.

# Concordans: developer documentation

For users the app has `/docs`, `/docs/methode` and `/docs/sneltoetsen`. The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`); these files do not repeat it.

| File                                         | Covers                                                                 |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| [`architecture.md`](architecture.md)         | Stack, layout, the views of the Verkenner, data flow                   |
| [`routes.md`](routes.md)                     | Pages, readable addresses, the query of the Verkenner, links to a bron |
| [`api-contract.md`](api-contract.md)         | The schema snapshot and how it is kept current                         |
| [`api-client.md`](api-client.md)             | Calling the API, caching, the stopgaps still open                      |
| [`state-and-stores.md`](state-and-stores.md) | Where state lives                                                      |
| [`graph-system.md`](graph-system.md)         | GraphStore, the composed netwerk, hulls and clusters, rendering        |
| [`overlays.md`](overlays.md)                 | The overlays Open dossiers and Verwijzingen per maand                      |
| [`readers.md`](readers.md)                   | Readers per kind of bron, text anchors, the panel Verbonden            |
| [`search.md`](search.md)                     | The search component and citation resolving                            |
| [`gotchas.md`](gotchas.md)                   | Things that look wrong and are not                                     |

Conventions:

- The URL holds the state a link should keep.
- Components call the API through `$lib/api` and never call `fetch`.
- Comments say why, not what.
- The interface is Dutch; code and these files are English. The interface calls a node a bron and an edge a verbinding.
- Styles take their sizes from the tokens in `AppShell.svelte` (`--t-*` for type, `--s-1` to `--s-8` for space). `src/lib/style-scale.test.ts` fails on a font size in pixels and on more spacing off the 4px scale than `OFF_SCALE_MAX`; a rule that is changed moves to the tokens, and `OFF_SCALE_MAX` goes down to the new count.

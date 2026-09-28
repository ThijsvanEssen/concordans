# Concordans: developer documentation

Developer documentation. Documentation for users is part of the app: `/docs`, `/docs/methode`, `/docs/sneltoetsen`.
The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`); it is not repeated here.

| File                                         | Covers                                                      |
| -------------------------------------------- | ----------------------------------------------------------- |
| [`architecture.md`](architecture.md)         | Stack, layout, names, modes, data flow, commands            |
| [`api-contract.md`](api-contract.md)         | The schema snapshot and how it is kept current              |
| [`api-client.md`](api-client.md)             | Calling the API, caching, the stopgaps still open           |
| [`routes.md`](routes.md)                     | URLs, the `/explore` query, links to a bron                 |
| [`state-and-stores.md`](state-and-stores.md) | Where state lives                                           |
| [`graph-system.md`](graph-system.md)         | GraphStore, the groups of Verbonden as layers, rendering    |
| [`overlays.md`](overlays.md)                 | The overlays Open dossiers and Citaties per maand           |
| [`readers.md`](readers.md)                   | Readers per kind of bron, text anchors, the panel Verbonden |
| [`search.md`](search.md)                     | The search component and citation resolving                 |
| [`gotchas.md`](gotchas.md)                   | Things that look wrong and are not                          |

Conventions: the URL holds state that can be linked to; components fetch through `$lib/api` types and never call `fetch`; comments explain why, not what; text in the interface is Dutch, code and these documents are English. The interface calls a node a bron and an edge a verbinding. Styles take their sizes from the tokens in `AppShell.svelte` (`--t-*` for type, `--s-1` to `--s-8` for space); `src/lib/style-scale.test.ts` fails on a font size in pixels and on more spacing off the 4px scale than `OFF_SCALE_MAX`. A rule that is changed moves to the tokens, and `OFF_SCALE_MAX` is lowered to the new count.

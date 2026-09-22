# Concordans: developer documentation

Developer documentation. Documentation for users is part of the app: `/docs`, `/docs/methode`, `/docs/sneltoetsen`.
The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`); it is not repeated here.

| File                                         | Covers                                                          |
| -------------------------------------------- | --------------------------------------------------------------- |
| [`architecture.md`](architecture.md)         | Stack, layout, names, modes, data flow, commands                |
| [`api-contract.md`](api-contract.md)         | The schema snapshot and how it is kept current                  |
| [`api-client.md`](api-client.md)             | Calling the API, caching, stopgaps for API 0.5, the write proxy |
| [`routes.md`](routes.md)                     | URLs, the `/explore` query, links to a bron                     |
| [`state-and-stores.md`](state-and-stores.md) | Where state lives                                               |
| [`graph-system.md`](graph-system.md)         | GraphStore, the groups of Verbonden as layers, rendering        |
| [`overlays.md`](overlays.md)                 | The overlays In behandeling and Citaties per maand              |
| [`readers.md`](readers.md)                   | Readers per kind of bron, text anchors, the panel Verbonden     |
| [`search.md`](search.md)                     | The search component and citation resolving                     |
| [`gotchas.md`](gotchas.md)                   | Things that look wrong and are not                              |

Conventions: the URL holds state that can be linked to; components fetch through `$lib/api` types and never call `fetch`; comments explain why, not what; text in the interface is Dutch, code and these documents are English. The interface calls a node a bron and an edge a verbinding.

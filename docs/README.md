# Concordans: developer documentation

Developer documentation. Documentation for users is part of the app: `/docs`, `/docs/methode`, `/docs/sneltoetsen`.
The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`); it is not repeated here.

| File                                         | Covers                                         |
| -------------------------------------------- | ---------------------------------------------- |
| [`architecture.md`](architecture.md)         | Stack, layout, names, state, commands          |
| [`api-contract.md`](api-contract.md)         | The schema snapshot and how it is kept current |
| [`api-client.md`](api-client.md)             | Calling the API, caching, the write proxy      |
| [`routes.md`](routes.md)                     | URLs and the `/explore` query                  |
| [`state-and-stores.md`](state-and-stores.md) | Where state lives                              |
| [`graph-system.md`](graph-system.md)         | GraphStore, node kinds, rendering              |
| [`overlays.md`](overlays.md)                 | Activiteit and Mutatie overlays                |
| [`readers.md`](readers.md)                   | Readers per kind of source                     |
| [`search.md`](search.md)                     | The search overlay and page                    |
| [`gotchas.md`](gotchas.md)                   | Things that look wrong and are not             |

Conventions: the URL holds state that can be linked to; components fetch through `$lib/api` types and never call `fetch`; comments explain why, not what; text in the interface is Dutch, code and these documents are English.

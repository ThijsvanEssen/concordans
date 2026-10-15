# API contract

The schema of the API is the contract.

| File                                     | Written by          | Read by                                                                             |
| ---------------------------------------- | ------------------- | ----------------------------------------------------------------------------------- |
| `src/lib/api/openapi.json`               | `npm run sync:api`  | the `/api` page, the type generator, the largest `limit` of each route (`volledig`) |
| `src/lib/api/generated/openapi-types.ts` | `npm run types:api` | the compiler, through `api` and `Schema<...>`                                       |

`npm run sync:api` dumps the schema with `lawgraph openapi` from the lawgraph checkout in `$LAWGRAPH_DIR` (default `../lawgraph`), no server needed, and regenerates the types. Neither file is edited by hand. The version is `info.version` in `openapi.json`.

`npm run check:api` runs `sync:api` and fails when either file differs from what is committed. A change of the API then shows as a diff and, where a call or field is gone, as a compile error in `npm run check`. CI regenerates the types from the committed schema and fails on a difference.

Three files are kept the same in both repositories; a change goes into both at once.

| File here                          | In lawgraph                          | Holds                                                           |
| ---------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `src/lib/bron/readable-paths.json` | `tests/data/readable-paths.json`     | the readable address of each kind of bron                       |
| `src/lib/text/text-rules.json`     | `tests/data/text-rules.json`         | the whole word, the long date, division anchors, summary length |
| `src/lib/api/first-pages.json`     | `src/lawgraph/data/first-pages.json` | the first pages the explorer asks, which the API warms up       |

The schema types node `props`, and the names of collections and relations, as plain strings. Those names are defined once, in `src/lib/vocabulary.ts`. Views read props by name (`slug`, `number`, `ecli`, `bwb_id`, …); check a prop against the API before relying on it.

A dossier is addressed by its number with suffix (`37020-XV`, which is not `37020`). Every dossier field of the API and every route carries that number. The node key differs from it where there is a suffix (`36600_viii`); a dossier node has the number in `props.label`.

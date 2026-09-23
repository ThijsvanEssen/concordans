# API contract

The schema of the API is the contract. Its docs are in the back end repository (`docs/api.md`, `docs/data-model.md`).

| File                                     | Written by         | Read by                                       |
| ---------------------------------------- | ------------------ | --------------------------------------------- |
| `src/lib/api/openapi.json`               | `npm run sync:api` | the `/api` page and the type generator        |
| `src/lib/api/generated/openapi-types.ts` | `npm run sync:api` | the compiler, through `api` and `Schema<...>` |

`npm run sync:api` fetches the schema from `PUBLIC_CONCORDANS_API_BASE_URL` (default `http://localhost:8000`) and regenerates the types.
Neither file is edited by hand.

`npm run check:api` runs `sync:api` and fails when either file differs from what is committed.
Run it against a running API; a change of the API then shows up as a diff and, where a call or field is gone, as a compile error in `npm run check`.

The schema types node `props` and the collection and relation names as plain strings. Those names are defined once in `src/lib/vocabulary.ts`.

A dossier is addressed by its number with suffix (`37020-XV`; `37020-XV` is not `37020`). Every dossier field of the API carries it, and a dossier node has it in `props.label`; the node key is not a number. The untyped props the views read are `label` of a dossier, `case_kinds` of a document and `primary_case_kind` of a decision. See the back end's `docs/api.md` (Endpoints) and `docs/data-model.md` (Parliament).

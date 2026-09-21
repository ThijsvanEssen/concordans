# Concordans

Frontend for Concordans, a research environment that shows the structure of Dutch law: the connections between wetten, artikelen, uitspraken and parliamentary dossiers. SvelteKit 2 with Svelte 5 runes, Sigma 3 for the network view, and the LawGraph API as its only data source.

## Development

```sh
npm install
cp .env.example .env    # set PUBLIC_CONCORDANS_API_BASE_URL if the API is not on localhost:8000
npm run dev             # http://localhost:5173
```

| Command             | Purpose                                                                                       |
| ------------------- | --------------------------------------------------------------------------------------------- |
| `npm run check`     | Type check, including every API call against the schema                                       |
| `npm run lint`      | Prettier and ESLint                                                                           |
| `npm test`          | Vitest                                                                                        |
| `npm run build`     | Production build                                                                              |
| `npm run sync:api`  | Fetch the schema from the running API and regenerate `src/lib/api/generated/openapi-types.ts` |
| `npm run check:api` | `sync:api`, then fail when the committed schema or types differ                               |

Writes (watches) need the API's key on the server: set `LAWGRAPH_WRITE_API_KEY` in `.env`. It is read by `src/routes/proxy` only and never reaches the browser. Deployment needs an adapter that runs server code.

## Documentation

Developer documentation is in [`docs/`](docs/README.md), start with [`docs/architecture.md`](docs/architecture.md). The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`). Documentation for users is part of the app under `/docs`.

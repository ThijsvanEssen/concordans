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

The API is read-only, so the app has no server routes of its own. To see every feature (every relation of the model occurs in it), run the API on the test database and point `PUBLIC_CONCORDANS_API_BASE_URL` at it:

```sh
# in ~/Development/lawgraph
ARANGO_DB_NAME=lawgraph_small LAWGRAPH_API_PORT=8001 .venv/bin/lawgraph-api
```

## Deploy

A push to `release` deploys that commit (`.github/workflows/deploy.yml`): lint, check and tests, then a static build against the API at the repository variable `CONCORDANS_API_BASE_URL`. The build is copied to `/srv/lawgraph/concordans/releases/<commit>` on the server and `/srv/lawgraph/concordans/current` is pointed at it; the reverse proxy serves `current` with `index.html` as fallback. The five newest builds stay, so going back is `ln -sfn /srv/lawgraph/concordans/releases/<commit> /srv/lawgraph/concordans/current` on the server. Secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER`, and optionally `VITE_POSTHOG_KEY`.

## Documentation

Developer documentation is in [`docs/`](docs/README.md), start with [`docs/architecture.md`](docs/architecture.md). The API is documented in the back end repository (`docs/api.md`, `docs/data-model.md`). Documentation for users is part of the app under `/docs`.

# Concordans

Concordans shows Dutch law and how it came about: laws and their articles, judgments, Kamerstukken, votes, members, cabinets and commitments, with the connections between them. Everything comes from official sources (wetten.overheid.nl, rechtspraak.nl and HUDOC, the open data of both Kamers, officielebekendmakingen.nl, rijksoverheid.nl, EUR-Lex), read through the LawGraph API. This repository is the front end: SvelteKit 2 with Svelte 5 runes, Sigma 3 for the network.

A reader finds a bron by search (start page, ⌘K), by Bladeren (lists per kind of bron) or in Actueel (what came in per day). A bron opens in the Verkenner at its own address (`/wetten/BWBR0005289/artikel/6:162`, `/uitspraken/ECLI:…`): as text, or beside the network of its connections, with the panel Verbonden listing them.

## Development

```sh
npm install
cp .env.example .env    # PUBLIC_CONCORDANS_API_BASE_URL: the API
npm run dev             # http://localhost:5173
```

| Command             | Purpose                                                                                                      |
| ------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run check`     | Type check, including every API call against the schema                                                      |
| `npm run lint`      | Prettier and ESLint                                                                                          |
| `npm test`          | Vitest                                                                                                       |
| `npm run build`     | Static build in `build/`                                                                                     |
| `npm run sync:api`  | Dump the schema with `lawgraph openapi` (in `$LAWGRAPH_DIR`, default `../lawgraph`) and regenerate the types |
| `npm run types:api` | Regenerate `src/lib/api/generated/openapi-types.ts` from the committed schema                                |
| `npm run check:api` | `sync:api`, then fail when the committed schema or types differ                                              |

The test database holds every relation of the model. Run the API on it and point `.env` at it:

```sh
# in ~/Development/lawgraph
LAWGRAPH_DB_NAME=lawgraph_small LAWGRAPH_API_PORT=8001 .venv/bin/lawgraph-api
```

## Build and deploy

The app is a static build (adapter-static) that fetches everything in the browser. A readable address such as `/dossiers/36799` is no file, so the web server answers every unknown path with `index.html` (`fallback` in `svelte.config.js`).

A push to the branch `release` deploys that commit (`.github/workflows/deploy.yml`); `release` follows main fast-forward, so the commit deployed is one `ci` checked on main. The workflow waits for a green `ci` run of that commit (`.github/workflows/ci.yml`, run on every push to main), then builds against the API at the repository variable `CONCORDANS_API_BASE_URL`, copies the build to `/srv/lawgraph/concordans/releases/<commit>` and points `/srv/lawgraph/concordans/current` at it. The five newest builds stay; going back is `ln -sfn /srv/lawgraph/concordans/releases/<commit> /srv/lawgraph/concordans/current` on the server.

Secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_KNOWN_HOSTS` (the server's host key line; a changed key stops the deploy).

## Documentation

For developers: [`docs/`](docs/README.md). For users: the pages `/docs`, `/docs/methode` and `/docs/sneltoetsen` of the app. The API is documented in the back end repository.

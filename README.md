# Concordans

Concordans shows Dutch law and how it came about: laws and their articles, judgments, Kamerstukken, votes, members, cabinets and commitments, with the connections between them. Everything comes from official sources (wetten.overheid.nl, rechtspraak.nl and HUDOC, the open data of both Kamers, officielebekendmakingen.nl, rijksoverheid.nl, EUR-Lex), read through the LawGraph API. This repository is the front end: SvelteKit 2 with Svelte 5 runes, Sigma 3 for the network.

A reader finds a bron by search (start page, ⌘K), by Bladeren (lists per kind of bron) or in Actueel (what came in per day). A bron opens in the Verkenner at its own address (`/wetten/BWBR0005289/artikel/6:162`, `/uitspraken/ECLI:…`): as text, or beside the network of its connections, with the panel Verbonden listing them.

## Development

```sh
npm install
cp .env.example .env    # PUBLIC_CONCORDANS_API_BASE_URL: the API
npm run dev             # http://localhost:5173
```

| Command                | Purpose                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------ |
| `npm run check`        | Type check, including every API call against the schema                                                      |
| `npm run lint`         | Prettier and ESLint                                                                                          |
| `npm run lint:changed` | Prettier and ESLint (cached) over the files changed against `origin/main`                                    |
| `npm run test:related` | The tests that import a file under `src/` changed against `origin/main`                                      |
| `npm run gates`        | Every gate before a merge, stopping at the first that fails                                                  |
| `npm test`             | Vitest                                                                                                       |
| `npm run e2e`          | The browser suite (below)                                                                                    |
| `npm run e2e:record`   | Record the API fixtures of the browser suite anew from the live API                                          |
| `npm run e2e:update`   | `e2e:record`, then the visual baseline in the Playwright image (needs Docker)                                |
| `npm run build`        | Static build in `build/`                                                                                     |
| `npm run sync:api`     | Dump the schema with `lawgraph openapi` (in `$LAWGRAPH_DIR`, default `../lawgraph`) and regenerate the types |
| `npm run types:api`    | Regenerate `src/lib/api/generated/openapi-types.ts` from the committed schema                                |
| `npm run check:api`    | `sync:api`, then fail when the committed schema or types differ                                              |

The test database holds every relation of the model. Run the API on it and point `.env` at it:

```sh
# in ~/Development/lawgraph
LAWGRAPH_DB_NAME=lawgraph_small LAWGRAPH_API_PORT=8001 .venv/bin/lawgraph-api
```

## Browser suite

`e2e/` holds a Playwright suite (Chromium, version pinned in `package.json`) that runs against the production build under `vite preview`, at 1440 with a mouse and at 375 with touch (`isMobile`). The build talks to `http://api.e2e.test`, a host that does not exist: every API request is answered from `e2e/api/`, one gzipped file per request, recorded from the live API. The preview listens on port 4317; `E2E_PORT=<port> npm run e2e` takes another, so two suites can run side by side. The suite needs no API and no network, and gives the same answers every run. Each test fails on a console error, an uncaught exception, a request without its fixture and a request to any other host (`e2e/support/test.ts`).

| Layer               | Files                 | What it checks                                                                                                                                                                                                                                                              |
| ------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Every kind of page  | `e2e/smoke.spec.ts`   | Each page of `src/lib/seo/spa-routes.json` and one readable address per kind of bron (`src/lib/bron/readable-paths.json`): h1 and title, first paint, no `·`, red only for no and errors; at 375 no sideways scroll and tap targets of 44 px. A new page is in it by itself |
| A reader's journeys | `e2e/reizen/`         | Search, laws and articles, judgments, the parliamentary record, people and cabinets, Actueel and Gevolgd, Samenhang, Bronnen and docs, bundels, comparing old and new law                                                                                                   |
| Across pages        | `e2e/gedrag/`         | Failures (500 with its kenmerk, 503, offline, a failing step), what a text is (Coverage), menus (Escape, a tap outside), anchors, the print view of a bundel                                                                                                                |
| Pixels              | `e2e/visueel.spec.ts` | A few fixed pages against `e2e/snapshots/`, made on Linux; skipped elsewhere                                                                                                                                                                                                |

A breach of a house rule that is known and not yet fixed stands in `e2e/known.ts`; that list only shrinks, and an entry that is fixed fails until it is taken out.

**A new journey** is a test in the spec of its area under `e2e/reizen/` (or a new spec there): `import { expect, test } from '../support/test'`, go to the page, act as a reader does (roles and names, `getByRole`), assert what the reader should see. Wait for what the page loads before acting on it. Use `touch` where the widths differ, and `test.skip(touch, …)` only where a thing exists at one width alone. Then `npm run e2e:record -- e2e/reizen/<spec>` adds the fixtures the new test asks for, and `npm run e2e` runs it from them. A failure of the API is made with `failApi` (`e2e/support/api.ts`), a field the live API does not give yet with `patchApi`.

**Fixtures and baseline.** When the live data or the API changes, `npm run e2e:record` records all fixtures anew (what no test asks any more goes); a test that then fails names what changed. `npm run e2e:update` also makes the visual baseline anew in the Playwright image that CI uses; look at the changed images in `e2e/snapshots/` before committing them.

**When a person still tests.** A small change is covered by the suite in CI. A UX-toets agent (`~/.claude/agents/ux-toets.md`) is for a larger revision or a new screen: what the suite cannot judge, such as the wording, the order and the feel of a page, and a real phone.

## Build and deploy

The app is a static build (adapter-static) that fetches everything in the browser. A readable address such as `/dossiers/36799` is no file, so the web server answers every unknown path with `index.html` (`fallback` in `svelte.config.js`).

A push to the branch `release` deploys that commit (`.github/workflows/deploy.yml`); `release` follows main fast-forward, so the commit deployed is one `ci` checked on main. The workflow waits for a green `ci` run of that commit (`.github/workflows/ci.yml`, run on every push to main: lint, type check and build, the tests and the browser suite as four jobs side by side), then builds against the API at the repository variable `CONCORDANS_API_BASE_URL`, copies the build to `/srv/lawgraph/concordans/releases/<commit>` and points `/srv/lawgraph/concordans/current` at it. The five newest builds stay; going back is `ln -sfn /srv/lawgraph/concordans/releases/<commit> /srv/lawgraph/concordans/current` on the server.

Secrets: `DEPLOY_SSH_KEY`, `DEPLOY_HOST`, `DEPLOY_USER` and `DEPLOY_KNOWN_HOSTS` (the server's host key line; a changed key stops the deploy).

## Documentation

For developers: [`docs/`](docs/README.md). For users: the pages `/docs`, `/docs/methode` and `/docs/sneltoetsen` of the app. The API is documented in the back end repository.

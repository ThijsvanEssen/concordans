# Concordans

Frontend for Concordans, a research environment that shows the structure of Dutch law: the connections between wetten, artikelen, uitspraken and parliamentary dossiers. SvelteKit 2 with Svelte 5 runes, Sigma 3 for the network view, and a separate FastAPI backend.

## Development

```sh
npm install
cp .env.example .env    # set PUBLIC_CONCORDANS_API_BASE_URL if the backend is not on localhost:8000
npm run dev             # http://localhost:5173
```

| Command | Purpose |
|---|---|
| `npm run check` | Type check (`svelte-check`) |
| `npm run lint` | Prettier and ESLint |
| `npm run build` | Production build |
| `npm run sync:api` | Fetch `openapi.json` from the running backend and regenerate `src/lib/api/generated/openapi-types.ts` |

There is no test suite.

## Documentation

Developer documentation is in [`docs/`](docs/README.md). Start with [`docs/architecture.md`](docs/architecture.md). End-user documentation is part of the app under `/docs`.

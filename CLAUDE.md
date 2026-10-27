# Concordans (lawgraph-explorer)

@~/Development/lawgraph/docs/claude/werkruimte.md

SvelteKit + TypeScript, API-client uit OpenAPI (`openapi-fetch`). Uitleg: `docs/README.md`, `docs/architecture.md`, `docs/gotchas.md`, `docs/api-contract.md`.

## Commando's

- `npm run dev`; contract: `npm run sync:api` (na een lawgraph-wijziging), `npm run check:api`.
- Vóór een merge: `npm run gates` (lichte gates, daarna de zware onder een machine-lock). Lokaal liever `npm run lint:changed` en `npm run test:related`; volledige suites in CI.
- Verse worktree: `npm run check` vóór lint. Poort 4317 bezet: `E2E_PORT=43xx`. Ontbrekende fixtures: `npm run e2e:record -- <spec>`. `e2e/visueel.spec.ts` alleen in de Playwright-docker zoals in `.github/workflows/ci.yml`, niet via `scripts/e2e-update.sh` (dat wist `e2e/api`). Merge-ketens met `&&`.
- Push naar `main` draait `ci`; de site-deploy is een push naar `release` (fast-forward van `main`, zie `README.md`). Vóór een push: `git diff --stat origin/main` en controleren dat geen ander werk teruggedraaid wordt; vóór `release` een `ux-toets`.

## Huisregels

- UI- en doc-tekst: `docs/schrijfstijl.md` (lees vóór je tekst schrijft). Woorden: `docs/woorden.md`; typografie: `docs/typografie.md`.
- Toon van een rechtsgeleerde: juridische termen (dossier, debat, bijlage bij), geen monospace voor wetsnummering, elke indeling één keer getoond.
- Geen "·" als scheidingsteken (komma). Rood in rust alleen voor "nee" en fouten.
- De UI legt zichzelf uit: labels, placeholders en markeringen, geen uitlegalinea's of tellingen in panelen.
- Eén klik opent een rij of item op zijn plaats; de bron is één stap verder. Lees op de plek zelf (definities, aangehaalde tekst).
- Gelijke pagina's, gelijke ervaring: een verschil tussen gelijksoortige pagina's los je op in één gedeeld component + guard-test.
- Aangeraakte code gaat naar tokens en de 4px-schaal. Eerste weergave op de goedkoopste call; laad zo lui mogelijk.
- Eerlijk over gaten: één volledigheidssignaal uit de API, één marker in de UI.
- Frontend-wijziging: eerst een ontwerp (design-artifact) om op te reageren, dan bouwen. Telefoon eerst.

# Performance-onderzoek lawgraph-explorer

Basis: `origin/main` d2910baa, wegwerp-worktree, `npm ci` + `npm run build` (adapter-static). Geen productcode gewijzigd, niets gepusht, geen servers gestart; worktree is verwijderd. Live-metingen zijn read-only `curl` GET's op https://concordans.nl (vanaf deze machine, dus latency is een ondergrens).

Legenda: **[gemeten]** = uit build-output of curl; **[vermoed]** = uit code afgeleid, niet in een browser gemeten.

## Uitgangspunt (gemeten)

| Pagina                    | JS initieel (gz, unieke chunks) | Raw    |
| ------------------------- | ------------------------------- | ------ |
| `/` (start)               | 198 KB (79 bestanden)           | 489 KB |
| `/actueel`                | 209 KB                          | 509 KB |
| `/over` (statische tekst) | 144 KB                          | 360 KB |
| `/explore`                | 308 KB (84 bestanden)           | 794 KB |

- Entry + kit: 62 KB gz. Root-layout (node 0): 74 KB gz. Daarbovenop lazy bij `/explore`: GraphView-chunk (graphology) 54 KB gz, sigma 15 KB gz, per lezer 10-20 KB gz.
- Live: HTML 6 KB gz, TTFB 36-58 ms, `/_app/immutable/*` is `max-age=31536000, immutable`, JS komt met zstd/gzip. Dit is goed op orde.
- Er zijn geen `+page.ts`/`+page.server.ts` load-functies (`ssr=false`, alleen `(main)/api/+page.ts`). Alle data laadt in componenten; de waterfalls zitten dus daar.
- "Layout-simulatie op de main thread" bestaat niet: `src/lib/graph/layout.ts` is een synchrone radiale layout (O(n)), geen force-simulatie.

## Top 10 (winst/inspanning, hoogste eerst)

### 1. Root-layout sleept de hele Verbonden-regelset mee naar elke pagina

- **Bewijs [gemeten]:** chunk `export` (79 KB raw / 25,6 KB gz) zit in de statische import-graaf van node 0 (root-layout) en dus op elke pagina. Sourcemap-build: bevat `verbonden/groups.ts` (38 KB bron), `hoe.ts`, `rows.ts`, `summary.ts`, `filter.ts`, `view.ts`, `bron/behoort-*.ts`. Oorzaak: `src/lib/map/KeepNotice.svelte:10` (`import { download } from '$lib/verbonden/export'`) en `src/lib/map/file.ts:7` (`safeFileName`); `export.ts` importeert `view`, `filter`, `groups`, `rows`, `verbinding`.
- **Fix:** `download` en `safeFileName` (pure helpers, `export.ts:122-138`) naar `$lib/util/download.ts`; `export.ts` her-exporteert. Controle: chunk `export` niet meer in `nodes/0`.
- **Risico:** laag (alleen importpaden); `MapView.svelte:16`, `bundels/+page.svelte:18`, `onderwerpen/overzicht/+page.svelte:31` blijven werken.
- **Schatting:** -25 KB gz (-79 KB raw) op elke pagina, ca. -13% op `/`, -8% op `/explore`. Inspanning 0,5 uur.

### 2. GraphView-chunk laadt altijd op /explore, ook in leesmodus

- **Bewijs:** `src/routes/explore/+page.svelte:1691` `$effect(() => graphChunk.load())` zonder voorwaarde (de index-chunk op :1693 is wel voorwaardelijk). `exploreMode()` (`src/lib/bron/href.ts:20-27`) geeft `'read'` voor elk leesbaar adres (`/wetten/...`, `/uitspraken/...`, `focus=`) en `'graph'` alleen voor netwerkmodus; daar is het canvas niet zichtbaar (`canvasZichtbaar`, :1676). **[gemeten]** chunk `GraphView`+graphology: 176 KB raw / 54 KB gz (graphology 178 KB bron, `GraphCanvas` 57 KB, `hulls` 22 KB). Sigma (15 KB gz) komt pas bij mount van het canvas. **[vermoed]** dat leesverkeer (zoekmachine-landingen op leesbare adressen) hem niet nodig heeft; hij concurreert op trage verbinding met de lezer-chunk.
- **Fix:** `graphChunk.load()` alleen bij `mode === 'graph'`, anders prefetch in `requestIdleCallback` na het eerste lezer-resultaat (zodat wisselen naar netwerk niet wacht).
- **Risico:** laag-middel: canvas verschijnt later bij directe klik zonder prefetch; e2e voor netwerk-wissel draaien.
- **Schatting:** -54 KB gz op de kritieke weg van leesbare adressen. Inspanning 1-2 uur.

### 3. Startpagina: wetsnetwerk-waterfall van 4-5 stappen

- **Bewijs [code]:** `src/routes/(main)/+page.svelte:123-157` en `src/lib/components/actueel/wetsnetwerk.ts:362-392`: feed/summary -> `tick` -> `idle()` (tot 2000 ms) -> per kandidaat serieel `getChangedArticles` (max `POGINGEN`=4; `continue` bij `total===0`) -> `getCitedByTop` -> pas dan mount `Wetsnetwerk.svelte:34`, dat de NetworkSketch-chunk (15,8 KB gz) pas op `onMount` importeert. **[gemeten live]:** summary met app-parameters 0,41 s koud / 0,06 s warm; met andere parameters 5,5 s koud. `changed-articles` voor dossier 31765: 4,4 s koud, 0,08 s warm, `total: 0` (dus volgende kandidaat); ook 36585 (Wetgeving, 27 okt) heeft `total: 0`; 36586: 0,35 s. Elke lege kandidaat kost dus een volledige serieele rondreis.
- **Fix:** (a) `import('$lib/verbonden/NetworkSketch.svelte')` + `sketch` meteen starten zodra de summary er is; (b) de eerste 2 kandidaten parallel vragen (feed-volgorde bepaalt de winnaar; `inPool` bestaat al); (c) `idle()` alleen voor het renderen, niet voor het starten van de requests; (d) `getCitedByTop` blijft serieel (hangt af van het top-artikel).
- **Risico:** middel: extra requests naar een API met 200/min-limiet; kandidaat-volgorde moet gelijk blijven (er zijn tests voor `wetsnetwerk`).
- **Schatting:** 0,3-1,5 s eerder zichtbaar voorbeeld bij warme API, tot enkele seconden bij koude (per lege kandidaat); de idle-wacht (max 2 s) vervalt. Inspanning 3-4 uur.

### 4. Explore-focus: serieele rondreizen vóór het canvas af is

- **Bewijs [code]:** `explore/+page.svelte:1264-1330`: `getDossierKey` -> `peekNode` (licht) -> `expandNode` (canvas 30/hull) -> `deepen` -> `expandAround` (:1133-1160): `getSurroundings` -> `expandNeighborhood` -> bij dossiers een tweede `expandNeighborhood` (:1155) die niet van de eerste afhangt. `getNodeNeighborhood` gebruikt `slowApi` en is volgens de code "cold 10 s" (`api/nodes.ts:185`); hij start pas na twee voorgaande rondreizen. Het canvas-node wordt al wel vooraf gestart (:1313-1316), de neighbourhood niet.
- **Fix:** (a) bij `inGraph` de neighbourhood-request starten naast `peekNode`/`expandNode` (zelfde `once`-patroon als `canvasNode`); (b) de twee dossier-neighbourhoods met `Promise.all`; (c) `expandNode` niet laten wachten op `peekNode` (die levert alleen een eerdere kop).
- **Risico:** middel: abort/epoch-logica (`focusEpoch`, `loadedFocus`) moet kloppen; meer gelijktijdige requests; alleen starten als het canvas zichtbaar is.
- **Schatting [vermoed, niet gemeten tegen koude API]:** 1-2 rondreizen minder (0,1-0,4 s warm, seconden koud) tot een afgerond canvas. Inspanning 4-6 uur.

### 5. Explore-pagina is een monoliet; netwerkweergaven zitten er statisch in

- **Bewijs [gemeten]:** `explore`-chunk 249 KB raw / 89 KB gz (bron 583 KB; `+page.svelte` alleen al 100 KB, `Verbonden.svelte` 33 KB). Daarin statisch: `ChainView` (29 KB), `ChainRows` (19 KB), `network/chain.ts` (18 KB), `lineage.ts` (13 KB), `pairs.ts` (11 KB), `SharedView`, `NetwerkPanel`, `IndexOverzicht` (`+page.svelte:65-123`) - samen ca. 100 KB bron, alleen nodig in netwerk-/indexmodus. Readers, GraphView en index-lijsten zijn al lazy via `Lazy`.
- **Fix:** `ChainView`, `SharedView`, `NetwerkPanel`, `IndexOverzicht` achter `Lazy` per modus (patroon staat er al: `+page.svelte:1683-1712`).
- **Risico:** middel: groot bestand (2716 regels, 31 `$effect`, 84 `$derived`); lazy-flits en laad-/foutstaten per component.
- **Schatting [vermoed]:** -15-20 KB gz op elk /explore-bezoek. Inspanning 1 dag.

### 6. Geen route-specifieke modulepreload: node-chunks pas ontdekt na uitvoering van app.js

- **Bewijs [gemeten live]:** `/` en `/explore` hebben beide dezelfde 23 `modulepreload`-links (entry-niveau, 63 KB gz). De node-chunks (home: node 0 + 2 + 4 = 135 KB gz; explore: node 19 -> 89 KB gz chunk) volgen pas uit `import()` in `kit.start` na `env.js` -> `start`/`app` (bootstrap-script in `build/index.html`). Er staan geen `<link rel=stylesheet>` in de head: CSS (`0.css` 21 KB / 5 KB gz, `19.css` 48 KB / 8 KB gz) komt via JS. Ketting: HTML -> env.js/entry -> nodes -> hun chunks/CSS.
- **Fix:** in de bestaande `besideIndex`-plugin (`vite.config.ts`) een `route-preloads.json` uitgeven (route -> modulepreload- en css-lijst, uit de vite-manifest); de API (lawgraph, rendert de HTML) injecteert die per route. Ook `<link rel=preload as=style>` voor de layout-CSS.
- **Risico:** middel: raakt twee repos (`spa-routes.json` is al het precedent); first-paint-script en takeover mogen niet veranderen.
- **Schatting [vermoed]:** 1-2 RTT eerder voor de app-JS (100-400 ms op mobiel). Inspanning 0,5-1 dag, plus API-kant.

### 7. Fonts: `no-cache` en UI-font zonder preload

- **Bewijs [gemeten live]:** `/fonts/Newsreader-Variable.woff2` (131.848 B), `/og/*`, `favicon.ico`, manifest: `cache-control: no-cache` (alleen ETag-validatie, elke bezoekpagina een voorwaardelijke request per font). Zeven fonts in `static/fonts` (1,1 MB totaal). `app.html` preload alleen Newsreader roman; `--font-ui: 'Schibsted Grotesk'` (`tokens.css:77`, 47 KB) wordt pas ontdekt na parse van de via JS geladen CSS en heeft in `fonts.css` geen fallback met `size-adjust` (alleen Newsreader heeft die): **[vermoed]** layout shift in de topbalk.
- **Fix:** Caddy (staat niet in deze repo): `/fonts/*` `Cache-Control: public, max-age=2592000, stale-while-revalidate=31536000`, of font-bestanden hashen in de build; `<link rel=preload>` voor Schibsted Grotesk in `app.html`; fallback-`@font-face` met `size-adjust` voor Schibsted.
- **Risico:** laag (bij ongehashte namen zien clients een fontwijziging pas na max-age).
- **Schatting:** herhaalbezoek -7 conditionele requests; eerste bezoek ca. 1 RTT eerder UI-font. Inspanning 1-2 uur (+ serverconfig).

### 8. Fontgewicht: Newsreader 132 KB roman + 147 KB italic

- **Bewijs [gemeten]:** `static/fonts`: Newsreader latin 131.848 B, italic 147.060 B, latin-ext 86.628 / 95.412 B; variabel met opsz-as (6..72) en wght 400..600. `fonttools` niet geïnstalleerd, dus geen proefsubset gemaakt.
- **Fix [schatting]:** assen beperken/instantiëren (`fonttools varLib.instancer`) en OpenType-features strippen; typisch -30-40%.
- **Risico:** middel: zichtbare typografiewijziging; de fallback-metrics in `app.html`/`fonts.css` (size-adjust, ascent-override) en de first-paint-pixelgelijkheid moeten opnieuw getoetst.
- **Schatting [vermoed]:** -40-60 KB op het eerste bezoek (roman), meer met italic. Inspanning 0,5 dag + visuele regressie-toets.

### 9. Canvas: werk bij elke frame

- **Bewijs [code]:** `GraphCanvas.svelte:1302` `renderer.on('afterRender', updateViewportLabels)`; `updateViewportLabels` loopt over nodes met in-flux/notities en roept aan het eind `computeHulls()` (:580) aan, dat `layoutHulls` over alle hulls draait en `$state` `hulls`/`hullLinks`/`hullHitAreas` herschrijft (SVG-herrender per frame bij pan/zoom). `computeHulls` loopt ook bij elke hoverwissel (:445). `beforeRender` herberekent `voorbehouden()`. Redraws zelf zijn wel gebundeld (`redrawInFrame`).
- **Niet gemeten:** geen browserprofiel gedraaid. Eerst meten met een Performance-trace op een groot netwerk (Awb, Wetboek van Strafrecht), daarna pas fixen.
- **Fix [als meting het bevestigt]:** hull-layout coalescen op rAF/overslaan bij ongewijzigde camera; hover alleen stijl wijzigen i.p.v. layout; geen werk als er geen hulls en geen in-flux-stippen zijn.
- **Risico:** middel-hoog: label-/hull-plaatsing is gevoelig (veel snapshot-tests).
- **Schatting:** onbekend tot meting. Meten 2 uur, fixen 1 dag.

### 10. Kleine opruimers

- **Ongebruikte dependency [gemeten]:** `graphology-layout-forceatlas2` staat in `package.json` maar wordt nergens geïmporteerd (grep over `src`); layout is radiaal. Geen bundelwinst, wel snellere `npm ci` en minder supply-chain.
- **`/api`-pagina:** node 10 is 200 KB raw / 49 KB gz (route-docs inline uit `apiDocs`, `vite.config.ts`): als JSON-asset lazy laden. Weinig bezocht, lage prioriteit.
- **Lange wetten [vermoed]:** `WholeLawReader.svelte:492` mount alle geladen artikelen (pagina's stapelen bij "Volgende artikelen"); `content-visibility: auto` + `contain-intrinsic-size` op het artikelblok is een kleine CSS-winst bij lange wetten. Er is geen windowing; paginering (50/100 per pagina) is elders wel aanwezig.
- **Risico:** laag. **Inspanning:** 1-2 uur samen.

## Al goed (geen actie)

Lazy lezers/GraphView/index (`Lazy`), request-dedupe (`once`, `abortable`), begrensde parallelle pool (`inPool`), lichte node-varianten (limit 1/5/30 i.p.v. 200), paginering 50-100, immutable chunk-cache met zstd, HTML 6 KB gz, first-paint-takeover met fallback-fonts, gebundelde canvas-redraws.

## Niet gevonden / buiten bereik

- Caddy-config en HTTP-headers staan niet in deze repo (`deploy.yml` rsync't alleen `build/` en `immutable/`); punt 7 vraagt dus een serverwijziging (akkoord vooraf nodig).
- Dubbele dependencies: geen (`sigma`, `graphology`, `@sigma/node-image`, `openapi-fetch`; `events` komt mee met graphology, 15 KB bron).
- Niet gemeten: Lighthouse/INP/LCP in een echte browser, gedrag van `/neighborhood` bij koude API, rendertijd van het canvas.
- Terzijde: `https://concordans.nl/sitemap.xml` geeft 404 terwijl `robots.txt` ernaar verwijst (geen performance-punt, wel SEO).

## Volgorde in 3 PR-pakketten (een taak = een branch, geen stacked PR's)

1. **PR 1: bundel- en cache-quick-wins** (punt 1, 7, 10). Verplaats `download`/`safeFileName`, font-preload + fallback, opruimen dependency, `content-visibility`. Server-cacheheaders voor fonts als apart akkoord. Controle: chunk `export` weg uit `nodes/0`, `/` en `/explore` minder gz. Laag risico, grootste winst per uur.
2. **PR 2: Explore-laadpad en chunks** (punt 2, 4, 5). Graph-chunk voorwaardelijk + idle-prefetch, neighbourhood parallel, netwerkweergaven lazy. Eerst meten met een `performance`-trace op een leesbaar adres en een netwerk-adres; e2e voor netwerkwissel draaien.
3. **PR 3: startpagina en preload-infra** (punt 3, 6). Wetsnetwerk-waterfall parallel + chunk-prefetch; `route-preloads.json` in `besideIndex` (API-kant in lawgraph apart plannen). Daarna als vervolg: meten en dan pas punt 9 (canvas per frame) en punt 8 (fontsubset).

## Uitvoering pakket 1 (deze PR)

- **Punt 1 gedaan:** `download` en `safeFileName` staan nu in `src/lib/util/save-file.ts`; `KeepNotice.svelte`, `map/file.ts`, `MapView.svelte`, `bundels/+page.svelte` en `onderwerpen/overzicht/+page.svelte` importeren daar. `verbonden/export.ts` re-exporteert niet (guard: één adres per naam); `Verbonden`, `VerbondenTabel` en hun tests importeren ook uit `save-file`. Chunk met de Verbonden-regelset zit niet meer in node 0.
- **Punt 10 gedaan:** `graphology-layout-forceatlas2` uit `package.json` en lockfile.
- **Punt 7, repo-deel gedaan:** `<link rel=preload>` voor `SchibstedGrotesk-Variable.woff2` in `src/app.html`.
- **Niet gedaan, bewust:** `content-visibility` op `WholeLawReader` (nog [vermoed], raakt scroll-naar-anker en zoeken in de pagina; eerst meten), `size-adjust`-fallback voor Schibsted (typografie-/first-paint-toets nodig), `/api`-docs als asset (lage prioriteit).

### Meting (gz, unieke chunks in de statische importgraaf, uit de vite-manifest van `npm run build`)

| Route                        | Voor     | Na       | Verschil |
| ---------------------------- | -------- | -------- | -------- |
| Root-layout (node 0 + entry) | 132,7 KB | 90,3 KB  | -42,4 KB |
| `/`                          | 191,0 KB | 162,7 KB | -28,3 KB |
| `/over`                      | 138,5 KB | 97,3 KB  | -41,2 KB |
| `/explore`                   | 298,0 KB | 298,2 KB | +0,2 KB  |

`/explore` wint niets: de pagina importeert `Verbonden.svelte` zelf statisch, dus de chunk blijft daar nodig (aanpak in pakket 2, punt 5). Het verschil in de maat voor `/` is kleiner dan de -25 KB uit het onderzoek omdat dit script de hele root-closure telt. Voor `/` blijft de chunk elders nodig. Het script telt geen lazy chunks.

### Voorstel serverkant (niet uitgevoerd; akkoord vooraf nodig)

Caddy staat niet in de repo. Voorstel voor de site-block van concordans.nl:

```caddy
@fonts path /fonts/*
header @fonts Cache-Control "public, max-age=2592000, stale-while-revalidate=31536000"
```

- Risico: bestandsnamen zijn niet gehasht; een gewijzigd font wordt pas na `max-age` (30 dagen) zichtbaar. Alternatief: fonts hashen in de build (`/_app/immutable/`), dan kan `immutable` met 1 jaar.
- Zelfde afweging voor `/og/*`, `favicon.ico` en het manifest (nu `no-cache`): kort `max-age` (bv. 1 dag) met `stale-while-revalidate` is genoeg.
- Controle na uitrol: `curl -sI https://concordans.nl/fonts/Newsreader-Variable.woff2 | grep -i cache-control`.

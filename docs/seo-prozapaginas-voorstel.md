# Voorstel: tekst in de serverHTML van de prozapagina's

Status: gekozen (A, alle zes pagina's, Thijs 28 okt). Front end gebouwd in dezelfde PR (`spa-texts.json`); de back end moet het bestand nog serveren. Bij `docs/seo-toets.md`, bevinding 1.

## Probleem

De serverHTML van `/over`, `/bronnen`, `/privacy`, `/voorwaarden`, `/docs/methode` en `/docs/sneltoetsen` heeft wel titel, description en canonical (uit `spa-routes.json`), maar geen `main#seo` en geen `h1`. Een lezer of crawler zonder JavaScript ziet een lege pagina; een linkvoorbeeld heeft alleen de description. Wetten en dossiers hebben die tekst wel (`main#seo` uit de API). Gemeten met `curl`; het effect op de indexering is afgeleid.

Het zijn zes pagina's, samen 653 regels Svelte, met vaste tekst die zelden verandert. `/actueel`, `/onderwerpen` en `/api` zijn dynamisch en horen hier niet bij (voor `/actueel` zie onder).

## Opties

**A. Tekst uit de build, geserveerd door de API (aanbevolen).** Past op het bestaande ontwerp: `main#seo` vóór de app, door de root-layout verwijderd bij het mounten, de serverkop blijft staan.

1. Een buildstap rendert de zes pagina's met `svelte/server` naar HTML en bewaart per pad alleen het `h1`-blok en de inhoud (`<h1>`, `<p>`, `<h2>`, lijsten, links) als `build/spa-texts.json`, naast `spa-routes.json` (zelfde plek en mechanisme in `vite.config.ts`).
2. De API leest dat bestand bij het opstarten en zet de HTML voor die paden in `<main id="seo">`, zoals nu voor een wet.
3. Een test houdt de lijst gelijk aan de pagina's met `RouteKop` onder `(prose)` en `docs`, zoals `spa-routes.json` nu.

Voordeel: geen SSR in de app, de app blijft zoals ze is. Nadeel: de Svelte-componenten (`Sectie`, `Caret`) moeten zonder browser renderen, en de API moet een nieuw bestand lezen (werk aan de back end).

**B. Prerender in SvelteKit.** `export const prerender = true; export const ssr = true` per pagina en Caddy `try_files {path}.html`. Nadeel: de root-layout is op `ssr = false` gebouwd en gebruikt browser-API's; de pagina's zouden de serverkop (`data-seo`) van de API en hun eigen kop dubbel zetten. Meer risico, geen voordeel boven A.

**C. `<noscript>` met een korte tekst.** Goedkoop, maar geen `h1` in de zichtbare structuur en een tweede plek om bij te houden. Alleen als A te groot blijkt.

## Voorgestelde stappen

1. Front end: buildstap en test voor `spa-texts.json` (klein, eigen PR; raakt `vite.config.ts` en `src/lib/seo`).
2. Back end: API serveert `main#seo` voor deze paden uit dat bestand (eigen PR in lawgraph).
3. Meten: `curl` op de zes paden (h1 aanwezig, tekst zichtbaar zonder JS) en Search Console na een paar weken.
4. `/actueel`: apart bekijken; de API kent de feed al, een lijst van de laatste items als `main#seo` ligt daar voor de hand.

## Besluiten voor Thijs

- A kiezen, of B/C?
- Zes pagina's nu, of eerst alleen `/over` en `/bronnen` als proef?
- `Organization`-JSON-LD (bevinding 2) in dezelfde stap meenemen, met de uitgeversnaam zoals in `/over`?

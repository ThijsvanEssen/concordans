# SEO-toets (28 oktober 2026)

Gemeten met `curl` tegen `https://concordans.nl` (live, 28 okt, ca. 22:00) en met de code in de repo. Niet gemeten: Lighthouse, Search Console, wat Google werkelijk indexeert. Dat is afgeleid en staat zo aangegeven.

## Uitkomst in het kort

De opdracht ging uit van een `/sitemap.xml` die 404 geeft. Dat klopt niet: de sitemap bestaat en wordt door de API geserveerd. Er is daarom **geen sitemap-route in de build** gebouwd. De rest van de SEO is op de paginakoppen na op orde; de open punten zijn structureel en vragen ruggespraak.

## Gemeten

| Onderdeel                                     | Uitkomst                                                                                                                                                                             |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /sitemap.xml`                            | 200, `text/xml`, een sitemapindex met 22 delen (`sitemap-wetten.xml` … `sitemap-activiteiten.xml`, `sitemap-paginas.xml`). Geserveerd door de API achter Caddy, niet door deze build |
| `sitemap-paginas.xml`                         | `/`, `/explore`, `/actueel`, `/onderwerpen`, `/onderwerpen/overzicht`, `/docs…`, `/api`, `/over`, `/bronnen`, `/voorwaarden`, `/privacy`; geen `/zoeken` en `/bundels` (terecht)     |
| `robots.txt`                                  | `Allow: /`, `Disallow: /api/`, `Sitemap: https://concordans.nl/sitemap.xml`: klopt                                                                                                   |
| Per pagina (16 paden)                         | Eigen `<title>` en description, canonical, 7 `og:`-tags met `og:image`, `twitter:card`, `lang="nl"`                                                                                  |
| `noindex`                                     | `/zoeken` (ook met `?q=`; canonical zonder query), `/bundels`, de 404-pagina                                                                                                         |
| 404                                           | `/bestaat-niet` geeft status 404 met "Niet gevonden, Concordans" en `noindex`                                                                                                        |
| JSON-LD                                       | Startpagina: `WebSite` met `SearchAction`. Wet (`/wetten/BWBR0005289`): `Legislation` en `BreadcrumbList`. Geen `Organization`                                                       |
| Tekst in de serverHTML (`main#seo`, één `h1`) | Wet: ja (h1, kruimelpad, inhoud met links). Startpagina: ja. **Prozapagina's en overzichten: nee**                                                                                   |

Eenmalig zag ik op `/over`, `/zoeken` en een onbekend pad een 502 van Caddy, later niet meer (200 en 404). Mogelijk een deploy of herstart van de API op dat moment; niet te reproduceren. Als dit vaker voorkomt, ziet een crawler een 502 op de pagina's.

## Bevindingen, op impact

1. **Prozapagina's en overzichten hebben geen inhoud in de serverHTML** (`/over`, `/bronnen`, `/privacy`, `/voorwaarden`, `/docs…`, `/actueel`, `/onderwerpen`, `/api`). Titel, description en canonical zijn er, `<main id="seo">` en `h1` niet. Een crawler die JavaScript uitvoert (Google) ziet de pagina na het renderen; een crawler of linkvoorbeeld zonder JavaScript ziet alleen de kop. _Afgeleid_, niet in Search Console gecontroleerd. Voorstel, niet gebouwd: de prozapagina's zijn statisch; geef de API-server voor deze paden dezelfde `main#seo` met `h1` en de pagina-tekst (of prerender ze in de build en laat Caddy ze eerst proberen). Dit raakt de API en Caddy, dus ruggespraak.
2. **Geen `Organization`-JSON-LD.** Alleen `WebSite` op de startpagina. Toevoegen kan op `/over` of de startpagina, met alleen wat klopt (naam, url, logo). Vraagt wel een besluit over de naam van de uitgever; niet gebouwd.
3. **`/explore` staat in de sitemap met één titel** ("Netwerk, Concordans"). Diepe links met `?focus=` hebben hun eigen canonical (`canonical()` in `src/lib/seo/routes.ts`); in orde.
4. **Sitemap-premisse.** Een statische `build/sitemap.xml` zou de API-index overschaduwen als Caddy bestanden eerst probeert en dan alle bronnen uit de sitemap halen. Daarom hierboven niet gebouwd, en de guard hieronder.

## Gefixt in deze PR

- `src/lib/seo/robots.test.ts`: guard dat `robots.txt` de sitemap absoluut op `https://concordans.nl/sitemap.xml` noemt, `/api/` blokkeert en de pagina's niet, en dat deze build geen eigen `sitemap.xml` heeft (die zou de API-index verbergen).

Voorstel voor bevinding 1: [`seo-prozapaginas-voorstel.md`](seo-prozapaginas-voorstel.md).

Er is verder niets in de paginakoppen veranderd: de gemeten koppen waren al goed.

## Skills

`design-skills:accessibility-audit`, `design-skills:ux-writing` en de `seo-writers:*`-skills heb ik niet gebruikt: de koppen en descriptions zijn kort, uniek en in de huisstijl, en die skills zijn voor artikelen bedoeld. De toets is dus handmatig, op de HTML.

## Open

- Punt 1 en 2 hierboven, met ruggespraak (API en Caddy).
- Lighthouse en Search Console (dekking, "gevonden maar niet geïndexeerd") zijn niet gemeten; Search Console kan alleen Thijs.
- Caddy: geen wijziging voorgesteld; de huidige routing van `/sitemap*.xml` naar de API werkt.

# Controls

How a control looks and where it stands, on every page and in every panel. The text speaks, the controls stay quiet: each has one form and one place, so a reader neither searches for it nor reads past it.

## Five forms

| Form      | For                                                     | Component                                              | Looks                                                                                                         |
| --------- | ------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Knop      | doing something: Citeer, Vergelijken, CSV, Deel, Volg   | `.btn` (24), `.btn is-groot` (32), in `basis.css`      | Schibsted, `--t-ui`, 500; `--veld-h` (32) on a page, `--veld-h-klein` (24) in a panel                         |
| Keuze     | one of 2 to 5 visible options: Periode, Netwerk/Tekst   | `ui/Keuze.svelte`                                      | joined boxes, the chosen one filled in ink                                                                    |
| Tekstmenu | one of many, or a setting: Alle bronnen, Nieuwste eerst | `ui/TekstMenu.svelte`                                  | the word of its value with a caret, no frame; the chosen option in weight                                     |
| Vinkje    | switching a thing on or off in a list: facets, columns  | `ui/FilterOptie.svelte` (`inline` beside other things) | the box (`ui/Vinkje.svelte`: 12 px, `--r-1`, a drawn tick), the label, a count at the right; chosen in weight |
| Tekstlink | going somewhere: Alle 244 uitspraken, Wis alle filters  | `ui/TekstLink.svelte`, `ui/AlleN.svelte`               | the serif in ink, underlined; red only on hover and focus                                                     |

And one icon button, `ui/IconButton.svelte`, 24 px, for +, ×, zoom and ⋯; it names what it does.

No chips: a choice shows in its control (in weight in the facet, as the value of the text menu). No native `select`: it is a text menu. The chips of the panel Netwerk are content (the chosen bronnen), not a filter.

## Four layers

Every page and panel, from top to bottom:

1. **Heading**: the title at the left, its actions at the right, at most three buttons (more in ⋯).
2. **Choose-line**: what is shown, in `ui/Bepaalregel.svelte`: Zoeken, Periode and Kamer where the list has them, each labelled above its left edge, all 32 px on one line; on a phone under each other. Nothing else.
3. **Refine**: on a page the facets at the left with their counts; in a narrow panel behind one text menu or Filter; on a phone behind Verfijnen (N), opened in place.
4. **List**: a group's heading is its fold; at most one switch at its right (netwerk, named "Toon in het netwerk"); at most one line of controls under it (order, refine); one text link at the foot, Alle N.

A row has no buttons of its own: a click on the row does it. Its actions (and a group heading's In netwerk, for all its rows), Bewaar and In netwerk, are icon buttons (`ui/RijActies.svelte`: a bookmark, the network with a +) that show on hover or focus of the row (`data-rij`), always on a phone at 32 px. At rest only the state shows: a filled bookmark when kept, the network when in the network. A box is for a choice in a filter, never for an action.

This holds for Bladeren too: a row's title opens the bron in Netwerk, Lezen is one step from there. There are no buttons at the end of the row. A Kamerstuk is the exception: every click on it (a BronLink, a row of Verbonden or Bladeren, a line of a tijdlijn, a number in an amendment's chain) opens its text, and Netwerk is the step from there; one whose text is not in the data yet opens in Netwerk. One rule, `openHref` in `src/lib/bron/href.ts`; only a link that names the network (In het netwerk) builds its own.

A row of a Kamerstuk in Verbonden and in Bladeren opens in place on its core text, as in Actueel and Bundels: a motie its dictum, an amendement its toelichting, another stuk its opening (`RijInhoud`, `kernVan` in `src/lib/components/open/rij-inhoud.ts`); Lees verder, or the title with a modifier, opens the stuk. A judgment that cites an article opens beside the article at its r.o. (`?naast=judgments/…#rov-…`), as the memorie does.

## Measure, letter, colour, words

- Height: 32 on a page, 24 in a panel or group; one line of controls has one height. On the 4 px grid; `--s-2` between controls, `--s-4` between groups.
- Letter: a control in Schibsted at `--t-ui` or `--t-ui-micro`, 500. A text link and a facet's label are text, in the serif.
- Colour: ink for everything; chosen is filled (Keuze) or in weight. Red (`--accent`) only on hover and focus, for the outcome "nee" (`--uitkomst-nee`) and for an error. What was red at rest is ink: te laat and voorgesteld in weight, nu, the majority, a chosen or active row, a cited link.
- Words: a text menu shows its value ("Alle bronnen"), not a label with a colon; a button is a verb or a destination; counts stand in the control ("Alle 244 uitspraken"), not in a sentence; no explanatory sentences between controls.

## Size in a timeline

Two things at one level do not differ in size. In a timeline (Actueel, Onderwerpen, the home page, a dossier's procedure) the large line is kept for the bill, its own decisions, and a close vote, where the size carries meaning (decided by a narrow margin). A toezegging, a motie or a brief stands at the size of the lines beside it (`major` in `src/lib/components/actueel/home-stream.ts`).

## Layout

Two kinds of page, no third.

- **Full width**: lists, overviews, timelines and text: the home page, Bladeren and each of its categories, Actueel, Onderwerpen and its Overzicht, Bundels and a bundel's page, the API reference, /docs, /over, /bronnen, /voorwaarden, /privacy.
  - Every one sits in the frame of Bladeren: `.blad` (at most 1440 px, gutter `--s-6`; on a phone `--s-4`), with `.blad__indeling` for a facet column of 240 px, a gap of 40 px and the rest.
  - The facet column is `.blad__facetten`: sticky, a quiet scroll bar clear of the counts, one right edge for controls and counts.
  - The head is `.blad__kop` with the title and, at its right, the page's actions (`.blad__acties`). A page without facets lists in the list column all the same (`.blad__lijst`), on the edge of the other lists: Bundels and a bundel's page. Where the left column holds the groups of the page, a way to each, it is one component (`Inhoudsopgave`): Bronnen, Gevolgd and a bundel's page (its groups per wet of dossier; a jump on a shared bundel keeps its address). Not on a phone, not on paper.
  - A line that sets the page runs over both columns: the choose-line of Actueel and Gevolgd (`Bepaalregel`). What belongs to the list stands in the list column: a bundel's research question, which goes with it into the citations and onto paper.
  - A text page keeps a reading width of 720 px inside the frame, on the same left edge (`.blad--tekst`).
  - The classes live in `src/lib/styles/frame.css`; no page sets a width of its own. The footer stands on the same edge.
- **Panels**: the Verkenner and its readers beside Netwerk and Verbonden, each column its own measure (`--reader-*`). Unchanged.

## Kamer

Kamer is one choice, never a set of boxes: a Keuze in the choose-line under its label Kamer (Bepaalregel), on a phone under the period. Where both may stand, Beide | Tweede Kamer | Eerste Kamer, Beide filtering nothing (Actueel, the Overzicht); where one must, Tweede Kamer | Eerste Kamer (the halls, Bladeren's Kamerleden and Fracties).

## Cards over the network

Netwerk and the Legenda stand in one column on the canvas, Netwerk on top and the Legenda under it, as wide as each other. Both may stand open while the canvas has the height. When the one opened last leaves no room for the other, the other folds, and opens again by itself once there is room, unless someone closed it (`src/lib/stores/zwevend.ts`). Each remembers open or closed per browser.

## Bundels

What a reader keeps while reading goes into a bundel (`src/lib/map`; in the code a bundel is a map). Bundels is a page, as every item of the menu; there is no panel. The first bundel, Losse markeringen, is always there and always so named (by its place, whatever name it was kept under): it is emptied, never renamed or deleted. In a browser that keeps no bundels yet its id is `losse-markeringen`, the same in every tab.

- **Keeping:** Bewaar in the menu of each lid, onderdeel and overweging (`PlaatsMenu`), in the head of a reader (`Bewaar lid 3`) and in each row of Verbonden as a bookmark (`RijActies`). Bewaar keeps in Losse markeringen. Bewaar vanuit de lezer under Andere bron toevoegen opens the reader keeping in that bundel for the browser session (`?bundel=<id>` on arriving, taken out of the address at once, so no link carries it): Bewaar says `Bewaar in <bundel>`, with `Naar <bundel>` and `Klaar` beside it, on every reader until Klaar or a visit to that bundel's page ends it. As soon as any bundel holds the bron it says Bewaard; Bewaard, the caret beside it, a row's filled bookmark and a place's menu all show the same list (`BundleChecklist`): the bundels, Losse markeringen first, a tick at each that holds the bron, a click putting it in or taking it out of that one bundel. Nothing is taken out of every bundel in one click. Nieuwe bundel in that list asks its name in place (`Naam`). There is no bundel chosen in the background (decision 20A). The network shows the notes of every bundel. The menu item Bundels has no count.
- **The overview:** `/bundels`, a list as Bladeren's (`BundleRow`, an `IndexRow`): Losse markeringen first, then the bundels last changed first; per row the name (a link to its page), the first line of its research question in grey, its number of bronnen and the day it changed (not on a phone). A click opens the row in place: per group its citations on one line, and Open bundel. The head holds Nieuwe bundel (its name asked in place, `Naam`; Enter opens its page) and Meer (Bestand openen, Alle bundels downloaden). The page reads this browser's storage only.
- **A bundel's page:** `/bundels/<id>`, the place to work. The head holds Netwerk, Kopieer link and Meer (Kopieer citaten, Download CSV, Download bestand, PDF; then Hernoem and Verwijder bundel, or Leegmaken for Losse markeringen; an empty Losse markeringen has no Meer). Under it the research question, a field with the placeholder `Onderzoeksvraag of aantekening` where it is empty; then one working line with the order (Per wet of dossier, Eigen volgorde) and Alles uitklappen, and the place for Lijst | Oud en nieuw (O3). Groups are headed by the law, the dossier, Rechtspraak or Andere bronnen, without a count; their ⋯ holds Regelingen gebaseerd op (a law) and Aantekening. Each row cites on one line (the full form only where it adds to the short one); its ⋯ (`RijActies`, on hover and focus, always on a touch screen at 44 px) holds Aantekening, Omhoog and Omlaag (in the own order) and Haal uit bundel. All judgments stand under Rechtspraak; two or more r.o.'s of one judgment stand under it as places.
- **Content in place:** a click on an item's row opens what it keeps beneath it (`MapInhoud`), asked only then: an article its lid in the reader's own text (ArticleText, with its references and defined terms), Heel artikel shows the article with the kept lid marked by the bar of a kept place; a judgment its overweging with its sub-overwegingen (CitedText), Overwegingen eromheen adds three before and after; a Kamerstuk the words its note quotes (`"…"`) in the text around them, else the opening of its text; another bron the lines of its card. Lees verder opens the bron. Alles uitklappen and Alles inklappen in the meta line open or close every item of a bundel; on a shared bundel too.
- **Netwerk:** opens the Verkenner on the bundel's bronnen only, as a netwerk of chosen bronnen (`/explore?netwerk=…&tussen=0`): each bron once (two leden of one article are the article), the verbindingen among them, the bronnen between them off. The Netwerk panel adds to it (+ bron, Toon de bronnen ertussen). The shared bundel has it too.
- **Andere bron:** under a bundel's groups, `Andere bron toevoegen` opens a form in place (`src/lib/map/AddSource.svelte`): Citeervorm (required, kept as typed: the row's title, its Citaten and CSV), Adres (optional, http or https; `voorbeeld.nl/boek` is read as https, anything else shows `Geen webadres`), Soort (Boek, Tijdschrift, Annotatie, Webpagina, Overig) and Groep (Andere bronnen or a group of the bundel). Its row shows the kind in the lead and `Bron ↗` to its address; a click opens the address in place. An address or citation that names a bron Concordans holds (its own address, an ECLI, a BWB id, a CELEX, a `kst-` or `stb-` of officielebekendmakingen.nl; `recognize.ts`, nothing fetched) shows `In Concordans: …` (a law by its name once Concordans gives it, else `deze wet`) with `Bewaar vanuit de lezer`; it is never made an item on its own.
- **Notes:** an item's, a group's and the bundel's own note in one form (`Aantekening`): a click opens it in place, Enter keeps it, Escape leaves it. A group's note is kept by the group's key (`wet:bwbr0052872`, `dossier:36764`, `rechtspraak`). Notes go into the link, the citations and the CSV.
- **PDF:** Meer › PDF opens the print view (A4, without the bar and the footer): the name, the question, the day it changed and what the bundel holds; the browser's print dialog saves it as a PDF.
- **Sharing:** a link `/bundels#m=…` holds the bundel in its fragment (`src/lib/map/share.ts`): its name, order, note, notes per group and items as JSON, deflated (`deflate-raw`) into base64url. A fragment is never sent, so no request, `/render` or log holds a bundel. It opens as the bundel's page, read only, with Bewaar (as a new bundel, numbered on where its name is taken: `Thuiswerk 2`; a shared Losse markeringen as Gedeelde markeringen) in place of Kopieer link, and Voeg toe aan … and Niet bewaren in Meer. A link that does not read (cut off, broken) or of the older form (`?map=`) shows `Link onvolledig of beschadigd` with Sluiten, as a broken file does.
- **A file:** Meer › Bestand openen reads a file of bundels; each stands at the top of the overview as a row marked `uit bestand`, read only. Its choice in sight is Bewaar, or Vervang where it is one of this browser's bundels again (by its id); its ⋯ holds Bewaar als nieuwe bundel or Vervang <naam> (a bundel of the same name), Voeg toe aan … and Niet openen.
- **Addresses of before:** `/gemarkeerd` and `/gemarkeerd/bundel?id=` move to `/bundels` and `/bundels/<id>` on loading, a shared link's fragment with them (`src/lib/map/page.ts`, `hooks.client.ts`, `reroute` in `hooks.ts`).
- **Storage:** the bundels live in this browser (`concordans:mappen`), without an account. Every change starts from what the browser keeps, not from the tab's copy, and another tab's change comes in at once (the storage event): a tab opened before never undoes what another kept. An item this version cannot read is written back as it was kept.

## Lezers

Every reader alike.

- **The band:** one line at meta size, the term in ink-3 straight before what it names (no column of terms), a chain of more than two layers folded to `first › … › last` (the "…" opens it). One rule under the band and Netwerk/Tekst together, over the full width (ReaderFrame `.kop-rij`).
- **The head:** two actions, framed, at the right of the status line (`KopActies`). Bewaar is a button with the bookmark that keeps at once, with the map choice on a caret joined to it. Citeer holds the forms, Kopieer tekst and the official text (`bron ↗`). No other buttons in the head. A dossier and a stemming have Bewaar alone: a stemming is cited through what was voted on.
- **Where the text came from:** in ink under the status line ("Ingevoerd bij …", "Memorie van toelichting ↓"); the memorie opens under the article, at its passage on the article where the data has one (`passages`), else at its start. No separate Toelichting section: the memorie's reader is the place.
- **A place** (lid, onderdeel, sub, overweging, at any depth): nothing beside the text at rest. Its own marker (`1.`, `a.`, `1°`) is its menu (`PlaatsMenu`), underlined with ▾ on hover or focus; a click on the place's text opens the same menu for the innermost place, unless the click is on a link or text is selected. The menu names the place as cited, then the forms (Kopieer als), Kopieer tekst, Bewaar in <map> and the count of verbindingen. Escape and a click outside close it and give the focus back to the marker; the arrows move. On a phone a tap does the same. A kept place has a thin ink bar in the left margin (`.plaats-bewaard`), the parent of a kept sub-onderdeel none.
- **Read in place:** what belongs to the text comes to it. A cited article or lid shows its own text in the card; a defined term its definition; the memorie opens at its passage. A reference to a judgment at an r.o. (the r.o. in a row of Verbonden, any link with `at` rov-…) shows the whole overweging in its card, the words that cite the article marked, with Open de uitspraak bij r.o. N; on a phone the first tap shows it, a tap outside closes it (`OverwegingKaart`, the same `Overweging` as an opened item of Bundels). Going to the source is one step further, never the only way. Verbonden keeps the relations: nothing moves from it into the reader.

## Bronregels

Lines about how current the data is, and the dates that belong to what a page shows.

- **How current the data is:** one line in the footer of every page, `Stukken van de Kamers tot en met 9 okt. 2026, opgehaald op 10 okt. 2026` (`data_as_of` of `/api/stats`, asked when the footer comes into view). Not in the head of a page. Two exceptions: the empty list of Actueel, where it says why nothing shows, and Bronnen en hergebruik, whose subject it is (per source, `tot en met …, opgehaald op …`).
- **A date of what is shown:** a caption under the object, serif, `--t-micro`, `--ink-3`, in one of these words:
  - a composition or a hall: `Samenstelling op 8 oktober 2026[, gegevens sinds …]. Bron: <bron>.`;
  - a page of a source read for this bron: `Bron: <bron>, geraadpleegd op 9 oktober 2026.`;
  - a search that stopped short: `Doorzocht vanaf 1 september 2026.`
- A text in force on a day (`Tekst geldend op …`) is the content itself, not a source date.

## Marks on a timeline

A line of a timeline (Actueel on the home page, Onderwerpen, a dossier's procedure) carries the mark of its kind from `src/lib/bron/vormen.ts`, the table KindGlyph and the network draw from. A vote is the triangle of a decision, a paper the sheet, a bill the sheet with its window, a toezegging the flag, a law in force the square of a law. A bundle has the mark of its kind (Stemmingen the triangle). The outcome is in the fill: aangenomen or afgedaan filled in moss, verworpen open in the accent, open or still to come dashed. The Tijdlijn has no circle or square of its own.

Every series of dated lines is the one `Tijdlijn` (`src/lib/components/tijdlijn/`): Actueel and Onderwerpen, the home page, a dossier's procedure, a post in Bladeren, the toezeggingen, Loopbaan and Commissies of a member, and the changes of an article between A and B. Its date column says only what the heading does not: no column where the heading names the day (Actueel), the day and month where it names the year (a group of the procedure), else the day and month with the year under it. A term (Loopbaan, Commissies) is the compact form `perioden`: the years in the reader's term column, no line and no mark. A course (procedure, changes) runs from old to new, an overview (Actueel, toezeggingen) from new to old; the Tijdlijn sorts each group itself (`volgorde`). A line with content of its own (`inhoud`: a dictum, the bar of a vote, the opening of a paper, the facts of a toezegging, the papers of one day) behaves as a row of Actueel: one click on the line or its title opens the content beneath it, one line at a time; the bron is a link in that content, and cmd-click on the title opens it at once. A line without content has its title as a BronLink. The lid history of an article is legal text, not a timeline: each formulation under its period as a heading.

## Rules

`src/lib/guards/bediening.test.ts`: no native `select` outside TekstMenu, no chips outside the panel Netwerk, no "meer" of its own beside AlleN, no control height but `--veld-h` or `--veld-h-klein`, no framed button but `.btn` and IconButton, no menu item but `tekstmenu__item` (a menu of its own adds a class for its layout only), Verfijnen styled once in `basis.css`. `guards/tokens.test.ts` holds the tokens: no hex or `rgb()` in a style outside `tokens.css`, a radius only from `--r-*`, a face only through `--font-serif` or `--font-ui`. A place that keeps an older form is an `Uitzondering` with its reason (`src/lib/test/bronnen.ts`); one that no longer excepts anything fails its guard, so it comes out with the step that made it unneeded.

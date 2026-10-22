# Woorden

The fixed words of the interface, in Dutch as the interface says them. The guard
`src/lib/guards/woorden.test.ts` reads the table Verboden below and fails on each of its words in
the code of `src` (comments excepted). A new word that replaces an old one goes into that table
with it.

## Vaste woorden

| Woord                         | Gebruik                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| bron                          | Een wet, artikel, uitspraak, stuk, dossier of persoon in Concordans. De uitgever heet officiële bron, of bij naam: wetten.overheid.nl, rechtspraak.nl. |
| Kamerzaak                     | Een zaak van de Tweede Kamer binnen een dossier. Zaak alone is a rechtszaak (samenhangende zaken, conclusie in dezelfde zaak).                         |
| stemming                      | What the Kamer does and its uitslag: tab, list, filter and CSV. Besluit only as the Kamer's own word for the outcome (Besluit van de Kamer).           |
| persoon                       | A member of either Kamer or a bewindspersoon. Kamerlid only for a member of the Tweede Kamer, as a title on the person's page.                         |
| stand                         | Of a dossier or a toezegging: openstaand, nagekomen, aangenomen, verworpen. Status only for a verbinding: vastgesteld or voorgesteld.                  |
| uit de bron                   | A verbinding the publisher records itself: an article of a law, a Kamerstuk in its dossier, a reference in the XML of wetten.overheid.nl.              |
| staat letterlijk in de tekst  | A verbinding read from a reference with a number in the text: ‘artikel 6:162 BW’, an ECLI.                                                             |
| naam herkend                  | A verbinding read from a name, without a number, or below full confidence. The row stands in italics.                                                  |
| niet in de gegevens           | A part Concordans does not hold: `Tekst niet in de gegevens`.                                                                                          |
| nog niet beschikbaar          | A part the source has and Concordans has not read yet: `Tekst nog niet beschikbaar`, `Begrippen nog niet beschikbaar`.                                 |
| alleen bij de bron            | A text Concordans does not take in: `Tekst alleen bij de bron`.                                                                                        |
| nog niet gekoppeld            | References recognised and not linked: `12 verwijzingen nog niet gekoppeld`.                                                                            |
| verbonden bronnen             | In the network: what one step from the chosen bron adds (`Toon verbonden bronnen`, `Alleen verbonden bronnen`).                                        |
| aantal stappen                | How far the network reaches from the bron.                                                                                                             |
| toon erbij                    | What the network colours on top: open dossiers, verwijzingen per maand.                                                                                |
| Bewaren                       | Into a bundel.                                                                                                                                         |
| Downloaden                    | A file: CSV, bestand, alle bundels.                                                                                                                    |
| Wissen                        | Empties: a bundel, the filters.                                                                                                                        |
| Verwijderen                   | Removes a thing for good: a bundel.                                                                                                                    |
| Annuleren                     | Breaks off an input.                                                                                                                                   |
| Sluiten                       | Closes a panel or a card.                                                                                                                              |
| In het netwerk                | Opens a bron or a set of bronnen in the network.                                                                                                       |
| Volgende stappen              | What a bill can still go through, in the procedure.                                                                                                    |
| nog niet in stemming gebracht | A motion that has not been voted on.                                                                                                                   |

The relation words (haalt aan, wijzigt, voegt in, trekt in, komt na, licht toe, zegde toe,
stemde voor) live in `src/lib/verbonden/relation-words.ts`; each says what the one bron does to
the other, never only that they are connected.

## Verboden

A word in this table is matched as written. A single word is matched as a whole label: between
quotes or between `>` and `<`.

| Verboden                      | Gebruik                                              |
| ----------------------------- | ---------------------------------------------------- |
| `herkend in de tekst`         | staat letterlijk in de tekst, naam herkend           |
| `Herkend in de tekst`         | Staat letterlijk in de tekst                         |
| `, afgeleid`                  | , naam herkend                                       |
| `afgeleid door`               | op naam herkend                                      |
| `gelezen uit de bron`         | uit de bron                                          |
| `gerelateerd aan`             | Uit de bron, Tweede Kamer                            |
| `niet gelegd`                 | nog niet gekoppeld                                   |
| `niet geladen`                | niet in de gegevens                                  |
| `wordt nog verwerkt`          | nog niet beschikbaar                                 |
| `nog niet opgehaald`          | nog niet beschikbaar                                 |
| `nog niet verwerkt`           | nog niet beschikbaar                                 |
| `Opvolger niet gevonden`      | Geen opvolger in de transponeringstabel              |
| `Fragment niet teruggevonden` | Passage niet meer in de tekst                        |
| `boven de tekst staat`        | Geen andere verbindingen                             |
| `Buren`                       | Verbonden bronnen                                    |
| `Diepte`                      | Aantal stappen                                       |
| `Overlay`                     | Toon erbij                                           |
| `Omgeving tonen`              | Toon verbonden bronnen                               |
| `Alleen de omgeving`          | Alleen verbonden bronnen                             |
| `paden gevonden`              | verbindingen gevonden                                |
| `bronnen bereikt`             | Maximaal N bronnen getoond                           |
| `Lid van het artikel`         | Lid                                                  |
| `zaak in een dossier`         | onderdeel van een dossier                            |
| `bij een zaak`                | bij een Kamerzaak                                    |
| `over een zaak`               | onderwerp van een stemming, een debat of vergadering |
| `verband tussen zaken`        | door de Kamer verbonden                              |
| `wetsvoorstel van een wet`    | totstandkoming via een wetsvoorstel                  |
| `zelfde bron`                 | ook gepubliceerd als                                 |
| `gedaan in`                   | genoemd in, toegezegd in                             |
| `deed`                        | zegde toe                                            |
| `'uitspraak op'`              | uitspraak na                                         |
| `Kan nog volgen`              | Volgende stappen                                     |
| `Aan de orde na`              | Volgt na                                             |
| `niet in stemming geweest`    | nog niet in stemming gebracht                        |
| `Leegmaken`                   | Wissen                                               |
| `Annuleer`                    | Annuleren                                            |
| `Wis alles`                   | Wissen                                               |
| `Toon in Samenhang`           | In het netwerk                                       |
| `Open in Samenhang`           | In het netwerk                                       |
| `impliceert`                  | Wie Concordans gebruikt, aanvaardt deze voorwaarden  |
| `Deze pagina zegt`            | (weg: the heading says what follows)                 |

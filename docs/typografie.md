# Text hierarchy

The order in which a page reads, from the page down to a count. This is the typography, not the place of a bron, which is in [`hierarchie.md`](hierarchie.md). Every rung uses the tokens in `src/lib/styles/tokens.css`; there is no size of its own.

All text is in the serif (Newsreader) in three weights, 400, 600 and 800; the sans (Schibsted Grotesk, `--font-ui`) is only for controls: buttons, choice rows, fields, keys, menus and the navigation.

| Rung | What                                      | Face  | Size                | Weight | Colour  | Example                                         |
| ---- | ----------------------------------------- | ----- | ------------------- | ------ | ------- | ----------------------------------------------- |
| 1    | Page title: the bron a reader shows       | serif | `--t-h1` / `--t-h2` | 600    | `ink`   | "Laurens Dassen" (ReaderHead)                   |
| 2    | Section heading                           | serif | `--t-h3`            | 800    | `ink`   | "Stemgeschiedenis" (Sectie)                     |
| 3    | Group in a section                        | serif | `--t-meta` (14px)   | 600    | `ink`   | "Voor 14", a fractie above its votes            |
| 4    | Item title: a bron in a list              | serif | `--t-body-2`        | 400    | `ink`   | the motie voted on                              |
| 5    | Meta line: date, kind, dossier, outcome   | serif | `--t-micro` (13px)  | 400    | `ink-3` | "stem van de fractie (Volt), Aangenomen, 6 okt" |
| 6    | Label and count beside a heading or group | serif | `--t-micro` (13px)  | 400    | `ink-3` | the 50 beside "Stemgeschiedenis"                |
| -    | Control: button, choice row, field, menu  | sans  | `--t-ui` (13px)     | 500    |         | Periode, Citeer, the top navigation             |

Rules:

- One rung down is one step in size, face or weight, never only in colour.
- Inside a meta line, the word that decides (Aangenomen, Verworpen) stands at 600 in `ink-2`; the rest stays `ink-3`.
- Rungs 3, 5 and 6 are one pixel over the sizes the sans had (14 and 13px): the serif has the smaller x-height. A control keeps the sans' size (`--t-ui`), so a row of choices still fits a narrow column.
- `src/lib/guards/typografie.test.ts` guards it: no `--font-sans`, `--font-ui` only in a rule for a control, and text only at 400, 600 and 800.
- A stem (Voor, Tegen) and an outcome have a shape as well as a colour: `Stem.svelte` and `Uitkomst.svelte`. Voor and aangenomen a filled box in `--uitkomst-ja`, tegen and verworpen an open box in `--uitkomst-nee`, the rest a dashed box. The word goes with the box where there is room; a row under a group carries the box alone.
- Tabular figures only in a column of figures, never in a sentence: "6 okt . 2026" is what they do to a date in a line (`guards/typografie.test.ts`).
- A dossier is its number and its name, "36496 Wet betaalbare huur", never the number alone. `dossierLabel()` in `$lib/bron/dossier-naam.ts` where the data has the title or short title; `DossierNaam.svelte` where it has only the number: the number at once, the name asked by number once it is in view (once per number, two at a time). The number stays first: Kamerstukken are cited by it. A name wraps on a phone; it is not cut there.

## Alignment in a reader

Every reader has the same lines (`ReaderFrame.svelte`).

- **The column's edge:** the title, the kicker, the meta line, a heading, and all running text: a summary, the overwegingen of a uitspraak, the leden of an artikel, the text of a Kamerstuk. There is no indent.
- **The frame's margin (desktop):** the number of an overweging or a lid hangs there, outside the column. On a phone, which has no margin to hang in, it stands in a narrow column of its own.
- **The term column** (`--voorkolom`, 96px): a term and what it names share one column. This covers the band Behoort bij, the partijen of a uitspraak, Voor and Tegen of a stemming, the years of a career, and the stem of a voter. 96px fits the longest term ("Bij wetsvoorstel") on one line at rung 6. On a phone the column is only as wide as its term.
- **One right edge:** the column's (`--reader-max`). Running text has no line width of its own: the overwegingen, the leden of an artikel and the text of a Kamerstuk run to the same edge as the summary, the band and the partijen. A lid's count and actions stand under its text; an onderdeel's actions appear over the end of its last line.

## Where the rungs apply

- A person's votes (`MemberReader.svelte`): the stem as group (rung 3) with its box in every row, the fractie as group, no tabular figures in the meta line.
- The voters of a besluit (`DecisionReader.svelte`) and the list of an Overzicht carry the same `Stem`.
- Rung 6 (`--t-micro`, 400) in the readers and the lists around them:
  - the controls in ArticleReader, JudgmentReader and DocumentReader (link to a heading, paragraph buttons, the columns of the versions menu);
  - the summary and parties rows of JudgmentToc;
  - Verbonden's captions and notices, and the place line of an opened row;
  - Bladeren's column heads and the label over a group of tabs.
- A head over a group at rung 3 (`--t-meta`, 600, `ink`): the facet groups of Bladeren (Stand, Soort, Fase, Ministerie), with their note at rung 6, and the first level of DocumentToc.
- `/onderwerpen/overzicht`, the Kruiswoord (`src/lib/onderwerpen/Kruiswoord.svelte`): one grid, its column heads at rung 6 under their group (Stukken, Stemmingen, a chosen fractie) at rung 3, the totals at the size of rung 2, the months at rung 5 and a cell's count at rung 4; every number is a button. Over it the Strekking as a Keuze with the marks of `StrekkingTeken.svelte` (bevorderend solid, beperkend striped, neutraal open, niet beoordeeld light), its name at rung 6 before it. On a phone the heads stand upright and the grid pans under its month labels (`data-zijscroll`).
- Actueel: its day heads at rung 2, its facet heads at rung 3, a title at rung 4, the kind and meta line at rungs 5 and 6.
- The band "Behoort bij" above every reader: the legal term at rung 6, a bron at rung 4.

## Exception

A chart's own labels stay at `--t-label` (11px): the names in the bars and the axes of the cabinet timeline, and the ticks and phases of CabinetOccupancy. At 12px the names in a bar of fixed width are cut off sooner ("Balkenend…"). They are part of the figure, not of the text.

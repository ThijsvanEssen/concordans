# Text hierarchy

The order in which a page reads, from the page down to a count. This is the typography, not the place of a bron, which is in [`hierarchie.md`](hierarchie.md). Every rung uses the tokens in `AppShell.svelte`; there is no size of its own.

| Rung | What                                      | Face  | Size         | Weight | Colour  | Example                                         |
| ---- | ----------------------------------------- | ----- | ------------ | ------ | ------- | ----------------------------------------------- |
| 1    | Page title: the bron a reader shows       | serif | `--t-h1`     | 500    | `ink`   | "Laurens Dassen" (ReaderHead)                   |
| 2    | Section heading                           | serif | `--t-h3`     | 500    | `ink`   | "Stemgeschiedenis" (Sectie)                     |
| 3    | Group in a section                        | sans  | `--t-meta`   | 600    | `ink`   | "Voor 14", a fractie above its votes            |
| 4    | Item title: a bron in a list              | serif | `--t-body-2` | 400    | `ink`   | the motie voted on                              |
| 5    | Meta line: date, kind, dossier, outcome   | sans  | `--t-micro`  | 400    | `ink-3` | "stem van de fractie (Volt), Aangenomen, 6 okt" |
| 6    | Label and count beside a heading or group | sans  | `--t-micro`  | 400    | `ink-3` | the 50 beside "Stemgeschiedenis"                |

Rules:

- One rung down is one step in size, face or weight, never only in colour.
- Inside a meta line, the word that decides (Aangenomen, Verworpen) stands at 500 in `ink-2`; the rest stays `ink-3`.
- A stem (Voor, Tegen) and an outcome have a shape as well as a colour: `Stem.svelte` and `Uitkomst.svelte`. Voor and aangenomen a filled box in `--uitkomst-ja`, tegen and verworpen an open box in `--uitkomst-nee`, the rest a dashed box. The word goes with the box where there is room; a row under a group carries the box alone.
- Tabular figures only in a column of figures, never in a sentence: "6 okt . 2026" is what they do to a date in a line (`consistency.test.ts`).

- A dossier is its number and its name, "36496 Wet betaalbare huur", never the number alone (Thijs, 9 Oct). `dossierLabel()` in `$lib/bron/dossier-naam.ts` where the data has the title or short title; `DossierNaam.svelte` where it has only the number: the number at once, the name asked by number once it is in view (once per number, two at a time). The number stays first: Kamerstukken are cited by it. A name wraps on a phone; it is not cut there.

## Applied

- A person's votes (`MemberReader.svelte`, 9 Oct 2026): the stem as group (rung 3) with its box in every row, the fractie as group, no tabular figures in the meta line.
- The voters of a besluit (`DecisionReader.svelte`) and the list of an Overzicht carry the same `Stem`.

## Still to do

Not yet held against the ladder, for when they are next touched:

- The other readers. `CommitteeReader`, `ArticleReader`, `JudgmentReader` and `DocumentReader` use `--t-label` (11px), below rung 6; where it heads a group, it moves to rung 3.
- Verbonden, Bladeren and Actueel: their group heads and meta lines.
- `/onderwerpen/overzicht`: the column heads of its tables would need a rung of their own if more tables come.

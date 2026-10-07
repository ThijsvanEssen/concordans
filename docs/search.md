# Search

One component, `src/lib/search/Search.svelte`, in three places: on the start page (with a scope: Wetten, Uitspraken, Parlement or Kabinet), in the ⌘K dialog `src/lib/components/layout/SearchOverlay.svelte`, and in the panel Netwerk, to add a bron (`src/lib/netwerk/NetwerkPanel.svelte`). `AppShell` owns the dialog and provides the opener through `src/lib/stores/search-trigger.ts`. On a page with its own field (`main [data-search-field]`) ⌘K focuses that field; elsewhere it opens the dialog.

## Request

`GET /api/search?resolve=true` with `types` = `KINDS` (eleven collections, narrowed by the scope) and `limit` 6 per type. Input is debounced by 180 ms; a new query aborts the previous request, and earlier results stay until the answer arrives. The API orders hits within a type by `score`; `orderGroups` (`present.ts`) puts the group with the best answer first. Stukken of one dossier stand together under its number and title (`sectionOf`, `bySection`). The `extra` object of a hit is untyped.

## Rows

`presentHit` in `src/lib/search/present.ts` makes each row: a title that tells it from its neighbours, the context at the right, and a line of the text where the API gives one (`snippet`), started just before the first word searched for, with the words marked. An article reads `Artikel 6:164` with its code at the right; a judgment `Hoge Raad, 19 februari 1993` with its ECLI; a stuk is named by its kind under its dossier.

## Citations

`parseCitation` in `src/lib/search/resolve-query.ts` recognises an ECLI, a BWB id, a CELEX number, a publication (`Stb. 2026, 94`), a dossier number with an optional document number, and an article citation (`art. 6:162 BW`, `artikel 359a lid 1 onder b Sv`, `artikel 3:4, tweede lid, Awb`). A query that parses gets a first row above the hits.

Choosing that row resolves it. The `resolved` part of the search answer is used when it is there; otherwise `resolveQuery`:

1. A Kamerstuk with its number, or a publication: `/api/lookup`, exact.
2. Anything else: `/api/resolve`.
3. Where that finds nothing, the parser's own lookups: the article of a law, the paper or the dossier of a number, the existence of a judgment or law.

A bron opens only when the API confirmed it; otherwise the row goes and the hits stay. The lid or onderdeel of a citation becomes the fragment (`parseQualifier` and `anchorOf` in `src/lib/text/qualifier.ts`).

## Opening

A hit or a resolved citation opens `bronHref(ref, { at })`, at its readable address: from the start page in Tekst where the bron has a text, inside the Verkenner in the current view. ↑ and ↓ move over the rows; Enter opens the active one. Escape clears the field, or closes the dialog.

## Adding a searchable type

1. The API adds the type to `/api/search`.
2. Add the collection to `KINDS` and, where its row needs a field, a case to `presentHit`.

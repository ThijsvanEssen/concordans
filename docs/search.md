# Search

One component, `src/lib/search/Search.svelte`, in two places: inline on the start page and inside the ⌘K dialog `src/lib/components/layout/SearchOverlay.svelte`. `AppShell` owns the dialog and provides the opener through `src/lib/stores/search-trigger.ts`. On a page with its own field (`main [data-search-field]`) ⌘K focuses that field; elsewhere it opens the dialog.

## Request

`GET /api/search` with `types` = `KINDS` (`instruments`, `articles`, `judgments`, `dossiers`, `documents`, `committees`, `factions`, `members`) and `limit` 6 per type. Input is debounced by 180 ms; a new query aborts the previous request and earlier results stay until the answer arrives. Hits are grouped by kind in the order of `KINDS`; the order within a group is the API's. The `extra` object of a hit (`bwb_id`, `article_number`, `citation_title`, `ecli`, `number`, `current_stage`, `kind`, `party`) is untyped.

## Citations

`parseCitation` in `src/lib/search/resolve-query.ts` recognises an ECLI, a BWB id, a CELEX number, a dossier number with an optional document number, and an article citation ("art. 6:162 BW", "artikel 359a lid 1 onder b Sv", "artikel 3:4, tweede lid, Awb"). A query that parses gets a first row above the hits, marked as the kind the citation stands for.

Choosing that row calls `resolveQuery`: `GET /api/resolve` first; where that route is absent or finds nothing, the parser's own lookups (the BW books from a table, other laws through `/api/search`, the article through `/api/articles/{bwb_id}/{n}`, a document through `/api/dossiers/{n}/documents`, existence through `/api/nodes/{collection}/{key}`). A dossier is looked up by its number through `/api/dossiers/{number}`, which gives its node key; an unknown number is a 404. A letter or parenthesised suffix is part of the number (`37020-XV`, `23908-(R1519)`); a digit suffix (`21501-31`) is tried as a dossier first, then as a paper of the bare number. A dossier hit links by `extra.number`. A bron is opened only after the API confirmed it exists; otherwise the row disappears and the hits stay. The lid or onderdeel of the citation becomes the fragment (`parseQualifier` and `anchorOf` in `src/lib/text/qualifier.ts`).

## Opening

A hit or a resolved citation opens `bronHref(ref, { at })`: from the start page in Lezen, inside `/explore` in the current mode. Arrow keys move over the citation row and the hits; Enter opens the active row, a hit only when the list answers the query as typed. In the dialog Tab stays on the field and Escape closes it.

## Adding a searchable type

1. The API adds the type to `/api/search`.
2. Add the collection to `KINDS` and, where its context line needs a field, a case to `contextOf`.

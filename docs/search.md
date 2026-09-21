# Search

Two surfaces call `GET /api/search` with different limits. The endpoint and its `types` are described in the API's [`api.md`](../../lawgraph/docs/api.md); it returns hits with `score` 1.0, so the order within a group is the API's and the interface does not rerank.

| Surface                | File                                             | Request `limit`                      | Shows                             |
| ---------------------- | ------------------------------------------------ | ------------------------------------ | --------------------------------- |
| Search overlay (cmd-K) | `src/lib/components/layout/SearchOverlay.svelte` | `FETCH_LIMIT`, the largest `CAP` + 1 | Up to `CAP[group]` hits per group |
| `/search` page         | `src/routes/(main)/search/+page.svelte`          | 50                                   | Everything returned               |

`limit` applies per type. Both call `api.GET('/api/search', ...)` with an `AbortSignal` and type a hit as `Schema<'SearchResultItem'>`. The `extra` object of a hit carries the fields the surfaces read: `bwb_id`, `article_number`, `citation_title`, `ecli`, `number`, `party`, `abbreviation`, `kind`. Its values are untyped.

Both group hits by domain (Wetgeving: `instruments`, `articles`; Rechtspraak: `judgments`; Parlementair: `dossiers`, `committees`, `factions`, `members`, `documents`). Chips switch a domain on or off. Articles are grouped by law, judgments by court tier (`judgmentTier` in `src/lib/graph/types.ts`).

## Overlay

- Input is debounced by 60 ms. A new keystroke aborts the request of the previous one; earlier results stay visible while the next request runs.
- The request asks for one hit more than `CAP`. When a group holds more than `CAP`, `moreRow` links to `/search?q={query}#{group}`; the one extra hit only tells that there is more.
- Arrow keys move over `flat.items`, the visible hits of the enabled domains in screen order; `flat.offset` gives the start of each group.
- `directHitFor` recognises "Art. 6:162 BW" (BW book and the codes in `WETBOEK_BWB`), an ECLI and a dossier number, and offers a link straight to `/explore?focus=...` without waiting for a search result.
- A picked hit opens `/explore?mode=split&from=search&focus={id}`. `from=search` makes the explore page empty the canvas first, since a search is a jump and not an accumulation. The `/search` page links to `/explore?mode=split&focus={id}` without it.

## `/search` page

The query is in `?q=`; a submit navigates to the same route with `replaceState`. The subgroups carry the anchors that the overlay links to: `instruments`, `articles`, `judgments` (first court tier), and the group names `dossiers`, `committees`, `factions`, `members`, `documents`.

## Adding a searchable type

1. The API adds the type to `/api/search`.
2. Overlay: add the group to `CAP`, `DOMAINS` and, for a parliamentary type, `TK_SECTIONS`.
3. Page: add it to `TK_GROUPS`, or add a subgroup with an anchor `id`.

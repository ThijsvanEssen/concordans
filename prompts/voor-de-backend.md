# For the back end

What the Concordans front end needs from the LawGraph API and does not find in it. Checked
against `docs/api.md`, `docs/data-model.md`, the route, schema and query modules, and the
front end's snapshot (`src/lib/api/openapi.json`, identical to `app.openapi()` at version 0.4.0).
Ordered by how much of the user experience depends on the item. The front end has a stopgap or
leaves the element out until the item is delivered; each stopgap is marked `TODO(backend Bn)`.

The journey behind the list: from a dossier (Wetboek van Strafvordering) to the law, the
committee, the MvT, the Eerste Kamer and the EU and international instruments; from an article
to the MvT that explains it; between texts, references to a lid, aanhef, onderdeel or overweging.

## B1. Dossier hub in one call

`GET /api/dossiers/{number}` has header, stage and four counts. It has no links. Opening a dossier
now needs a node call, the timeline and the committee list, joined in the client.

- Add to `DossierDetailResponse` (or a `/hub` route):
  - `instruments[]`: `id`, `bwb_id`, `celex`, `display_name`, `jurisdiction`,
    `relation` (`legislated_in`, `amends`, `introduces`, `repeals`), `status` (`canoniek`,
    `voorgesteld`). From `LEGISLATED_IN` and Document to Instrument or Article edges, resolved to
    the parent instrument.
  - `committees[]`: `key`, `slug`, `name`, `role: "lead"`, from `LED_BY` on the dossier's activities.
  - `documents_by_kind`: counts.
  - `eerste_kamer`: `document_count`, `first_date`.
- Today `GET /api/dossiers/{n}/mutations` only returns edges whose target is an article
  (`STARTS_WITH(e._to, "articles/")`), so document-to-instrument edges and `LEGISLATED_IN` are
  absent, and the timeline does not carry `LEGISLATED_IN`.
- Front-end stopgap: `dossier-hub.ts`, three requests joined client-side.

## B2. Chamber, source and explanatory flag on documents

- Add `chamber` (`TK`, `EK`), `source`, `is_explanatory` to `DossierDocumentDTO`,
  `DocumentSummaryDTO`, `DocumentTextResponse`. The Eerste Kamer documents (`ek_<id>`, `PART_OF` the
  dossier with `meta.chamber="EK"`) are today recognisable only by key prefix.
- Add `dossier_numbers[]` and `explains[]` (`id`, `collection`, `bwb_id`, `article_number`) to
  `DocumentTextResponse`.
- `GET /api/documents`: add a `dossier` filter and `offset`. `total` currently equals
  `len(items)`, not the number of matches.
- `GET /api/decisions`: add a `dossier` filter (only `dossier_numbers` on the DTO today).
- Front-end stopgap: `chamberOf(document)` on the key prefix.

## B3. Timeline body and activity committee

`entries[].body` in `/api/dossiers/{n}/timeline` is the node's raw `props`. A document entry carries
its full `text` and `raw`. Activities carry `committee_id` but no committee name.

- Replace `body` by a typed slim body, or add `include_body=false`.
- Give activity entries `committee{key, slug, name}`.

## B4. Explanatory documents of an article

`EXPLAINS` is written by `pipelines/semantic/tk_mvt.py` at dossier level: every MvT and NvT in a
dossier explains every article version, article or instrument that the dossier's law changed. The
edge often points at an `article_versions` node or at the instrument.
`GET /api/articles/{bwb_id}/{n}/legislative-history` follows edges whose `_to` is exactly the article
and misses the others.

- Add `GET /api/articles/{bwb_id}/{n}/explained-by`: `items[]` with `document{key, kind, title, date,
dossier_number, chamber}`, `target` (`article`, `article_version`, `instrument`), `article_version_key`,
  `confidence`.
- Resolve edges to `article_versions` and to the parent instrument, not only `articles/...`.
- Better: emit per-article `EXPLAINS` from the MvT's own article headings, with `meta.section_anchor`.
- Front-end stopgap: `explanatoryDocuments(article)`, merging legislative-history, the instrument's
  dossiers and their documents of kind `memorie van toelichting`.

## B5. MvT passages per article

`GET /api/documents/{key}` returns one plain-text blob. An MvT has a toelichting per article
("Artikel I, onderdeel A"), but nothing maps an article to a passage.

- Add `sections[]` to the document: `id`, `heading`, `level`, `article_refs[]`, `char_start`, `char_end`.
- Add `GET /api/documents/{key}/passages?bwb_id=&article=`: `passages[]` with `section_id`, `heading`,
  `char_start`, `char_end`, `text`, `confidence`.
- Front-end stopgap: `findPassage(text, articleNumber)`, a text match marked as derived.

## B6. Structured article text and references with a lid

- `ArticleSummaryDTO` is `text` only. Leden are lines starting `1. `; aanhef and onderdelen are
  not marked. Add `parts[]`: `id` (`lid-2`, `lid-2-onder-a`, `aanhef`), `kind` (`aanhef`, `lid`,
  `onderdeel`, `volzin`), `number`, `text`, `start`, `end` (offsets into the existing `text`, so
  the reference spans stay valid). Also on each `ArticleVersionDTO`.
- `props.references` (`kind`, `bwb_id`, `article`, `doc`, `text`, `start`, `end`) is only visible
  through `/api/nodes/articles/{key}`. Expose `references[]` on `ArticleDetailResponse`.
- Add `lid` and `onderdeel` to each reference and to `ArticleCitationSpan`. The qualifier parser
  exists in `core/citations.py`. The `intref`/`extref` distinction is also lost in the DTO.
- Front-end stopgaps: `parseArticleParts(text)`, `parseQualifier(spanText)`.

## B7. Judgment to article, with lid and paragraph

- `GET /api/judgments/{ecli}`: `articles[]` carries no lid or onderdeel. The stored `meta.qualifier`
  ("derde lid") is not exposed. Add `cited_articles[]`: `article`, `qualifier`, `lid`, `onderdeel`,
  `paragraph_numbers[]`, `snippet`, `confidence`.
- Paragraph citation spans are detected by regex at request time (`_enrich_paragraphs`) and their
  `start`/`end` come from the first `str.find`, so a repeated citation in one paragraph points at the
  first occurrence. Compute per occurrence, and persist the detection at ingest.
- Add a stable `paragraph_id` (for example `rov-5.3`) to `JudgmentParagraph`, for deep links.
- Add `lid` to `ArticleCitationSpan`.
- Front-end stopgap: anchors from `paragraphs[].number`, `parseQualifier`.

## B8. Article to citing paragraphs

`ArticleDetailResponse.judgments[]` is `id`, `key`, `display_name`, `ecli`: no overweging, no snippet.

- Add `GET /api/articles/{bwb_id}/{n}/cited-by` (paged): `items[]` with `judgment{ecli, court, date,
display_name}`, `paragraph_number`, `paragraph_id`, `lid`, `snippet`, `confidence`, and `total`.
  Filters: `court`, `tier`, `lid`.
- `ArticleRelationshipWithType` (citing articles): add `lid`, `start`, `end`, `text`.
- Front-end stopgap: the row shows court and date; the overweging is optional in the row.

## B9. EU and international links

- `IMPLEMENTS` is built from CELEX numbers named in a regulation's text (confidence 0.75,
  `meta.celex`); it is not a transposition relation and not per article. Say so in the DTO, or add
  a stricter `transposes` signal.
- Add `GET /api/instruments/{key}/eu-links`: `implements[]` and `implemented_by[]` as
  `instrument{id, bwb_id, celex, title, kind}`, `relation`, `confidence`, `articles[]`; and
  `international[]` (treaties, ECHR articles, ECHR judgments citing them). No route exposes edge
  `meta` for these today.
- There is no `GET /api/instruments/{key}` detail route. Instrument sub-routes (`articles`, `dossiers`,
  `judgments`, `citations`) filter on `props.bwb_id` and return nothing for a celex instrument.
  `GET /api/articles/{celex}/{n}` does work.
- Front-end stopgap: neighbours of `/api/nodes/instruments/{key}` filtered on `IMPLEMENTS`,
  low-confidence rows marked as derived.

## B10. Committee, member and faction hubs

- `GET /api/committees/{slug}/activities` (paged): `date`, `kind`, `agenda_title`, `dossier_numbers`.
- The dossier list of `GET /api/committees/{slug}` is capped at 100: add `offset` and
  `status=open|closed`.
- `GET /api/members/{key}/dossiers` and `GET /api/factions/{key}/dossiers` (through `AUTHORED`, with
  `role`). Today authorship is reachable only through `/api/nodes`.

## B11. Citation resolver

`GET /api/search` recognises a full ECLI and `art./artikel N law` only (`parse_search_query`).
`art. 6:162 BW` fails (the regex `\d+[a-z]*` drops `:162`), `Kamerstuk 36327` is only token text
against `number` or `external_id`. Nothing returns one best match with a target. Scores are a
constant 1.0.

- Add `GET /api/resolve?q=`: `kind`, `match{id, key, collection}`, `confidence`, `alternatives[]`.
  Handle `art. 6:162 BW`, `artikel 287 Sr`, `ECLI:...`, `Kamerstuk 36327` and `36327-3`, BWBR and
  CELEX ids, and law names ("Wetboek van Strafvordering").
- Extend `SearchResultItem.extra`: parent instrument title on articles, `dossier_number` on documents.
  Give `score` a real value or drop it.
- Front-end stopgap: `resolveQuery()` parses the notations itself.

## B12. Neighbour counts, filters and edge meta

`GET /api/nodes/{collection}/{key}` returns neighbours capped at 30 per relation and collection,
with no totals, no filter, and no edge `meta`, `status` or `id`. `/neighborhood` takes only `depth`
and `cap`. `/api/graph/*` has no relation or type filter. The bucketing exists in
`_collect_neighbors` (`COLLECT relation, ncol`), so counts are cheap.

- Add `GET /api/nodes/{collection}/{key}/facets`: `{relation, direction, collection, type, count}[]`.
- Add `relations=`, `node_types=`, `direction=`, `status=`, `limit`, `offset` to `/nodes/{c}/{k}` and
  `/neighborhood`, with `total` and `next_offset` per bucket.
- Include edge `id`, `status` and `meta` (`start`, `end`, `raw_match`, `qualifier`) in `NeighborDTO`.
- Allow the collections `annexes`, `article_versions`, `instrument_versions`.
- Front-end stopgap: `30+` on a capped group.

## Added during implementation

(empty)

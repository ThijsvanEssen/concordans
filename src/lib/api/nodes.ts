// API client for graph endpoints. Every response type comes from
// `$lib/api/types`, which re-exports the openapi-typescript generated schema.
// If a function here references a hand-rolled DTO, that's a signal the
// generated types are out of date — refresh with `npm run sync:api` before
// patching by hand.

import { apiGet } from './client';
import type {
  GlobalGraphResponse,
  InstrumentArticleNodeDTO,
  InstrumentArticlesResponse,
  InstrumentLayerGraphResponse,
  JudgmentLayerGraphResponse,
  NodeGraphResponse,
  NodeNeighborhoodResponse,
} from './types';

// Re-export the schema-anchored types so existing imports from this module
// keep resolving without forcing every caller to switch to './types'.
export type {
  GlobalGraphResponse,
  InstrumentArticleNodeDTO,
  InstrumentArticlesResponse,
  InstrumentLayerGraphResponse,
  JudgmentLayerGraphResponse,
  NodeGraphResponse,
  NodeNeighborhoodResponse,
} from './types';

// ── /api/nodes/{collection}/{key} ─────────────────────────────────────────
export function getNodeGraph(
  collection: string,
  key: string,
  opts?: { neighborLimit?: number }
) {
  // Backend stores keys lowercase across all collections, but the
  // /api/nodes/{collection}/{key} endpoint is case-sensitive. Normalise here so
  // callers can pass whatever the search/result payload gave them.
  return apiGet<NodeGraphResponse>(
    `/api/nodes/${encodeURIComponent(collection)}/${encodeURIComponent(key.toLowerCase())}`,
    { params: { neighbor_limit: opts?.neighborLimit } }
  );
}

// ── /api/nodes/{collection}/{key}/neighborhood ────────────────────────────
// One-shot N-hop neighborhood. Replaces a manual BFS that fired N sequential
// /api/nodes/{coll}/{key} requests with a single traversal query on the
// backend. Returns every node + edge within `depth` hops of the focal node,
// capped at `cap` discovered vertices.
export function getNodeNeighborhood(
  collection: string,
  key: string,
  opts?: { depth?: number; cap?: number }
) {
  return apiGet<NodeNeighborhoodResponse>(
    `/api/nodes/${encodeURIComponent(collection)}/${encodeURIComponent(key.toLowerCase())}/neighborhood`,
    { params: { depth: opts?.depth ?? 3, cap: opts?.cap ?? 200 } }
  );
}

// ── /api/instruments/{bwb}/articles ───────────────────────────────────────
// The only endpoint that returns a wet's full article list. The generic
// /api/nodes/instruments/{key} surface omits PART_OF_INSTRUMENT children;
// /api/graph/instruments only ships instrument hubs. Used by loadInstrument
// when drilling into a wet from the Wetten Lagen overview.
export function getInstrumentArticles(
  bwbId: string,
  opts?: { includeStubs?: boolean; textPreviewChars?: number; limit?: number; offset?: number }
) {
  return apiGet<InstrumentArticlesResponse>(
    `/api/instruments/${encodeURIComponent(bwbId)}/articles`,
    {
      params: {
        include_stubs: opts?.includeStubs,
        text_preview_chars: opts?.textPreviewChars,
        limit: opts?.limit,
        offset: opts?.offset,
      }
    }
  );
}

// ── Lezen mode: whole-law reader ──────────────────────────────────────────
// Historically backed by /api/instruments/{bwb}/reader (full leden-level
// payload with citation spans). That endpoint was removed from the backend
// and now returns 404, so this shim adapts the articles list into a
// reader-shaped response — text comes from `text_preview` only, and `leden`
// is always empty. If/when the backend restores a richer reader endpoint,
// swap the implementation; callers stay put.
export type ReaderArticle = {
  id: string;
  key: string;
  bwb_id: string | null;
  article_number: string;
  display_name: string | null;
  text: string | null;
  /** Always empty in the current backend — kept on the type so the reader
   *  template doesn't have to special-case the missing field. */
  leden: { number: string; text: string; citaties?: never[] }[];
  breadcrumb: InstrumentArticleNodeDTO['breadcrumb'];
  geldig_vanaf: string | null;
};

export type InstrumentReaderShim = {
  instrument: {
    id: string;
    key: string;
    bwb_id: string;
    display_name: string | null;
    title: string | null;
    citation_title: string | null;
    geldig_vanaf: string | null;
  };
  citation_title: string | null;
  articles: ReaderArticle[];
};

export async function getInstrumentReader(bwbId: string): Promise<InstrumentReaderShim> {
  const resp = await getInstrumentArticles(bwbId, { textPreviewChars: 600, limit: 2000 });
  return {
    instrument: {
      id: bwbId,
      key: bwbId.toLowerCase(),
      bwb_id: bwbId,
      display_name: null,
      title: null,
      citation_title: null,
      geldig_vanaf: null,
    },
    citation_title: null,
    articles: resp.items
      .filter((a) => !a.stub && a.article_number)
      .map((a) => ({
        id: a.id,
        key: a.key,
        bwb_id: a.bwb_id,
        article_number: a.article_number!,
        display_name: a.display_name,
        text: a.text_preview ?? null,
        leden: [],
        breadcrumb: a.breadcrumb,
        geldig_vanaf: null,
      })),
  };
}

// ── /api/instruments/{bwb}/citations ──────────────────────────────────────
// Bulk edges endpoint: every cross-reference incident to any article of the
// wet, plus a side-payload of foreign nodes referenced by those edges. The
// OpenAPI schema is loose (additionalProperties=true) — these types reflect
// the contract the backend documented but aren't generator-checked. When
// the schema is formalised, drop these in favour of the generated equivalent.
export type InstrumentCitationEdge = {
  from: string;
  to: string;
  relation: string;
  /** intra = both endpoints in this wet; out = wet → foreign; in = foreign → wet. */
  direction: 'intra' | 'out' | 'in';
  meta?: { start?: number | null; end?: number | null; text?: string | null } | null;
};

// Every side-payload node in /citations comes wrapped: top level has
// {id, key, collection, props}, and all the actual fields (bwb_id,
// display_name, short_title, ecli, titel, …) live inside `props`. Don't
// flatten the type — read via `a.props.<field>`. (Confirmed by probing
// the live response 2026-05-13; the backend update notes claimed a flat
// shape but actual delivery is enveloped.)
type CitationNode<P> = {
  id: string;
  key: string;
  collection?: string;
  props: P;
};

export type InstrumentCitationForeignArticle = CitationNode<{
  bwb_id: string | null;
  /** CELEX identifier when this article belongs to an EU instrument. */
  celex: string | null;
  article_number: string | null;
  display_name: string | null;
  /** Wet shorthand (e.g. "Sv", "Sr") resolved by the backend in a single
   *  pass over the instruments collection. Falls back to citation_title
   *  when no abbreviation exists; null only when the parent wet has neither. */
  short_title: string | null;
  /** True when the parent wet hasn't been fully imported (placeholder
   *  reference). */
  stub: boolean;
}>;
export type InstrumentCitationForeignJudgment = CitationNode<{
  ecli?: string | null;
  display_name: string | null;
}>;
export type InstrumentCitationForeignPublication = CitationNode<{
  soort?: string | null;
  titel?: string | null;
  title?: string | null;
  datum?: string | null;
  volgnummer?: number | string | null;
  dossier_nummer?: string | null;
  tk_url?: string | null;
  display_name?: string | null;
}>;
export type InstrumentCitationForeignDossier = CitationNode<{
  kamerstuknummer?: string | null;
  titel?: string | null;
  huidige_fase?: string | null;
  display_name?: string | null;
}>;
export type InstrumentCitationForeignInstrument = CitationNode<{
  bwb_id: string | null;
  citation_title?: string | null;
  display_name?: string | null;
}>;

export type InstrumentCitationsResponse = {
  bwb_id: string;
  article_count: number;
  total_edges: number;
  edges: InstrumentCitationEdge[];
  nodes: {
    instrument_articles?: InstrumentCitationForeignArticle[];
    judgments?: InstrumentCitationForeignJudgment[];
    publications?: InstrumentCitationForeignPublication[];
    kamerstukdossiers?: InstrumentCitationForeignDossier[];
    instruments?: InstrumentCitationForeignInstrument[];
  };
};

export function getInstrumentCitations(
  bwbId: string,
  opts?: { relations?: string[]; includePartOfInstrument?: boolean; maxEdges?: number }
) {
  return apiGet<InstrumentCitationsResponse>(
    `/api/instruments/${encodeURIComponent(bwbId)}/citations`,
    {
      params: {
        relations: opts?.relations?.join(','),
        include_part_of_instrument: opts?.includePartOfInstrument,
        max_edges: opts?.maxEdges,
      },
    }
  );
}

// ── /api/instruments/{bwb}/judgments ──────────────────────────────────────
// Per-layer endpoint: judgments that cite any article of this wet. Each item
// carries the judgment plus the cited_articles list so the FE can draw
// individual judgment → article edges without a second round-trip.
//
// cited_articles entries use the standard `id` / `key` naming — same as
// every other node DTO in the API.
export type InstrumentJudgmentItem = {
  id: string;
  key: string;
  ecli?: string | null;
  display_name: string | null;
  stub?: boolean;
  cited_articles: {
    id: string;
    key: string;
    article_number: string | null;
    display_name?: string | null;
  }[];
};

export type InstrumentJudgmentsResponse = {
  bwb_id: string;
  total: number;
  items: InstrumentJudgmentItem[];
};

export function getInstrumentJudgments(bwbId: string, opts?: { limit?: number }) {
  return apiGet<InstrumentJudgmentsResponse>(
    `/api/instruments/${encodeURIComponent(bwbId)}/judgments`,
    { params: { limit: opts?.limit } }
  );
}

// ── /api/instruments/{bwb}/dossiers ───────────────────────────────────────
// Per-layer endpoint: kamerstukdossiers that touch this wet, combining
// direct RAAKT edges and the derived publication→article path.
export type InstrumentDossierItem = {
  id: string;
  key: string;
  kamerstuknummer?: string | null;
  titel?: string | null;
  huidige_fase?: string | null;
  /** Articles of this wet that the dossier touches (direct or transitive).
   *  Aligned with the judgments endpoint shape (`{id, key, …}`) — to be
   *  verified by shape-probe once the dossiers endpoint stops returning
   *  500. */
  touched_articles: {
    id: string;
    key: string;
    article_number: string | null;
    display_name?: string | null;
  }[];
  /** Publications under this dossier that mention this wet, if surfaced. */
  publications?: { id: string; key: string; soort?: string | null; titel?: string | null }[];
};

export type InstrumentDossiersResponse = {
  bwb_id: string;
  total: number;
  items: InstrumentDossierItem[];
};

export function getInstrumentDossiers(bwbId: string, opts?: { limit?: number }) {
  return apiGet<InstrumentDossiersResponse>(
    `/api/instruments/${encodeURIComponent(bwbId)}/dossiers`,
    { params: { limit: opts?.limit } }
  );
}

// ── /api/instruments/{bwb}/related-instruments ────────────────────────────
// Per-layer endpoint: cross-wet REFERS_TO_ARTICLE aggregation. Each item is
// another wet, with counts of how many of its articles this wet cites
// (outbound_count) and how many of this wet's articles it cites
// (inbound_count). Sorted by total desc by the backend.
export type InstrumentRelatedItem = {
  id: string;
  key: string;
  bwb_id: string | null;
  citation_title?: string | null;
  display_name?: string | null;
  outbound_count: number;
  inbound_count: number;
};

export type InstrumentRelatedResponse = {
  bwb_id: string;
  total: number;
  items: InstrumentRelatedItem[];
};

export function getInstrumentRelatedInstruments(bwbId: string, opts?: { limit?: number }) {
  return apiGet<InstrumentRelatedResponse>(
    `/api/instruments/${encodeURIComponent(bwbId)}/related-instruments`,
    { params: { limit: opts?.limit } }
  );
}

// ── /api/graph/global ─────────────────────────────────────────────────────
export function getGlobalGraph() {
  return apiGet<GlobalGraphResponse>('/api/graph/global');
}

// ── /api/graph/instruments ────────────────────────────────────────────────
export function getInstrumentLayerGraph() {
  return apiGet<InstrumentLayerGraphResponse>('/api/graph/instruments');
}

// ── /api/graph/judgments ──────────────────────────────────────────────────
export function getJudgmentLayerGraph(opts?: { maxJudgments?: number; includeStubs?: boolean }) {
  return apiGet<JudgmentLayerGraphResponse>('/api/graph/judgments', {
    params: {
      max_judgments: opts?.maxJudgments,
      include_stubs: opts?.includeStubs,
    }
  });
}

import type { components } from './generated/openapi-types';

// All shared API types come from the openapi-typescript v7 components
// namespace. Re-anchoring here keeps the rest of the codebase from drifting
// out of sync with what the backend actually serves — every schema below is
// generated from the live openapi.json (refresh with `npm run sync:api`).
type Schemas = components['schemas'];

// ── Article / instrument / judgment detail ──────────────────────────────────
export type ArticleCitationSpan = Schemas['ArticleCitationSpan'];
export type ArticleSummary = Schemas['ArticleSummaryDTO'];
export type Judgment = Schemas['JudgmentDTO'];

// The backend returns fields that the last synced openapi.json omits (the
// schema is `additionalProperties: false`, so it predates them). Declared here
// until `npm run sync:api` covers them; drop the intersections afterwards.
export type ArticleCitationTarget = Schemas['ArticleCitationTarget'] & {
	instrument_citation_title?: string | null;
};
export type InstrumentSummary = Schemas['InstrumentSummaryDTO'] & {
	bwb_id?: string | null;
	shorthand?: string | null;
	citation_title?: string | null;
	title?: string | null;
};
export type JudgmentSummary = Schemas['JudgmentSummaryDTO'] & { shorthand?: string | null };
export type ArticleRelation = Omit<Schemas['ArticleRelationDTO'], 'instrument'> & {
	instrument?: InstrumentSummary | null;
};
export type ArticleDetailResponse = Omit<
	Schemas['ArticleDetailResponse'],
	'instrument' | 'judgments'
> & {
	instrument: InstrumentSummary | null;
	judgments: JudgmentSummary[];
	leden?: { number: string; text: string; citaties?: ArticleCitationSpan[] }[] | null;
	citation_formats?: Partial<
		Record<'verkort' | 'volledig' | 'vindplaats' | 'bibtex', string>
	> | null;
};
export type JudgmentDetailResponse = Omit<
	Schemas['JudgmentDetailResponse'],
	'judgment' | 'articles' | 'cited_judgments'
> & {
	judgment: Schemas['JudgmentDTO'] & {
		shorthand?: string | null;
		subjects?: string[] | null;
		text?: string | null;
		judgment_metadata?: {
			type?: string | null;
			court?: string | null;
			date?: string | null;
			case_number?: string | null;
		} | null;
	};
	articles: ArticleRelation[];
	cited_judgments: JudgmentSummary[];
};

// ── Node + neighbour graph (generic /api/nodes/{collection}/{key}) ──────────
export type BaseNode = Schemas['BaseNodeDTO'];
export type Neighbor = Schemas['NeighborDTO'];
export type NodeGraphResponse = Schemas['NodeGraphResponse'];
export type NodeNeighbors = Schemas['NodeNeighborsDTO'];
export type NodeNeighborhoodResponse = Schemas['NodeNeighborhoodResponse'];
export type NodeNeighborhoodEdge = Schemas['NodeNeighborhoodEdge'];

// ── Bulk graph layers (Lagen) ──────────────────────────────────────────────
export type GlobalGraphResponse = Schemas['GlobalGraphResponse'];
export type InstrumentLayerGraphResponse = Schemas['InstrumentLayerGraphResponse'];
export type InstrumentLayerInstrumentDTO = Schemas['InstrumentLayerInstrumentDTO'];
export type JudgmentLayerGraphResponse = Schemas['JudgmentLayerGraphResponse'];

// ── Per-instrument articles list (/api/instruments/{bwb}/articles) ──────────
export type InstrumentArticlesResponse = Schemas['InstrumentArticlesResponse'];
export type InstrumentArticleNodeDTO = Schemas['InstrumentArticleNodeDTO'];
export type InstrumentArticleBreadcrumb = Schemas['InstrumentArticleBreadcrumbDTO'];

// ── Edge / common graph types ──────────────────────────────────────────────
export type GraphEdgeDTO = Schemas['GraphEdgeDTO'];
export type InstrumentEdgeDTO = Schemas['InstrumentEdgeDTO'];
export type JudgmentGraphNodeDTO = Schemas['JudgmentGraphNodeDTO'];
export type ArticleGraphNodeDTO = Schemas['ArticleGraphNodeDTO'];

// ── Search ─────────────────────────────────────────────────────────────────
export type SearchResponse = Schemas['SearchResponse'];
export type SearchResultItem = Schemas['SearchResultItem'];
// SearchResponse is now always grouped — both flat and unified searches share the same type.
export type UnifiedSearchResponse = SearchResponse;

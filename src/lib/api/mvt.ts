import { apiGet } from './client';

export type MvtPassage = {
	publication_id: string;
	publication_key: string;
	title: string | null;
	soort: string | null;
	datum: string | null;
	external_id: string | null;
	snippet: string | null;
	confidence: number | null;
};

export type MvtContextResponse = {
	article_id: string;
	total: number;
	passages: MvtPassage[];
};

export type PublicationTextResponse = {
	key: string;
	publication_id: string;
	title: string | null;
	soort: string | null;
	datum: string | null;
	external_id: string | null;
	tk_url: string | null;
	text: string | null;
};

export function getMvtContext(bwbId: string, articleNumber: string) {
	return apiGet<MvtContextResponse>(
		`/api/articles/${encodeURIComponent(bwbId)}/${encodeURIComponent(articleNumber)}/mvt-context`
	);
}

export function getPublicationText(key: string) {
	return apiGet<PublicationTextResponse>(`/api/publications/${encodeURIComponent(key)}`);
}

export type PublicationSummary = {
	key: string;
	title: string | null;
	soort: string | null;
	datum: string | null;
	external_id: string | null;
	has_text: boolean;
	linked_articles: number;
};

export type PublicationListResponse = {
	total: number;
	items: PublicationSummary[];
};

export function listPublications(
	opts: { limit?: number; offset?: number; q?: string; soort?: string } = {}
) {
	const params: Record<string, string | number> = {};
	if (opts.limit !== undefined) params.limit = opts.limit;
	if (opts.offset !== undefined) params.offset = opts.offset;
	if (opts.q) params.q = opts.q;
	if (opts.soort) params.soort = opts.soort;
	return apiGet<PublicationListResponse>('/api/publications', { params });
}

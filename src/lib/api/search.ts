import { apiGet } from './client';
import type { SearchResponse, SearchResultItem, UnifiedSearchResponse } from './types';

export type { SearchResultItem };

export type SearchResults = {
	items: SearchResultItem[];
	query: string;
	total: number;
};

export async function searchNodes(
	query: string,
	opts: { type?: 'all' | 'articles' | 'judgments' | 'instruments'; limit?: number } = {}
): Promise<SearchResults> {
	const res = await apiGet<SearchResponse>('/api/search', {
		params: {
			q: query,
			types: opts.type ?? 'all',
			limit: opts.limit ?? 20
		}
	});
	// results is now grouped by type — flatten all groups into a single list.
	const items: SearchResultItem[] = Object.values(res.results ?? {}).flat();
	return { items, query: res.q, total: res.total };
}

export type UnifiedResults = {
	articles: SearchResultItem[];
	judgments: SearchResultItem[];
	instruments: SearchResultItem[];
	dossiers: SearchResultItem[];
	publications: SearchResultItem[];
	commissies: SearchResultItem[];
	leden: SearchResultItem[];
	fracties: SearchResultItem[];
};

/**
 * Single call to /api/search using the grouped `types=` parameter.
 * Returns results bucketed by entity type — ready for sectioned rendering.
 */
export async function unifiedSearch(
	query: string,
	opts: {
		types?: string;
		limit?: number;
		signal?: AbortSignal;
	} = {}
): Promise<UnifiedResults> {
	const empty: UnifiedResults = {
		articles: [],
		judgments: [],
		instruments: [],
		dossiers: [],
		publications: [],
		commissies: [],
		leden: [],
		fracties: []
	};
	if (!query.trim()) return empty;

	const res = await apiGet<UnifiedSearchResponse>('/api/search', {
		params: {
			q: query,
			types:
				opts.types ??
				'articles,judgments,instruments,dossiers,publications,commissies,leden,fracties',
			limit: opts.limit ?? 20
		},
		signal: opts.signal
	});

	const g = res.results ?? {};
	return {
		articles: g['articles'] ?? [],
		judgments: g['judgments'] ?? [],
		instruments: g['instruments'] ?? [],
		dossiers: g['dossiers'] ?? [],
		publications: g['publications'] ?? [],
		commissies: g['commissies'] ?? [],
		leden: g['leden'] ?? [],
		fracties: g['fracties'] ?? []
	};
}

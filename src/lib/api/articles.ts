import { apiGet } from './client';
import type { ArticleDetailResponse } from './types';

// Deduplicate concurrent fetches for the same article. Multiple components
// (ArticleReader, CitationRail, CitationCopy) mount simultaneously and all
// want the same payload — without this they'd fire three identical requests.
const inflight = new Map<string, Promise<ArticleDetailResponse>>();

export function getArticleDetail(
	bwbId: string,
	articleNumber: string,
	options?: { minConfidence?: number }
) {
	const qs = options?.minConfidence !== undefined ? `?min_confidence=${options.minConfidence}` : '';
	const cacheKey = `${bwbId}/${articleNumber}${qs}`;
	const existing = inflight.get(cacheKey);
	if (existing) return existing;
	const p = apiGet<ArticleDetailResponse>(
		`/api/articles/${encodeURIComponent(bwbId)}/${encodeURIComponent(articleNumber)}${qs}`
	).finally(() => inflight.delete(cacheKey));
	inflight.set(cacheKey, p);
	return p;
}

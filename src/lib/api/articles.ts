import { api, unwrap } from './client';

// ArticleReader, CitationRail and CitationCopy mount together and want the same article.
const inflight = new Map<string, ReturnType<typeof fetchArticle>>();

const fetchArticle = (bwbId: string, articleNumber: string) =>
	unwrap(
		api.GET('/api/articles/{bwb_id}/{article_number}', {
			params: { path: { bwb_id: bwbId, article_number: articleNumber } }
		})
	);

export function getArticleDetail(bwbId: string, articleNumber: string) {
	const id = `${bwbId}/${articleNumber}`;
	let request = inflight.get(id);
	if (!request) {
		request = fetchArticle(bwbId, articleNumber).finally(() => inflight.delete(id));
		inflight.set(id, request);
	}
	return request;
}

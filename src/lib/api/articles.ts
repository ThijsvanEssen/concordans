import { api, unwrap } from './client';
import { once } from './records';

// The reader, the panel, the list of what cites it and a hover card ask for the same
// article: it is asked once per session (`once`, the most recent records kept).
export const getArticleDetail = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } }
			})
		)
	);

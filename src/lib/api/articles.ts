import { api, unwrap } from './client';
import { once } from './records';

/** The address of an article by its node key, from every detail that came in. */
const adresVan = new Map<string, { bwbId: string; articleNumber: string }>();

// The reader, the panel, the list of what cites it and a hover card ask for the same
// article: it is asked once per session (`once`, the most recent records kept).
export const getArticleDetail = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } }
			})
		).then((d) => {
			if (d.article?.key) onthoudArtikel(d.article.key, bwbId, articleNumber);
			return d;
		})
	);

/** The tekstversies of an article, once per session: its address asks them beside its text. */
export const getArticleHistory = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}/history`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/history', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } }
			})
		)
	);

/** Keep the address of an article under its node key, as a lookup gives it. */
export const onthoudArtikel = (key: string, bwbId: string, articleNumber: string) =>
	adresVan.set(key.toLowerCase(), { bwbId, articleNumber });

/**
 * The detail of an article by its node key, where an earlier detail named that key (the
 * reader's address asks it first, $lib/bron/leesbaar.ts); null for a key not seen.
 */
export function getArticleDetailByKey(key: string) {
	const a = adresVan.get(key.toLowerCase());
	return a ? getArticleDetail(a.bwbId, a.articleNumber) : null;
}

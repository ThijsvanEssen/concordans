import { api, unwrap } from './client';
import { ifExists } from './errors';
import { once } from './records';
import { onForget } from '$lib/util/forget';

/** The address of an article by its node key, from every detail that came in. */
const adresVan = new Map<string, { bwbId: string; articleNumber: string }>();
onForget(() => adresVan.clear());

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

/**
 * The regulations issued under an article (its `Gelet op` names it), and per delegation
 * formula of its text the ones that fill it; once per article, for the formula's card and
 * the group in Verbonden. Null where the API does not have the article.
 */
export const getDelegated = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}/delegated`, () =>
		ifExists(
			unwrap(
				api.GET('/api/articles/{bwb_id}/{article_number}/delegated', {
					params: { path: { bwb_id: bwbId, article_number: articleNumber } }
				})
			)
		)
	);

/**
 * The regulations issued under a law: one per regulation whose `Gelet op` names an article of
 * it, with those articles; once per law, for its group in Verbonden and its row in a map.
 * Null where the API does not have the law.
 */
export const getLawDelegated = (bwbId: string) =>
	once(`instruments/${bwbId}/delegated`, () =>
		ifExists(
			unwrap(
				api.GET('/api/instruments/{bwb_id}/delegated', { params: { path: { bwb_id: bwbId } } })
			)
		)
	);

/**
 * The grondslag of a regulation: per law its `Gelet op` names, those articles; once per law,
 * for the head of the regulation and its group in Verbonden. Null where the API does not
 * have the law.
 */
export const getLawBasis = (bwbId: string) =>
	once(`instruments/${bwbId}/basis`, () =>
		ifExists(
			unwrap(api.GET('/api/instruments/{bwb_id}/basis', { params: { path: { bwb_id: bwbId } } }))
		)
	);

/**
 * The references between the articles of two laws, both ways (`.../references/{other}`); once
 * per pair, asked when a row of Wetten die met deze wet verbonden zijn opens.
 */
export const getLawReferences = (bwbId: string, other: string) =>
	once(`instruments/${bwbId}/references/${other}`, () =>
		unwrap(
			api.GET('/api/instruments/{bwb_id}/references/{other}', {
				params: { path: { bwb_id: bwbId, other } }
			})
		)
	);

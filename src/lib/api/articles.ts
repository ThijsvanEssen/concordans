import { api, unwrap, slowApi } from './client';
import { ifExists } from './errors';
import { abortable, once } from './records';
import type { Schema } from './types';
import { CITED_BY_TOP } from './first-pages';
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

/**
 * The versions of an article without their text, once per session: its address asks them
 * beside its text. Each says whether it changed the wording, and which parts.
 */
export const getArticleHistory = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}/history`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/history', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } }
			})
		)
	);

/**
 * One version of an article with its text (`history/{key}`), once per session: the two a
 * comparison holds, a formulation of a lid as it comes into view, an earlier text read.
 */
export const getArticleVersion = (bwbId: string, articleNumber: string, key: string) =>
	once(`articles/${bwbId}/${articleNumber}/history/${key}`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/history/{version_key}', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber, version_key: key } }
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
 * The regulations issued under a law, with the deadline of the slow lanes (the Grondwet took
 * 20 s on the live API, past the 10 s of `api`): one per regulation whose `Gelet op` names an article of
 * it, with those articles; once per law, for its group in Verbonden and its row in a map.
 * Null where the API does not have the law.
 */
export const getLawDelegated = (bwbId: string) =>
	once(`instruments/${bwbId}/delegated`, () =>
		ifExists(
			unwrap(
				slowApi.GET('/api/instruments/{bwb_id}/delegated', { params: { path: { bwb_id: bwbId } } })
			)
		).then((r) => r && { ...r, items: r.items as Schema<'InstrumentDelegatedItem'>[] })
	);

/**
 * The light form of the regulations issued under a law, for the keten: per regulation its
 * kind, date, articles and the regulations under it in turn, without what a row of Verbonden
 * reads (`detail=summary`, API 0.80.8); `all` with those no longer in force, `in_force` without.
 */
export const getLawDelegatedSummary = (bwbId: string, validity: 'in_force' | 'all' = 'in_force') =>
	once(`instruments/${bwbId}/delegated/summary/${validity}`, () =>
		ifExists(
			unwrap(
				slowApi.GET('/api/instruments/{bwb_id}/delegated', {
					params: { path: { bwb_id: bwbId }, query: { detail: 'summary', validity } }
				})
			)
		).then((r) => r && { ...r, items: r.items as Schema<'InstrumentDelegatedSummaryItem'>[] })
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

/**
 * The judgments on an article, the most cited first; one page is enough for two. A shared
 * request: a caller that leaves ignores the answer (`abortable`).
 */
export const getCitedByTop = (bwb: string, number: string, signal?: AbortSignal) =>
	abortable(
		once(`articles/${bwb}/${number}/cited-by/top`, () =>
			unwrap(
				api.GET('/api/articles/{bwb_id}/{article_number}/cited-by', {
					params: {
						path: { bwb_id: bwb, article_number: number },
						query: { limit: CITED_BY_TOP, sort: 'citation_count' }
					}
				})
			)
		),
		signal
	);

/**
 * The narrow form of an article, to read it beside something else (the Zijpaneel): its
 * heading, its text as blocks per part and its neighbours in the law; once per session.
 */
export const getArticleText = (bwbId: string, articleNumber: string) =>
	once(`articles/${bwbId}/${articleNumber}/text`, () =>
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/text', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } }
			})
		)
	);

// What the Zijpaneel says of an article besides its text: its stand and the bills that touch it,
// from the answers its page reads too. Asked when the part comes in view.
import { getArticleHistory } from '$lib/api/articles';
import { ifExists } from '$lib/api/errors';
import type { Schema } from '$lib/api/types';
import { getLegislativeHistory } from '$lib/api/verbonden';
import { wordingsOf } from '$lib/text/version-diff';
import { SORT_OF_KIND, type Kind } from '$lib/verbonden/summary';
import type { ArticleTextData } from './blocks';
import { articleRoute } from './param';

type HistoryEntry = Schema<'ArticleLegislativeHistoryResponse'>['entries'][number];

/** A wording that holds today; null of an article that no longer holds. */
const inForce = <W extends { until: string | null; lapsed?: boolean }>(wordings: W[]) => {
	const last = wordings.at(-1);
	return last && last.until === null && !last.lapsed ? last : null;
};

/** A bill as a row: its short name, its number and where it was published. */
export function billOf(e: HistoryEntry) {
	return {
		title: e.dossier_short_title ?? e.dossier_title ?? null,
		line: [e.dossier_number, e.summary].filter(Boolean).join(', '),
		id: e.document_id ?? e.dossier_id ?? null
	};
}

/** The soort as `?bronnen=` of the article's page names it. */
export const kindFilter = (id: Kind['id']) => SORT_OF_KIND[id];

/** Geldigheid: its versions, the day of its text and the official one. */
export async function articleValidity(a: ArticleTextData) {
	const route = articleRoute(a.key);
	const history = route
		? await ifExists(getArticleHistory(route.bwbId, route.articleNumber))
		: null;
	const wordings = wordingsOf(history?.versions ?? []);
	const current = inForce(wordings);
	return {
		wordings,
		since: current?.from ?? null,
		officialUrl: current?.first.official_url ?? null
	};
}

/** The bills that touch it, each as a row. */
export async function articleBills(a: ArticleTextData) {
	const route = articleRoute(a.key);
	const found = route
		? await ifExists(getLegislativeHistory(route.bwbId, route.articleNumber))
		: null;
	return (found?.entries ?? []).map(billOf);
}

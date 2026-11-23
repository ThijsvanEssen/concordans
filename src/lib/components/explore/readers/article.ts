// The text of an article and its tekstversies, asked together by one key: the status line
// ("tekst sinds …") stands with the text instead of growing over it after.
import { getArticleAmounts, getArticleDetail, getArticleHistory } from '$lib/api/articles';
import { recordArticleLaw } from '$lib/api/instrument-cache';
import { report } from '$lib/api/errors';
import type { Schema } from '$lib/api/types';
import type { LoadState } from '$lib/util/load.svelte';

type Version = Schema<'ArticleVersionListedDTO'>;

/** The key of an article, or null while the node does not name its law and number yet. */
export const articleKey = (lawId: string, articleNumber: string) =>
	lawId && articleNumber ? `${lawId}/${articleNumber}` : null;

/** Never answered: a key that is not known yet keeps the reader loading, not failed. */
const stillLoading = <T>() => new Promise<T>(() => {});

export function fetchArticle(key: string | null) {
	if (!key) return stillLoading<never>();
	const cut = key.indexOf('/');
	const [law, number] = [key.slice(0, cut), key.slice(cut + 1)];
	const versions = getArticleHistory(law, number).then(
		(r): LoadState<Version[]> => ({ status: 'ready', data: r.versions ?? [] }),
		(error): LoadState<Version[]> => {
			report('Tekstversies', error);
			return { status: 'error', error };
		}
	);
	return Promise.all([getArticleDetail(law, number), versions]).then(([detail, versionState]) => {
		// The citation panel and the citation forms read the law's names from this cache.
		recordArticleLaw(law, detail.instrument);
		return { detail, versions: versionState };
	});
}

/**
 * The numbers of an article (`law/number|day`: the version in force on that day, the current
 * one without): none where it fails, the text stands without them and the failure is reported.
 */
export async function fetchAmounts(key: string | null) {
	if (!key) return stillLoading<never>();
	const [article, day] = key.split('|');
	const cut = article.indexOf('/');
	const found = await getArticleAmounts(article.slice(0, cut), article.slice(cut + 1), day).catch(
		(e) => {
			report('Getallen', e);
			return null;
		}
	);
	return found?.amounts ?? [];
}

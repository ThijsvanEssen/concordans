// The articles of a law in order, each with its place in the law: one request per law,
// shared by the table of contents (LezenNav) and by the place line with Vorig and Volgend
// above an article, in Netwerk as in Tekst. The whole Awb is 584 articles, 16 kB gzipped
// (about 0.1 s on PostgreSQL); a route per division (BE-6) would make it smaller.
import { naamVan } from '$lib/bron/menselijk';
import { api, unwrap } from './client';
import type { Schema } from './types';
import { articleName } from '$lib/text/bw';
import { layersOf, type Division } from '$lib/text/division';
import { onForget } from '$lib/util/forget';

export type LawArticle = {
	/** The number, or the address of an article without one (`stam_16464063`). */
	articleNumber: string;
	/** "Artikel 1", or the heading of an article without a number. */
	label: string;
	key: string;
	breadcrumb: Schema<'InstrumentArticleBreadcrumbDTO'>[];
};

/** An article with the layers of its place (book, title), as the reader shows them. */
export type LawNavItem = { key: string; label: string; breadcrumb: Division[] };

/** The largest page the API gives: the whole list of a law in one request. */
const WHOLE_LIST = 2000;

const lists = new Map<string, Promise<Schema<'InstrumentArticlesResponse'>>>();
onForget(() => lists.clear());

/**
 * The list of a law as the API gives it, asked once per law: the table of contents, the
 * place line, the group in Verbonden and the whole-law reader share it. A failed request is
 * asked again next time.
 */
export function lawArticleList(bwb: string): Promise<Schema<'InstrumentArticlesResponse'>> {
	let request = lists.get(bwb);
	if (!request) {
		request = unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: { path: { bwb_id: bwb }, query: { text_preview_chars: 0, limit: WHOLE_LIST } }
			})
		);
		request.catch(() => lists.delete(bwb));
		lists.set(bwb, request);
	}
	return request;
}

/** The articles of the law `bwb`, from its list. */
export const lawArticles = (bwb: string): Promise<LawArticle[]> =>
	lawArticleList(bwb).then((resp) =>
		resp.items
			// An article without a number (the Algemene bepaling) is listed by its heading.
			.filter((a) => !a.stub && (a.article_number || a.label))
			.map((a) => ({
				articleNumber: a.article_number ?? a.address ?? a.key,
				// A BW article by its book number (6:162), as the title and the citation have it.
				label: articleName(bwb, a.article_number, a.label) ?? naamVan('articles', a),
				key: a.key,
				breadcrumb: a.breadcrumb ?? []
			}))
	);

/**
 * The articles with their place as layers. A layer that is the law itself (Boek 6 of BW
 * Boek 6) is no place; the name of the law may come after the articles, so this follows it.
 */
export const lawNav = (articles: LawArticle[], lawName: string | null): LawNavItem[] =>
	articles.map((a) => ({
		key: a.key,
		label: a.label,
		breadcrumb: layersOf(a.breadcrumb, lawName)
	}));

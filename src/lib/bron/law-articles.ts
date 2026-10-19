// The articles of a law as the table of contents and the place line show them: a label each
// (`Artikel 1`, a BW article by its book number) and its place as layers, from the list the
// API gives once per law ($lib/api/law-articles).
import { naamVan } from './menselijk';
import { lawArticleList } from '$lib/api/law-articles';
import type { Schema } from '$lib/api/types';
import { articleName } from '$lib/text/bw';
import { layersOf, type Division } from '$lib/text/division';
import type { Crumb } from '$lib/text/references';

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

/** Every division of the law `bwb` once, with its anchor in the whole law. */
export const lawDivisions = (bwb: string): Promise<Crumb[]> =>
	lawArticleList(bwb).then((resp) => [
		...new Map(
			resp.items.flatMap((a) => a.breadcrumb ?? []).map((c) => [c.anchor, c] as const)
		).values()
	]);

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

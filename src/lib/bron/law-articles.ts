// The articles of a law as the table of contents and the place line show them: a label each
// (`Artikel 1`, a BW article by its book number) and its place as layers, from the list the
// API gives once per law ($lib/api/law-articles).
import { naamVan } from './menselijk';
import { remember } from './address';
import { nodeId } from '$lib/vocabulary';
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
export type LawNavItem = {
	key: string;
	label: string;
	/** As its address has it (LawArticle.articleNumber). */
	articleNumber: string;
	breadcrumb: Division[];
};

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

/** A bijlage of a law with a text of its own, as the table of contents lists it. */
export type LawAnnex = {
	key: string;
	/** As its heading prints it: `Bijlage 1`, `Lijst I`. */
	name: string;
	title: string | null;
};

/**
 * The bijlagen of the law `bwb` with a text of their own, in its order, each address kept
 * for its link. A bijlage of articles only has no text (`text_preview` null): its articles
 * stand in the list already, under it.
 */
export const lawAnnexes = (bwb: string): Promise<LawAnnex[]> =>
	lawArticleList(bwb).then((resp) =>
		(resp.annexes ?? [])
			.filter((a) => a.text_preview !== null)
			.map((a) => {
				if (a.path) remember(a.path, nodeId('annexes', a.key));
				return {
					key: a.key,
					name: a.display_name ?? (a.label ? `Bijlage ${a.label}` : 'Bijlage'),
					title: a.title
				};
			})
	);

/** Whether the bijlage `key` of the law `bwb` has a text of its own: one of its list with a
 *  preview (lawAnnexes). The list is the one the contents ask, once per law. */
export const annexHasText = (bwb: string, key: string): Promise<boolean> =>
	lawArticleList(bwb).then((resp) =>
		(resp.annexes ?? []).some((a) => a.key === key && a.text_preview !== null)
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
		articleNumber: a.articleNumber,
		breadcrumb: layersOf(a.breadcrumb, lawName)
	}));

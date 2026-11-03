// The table of contents of a law as a tree, and what is left of it under a word from the field
// in the column (LezenNav). It searches the names in the contents, not the text of the law.
import type { LawArticle } from '$lib/bron/law-articles';
import { capitalize } from '$lib/text/words';

export type TocGroup = {
	/** Its anchor in the whole law: `deel-hoofdstuk-3`. */
	id: string;
	label: string;
	title: string | null;
	type: string;
	items: LawArticle[];
	children: TocGroup[];
};

export const tocLabel = (g: TocGroup) => {
	const label = g.label.trim() || (g.type && g.type !== 'sectie' ? capitalize(g.type) : '');
	return g.title ? `${label} ${g.title}` : label;
};

const normal = (s: string) => s.toLocaleLowerCase('nl').trim();

/** Whether a name holds what is typed. */
export const inToc = (name: string, query: string) => normal(name).includes(normal(query));

/** The articles of a list that hold it, by their label (`Artikel 7:1`) or number. */
export const narrowItems = (items: LawArticle[], query: string) =>
	items.filter((it) => inToc(it.label, query) || inToc(it.articleNumber, query));

/**
 * The tree under a word: a division that holds it stays whole, another only with the articles
 * and divisions in it that do; a division with nothing left goes.
 */
export const narrowGroups = (groups: TocGroup[], query: string): TocGroup[] =>
	groups.flatMap((g) => {
		if (inToc(tocLabel(g), query)) return [g];
		const items = narrowItems(g.items, query);
		const children = narrowGroups(g.children, query);
		return items.length || children.length ? [{ ...g, items, children }] : [];
	});

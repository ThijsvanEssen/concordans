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

export const groupLabel = (g: TocGroup) => {
	const label = g.label.trim() || (g.type && g.type !== 'sectie' ? capitalize(g.type) : '');
	return g.title ? `${label} ${g.title}` : label;
};

const normal = (s: string) => s.toLocaleLowerCase('nl').trim();

/** Whether a name holds what is typed. */
export const matchesToc = (name: string, query: string) => normal(name).includes(normal(query));

/** The articles of a list that hold it, by their label (`Artikel 7:1`) or number. */
export const filterItems = (items: LawArticle[], query: string) =>
	items.filter((it) => matchesToc(it.label, query) || matchesToc(it.articleNumber, query));

/**
 * The tree under a word: a division that holds it stays whole, another only with the articles
 * and divisions in it that do; a division with nothing left goes.
 */
export const filterGroups = (groups: TocGroup[], query: string): TocGroup[] =>
	groups.flatMap((g) => {
		if (matchesToc(groupLabel(g), query)) return [g];
		const items = filterItems(g.items, query);
		const children = filterGroups(g.children, query);
		return items.length || children.length ? [{ ...g, items, children }] : [];
	});

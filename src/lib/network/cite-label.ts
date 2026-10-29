// The label on a line of the keten: the articles a regulation rests on, with the abbreviation
// of their law behind them (`art. 19, 23 lid 1, 28 Cbb`). Past 27 characters the line names the
// first and how many more (`art. 3, 16, 17, 21, 24 +6`), never a count alone: "4 art." read as
// article 4 (Thijs, 29 Oct). The glance on hover gives them all. One place: the drawing, the
// list on a phone and the glance read it here.
import { basisArticles, grondslagArtikelen, type BasisArticle } from '$lib/text/delegaties';
import { NL } from '$lib/text/collator';

type Deel = Parameters<typeof grondslagArtikelen>[0][number];

/** The articles of one law a regulation is issued under or names. */
export type ArticleCite = {
	/** All of them: `art. 19, 23 lid 1, 28 Cbb`. */
	full: string;
	count: number;
	/** The abbreviation of the law, else its short title; never filled in by hand. */
	abbr: string;
	/** Each article it names, with the article it opens and the lid it names: the label is a link. */
	articles: BasisArticle[];
};

/** The longest label a line carries in full. */
const CITE_MAX = 27;

export function citeOf(articles: readonly Deel[], abbr: string): ArticleCite | null {
	const sorted = [...articles].sort((a, b) =>
		NL.compare(a.article_number ?? '', b.article_number ?? '')
	);
	const line = grondslagArtikelen(sorted);
	return line
		? { full: `${line} ${abbr}`, count: articles.length, abbr, articles: basisArticles(sorted) }
		: null;
}

/** What stands on the line: all of them, else as many as fit and `+N` for the rest. */
export function citeText(c: ArticleCite): string {
	const labels = c.articles.map((a) => a.label);
	if (c.full.length <= CITE_MAX || labels.length < 2) return c.full;
	for (let n = labels.length - 1; n > 1; n--) {
		const text = `art. ${labels.slice(0, n).join(', ')} +${labels.length - n}`;
		if (text.length <= CITE_MAX) return text;
	}
	return `art. ${labels[0]} +${labels.length - 1}`;
}

/** The glance of a label: every article it names on a line of its own (`art. 23 lid 1 Cbb`). */
export const citeLines = (c: ArticleCite): string[] =>
	c.articles.map((a) => ['art.', a.label, c.abbr].join(' '));

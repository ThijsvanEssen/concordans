// The label on a line of the keten: the articles a regulation rests on, with the abbreviation
// of their law behind them (`art. 19, 23 lid 1, 28 Cbb`). Past 27 characters the line says how
// many (`11 art. Cbw`) and the glance on hover gives them all. One place: the drawing, the list
// on a phone and the glance read it here.
import { grondslagArtikelen } from '$lib/text/delegaties';
import { formatCount } from '$lib/text/getal';
import { NL } from '$lib/text/collator';

type Deel = Parameters<typeof grondslagArtikelen>[0][number];

/** The articles of one law a regulation is issued under or names. */
export type ArticleCite = {
	/** All of them: `art. 19, 23 lid 1, 28 Cbb`. */
	full: string;
	count: number;
	/** The abbreviation of the law, else its short title; never filled in by hand. */
	abbr: string;
};

/** The longest label a line carries in full. */
const CITE_MAX = 27;

export function citeOf(articles: readonly Deel[], abbr: string): ArticleCite | null {
	const sorted = [...articles].sort((a, b) =>
		NL.compare(a.article_number ?? '', b.article_number ?? '')
	);
	const line = grondslagArtikelen(sorted);
	return line ? { full: `${line} ${abbr}`, count: articles.length, abbr } : null;
}

/** What stands on the line. */
export const citeText = (c: ArticleCite): string =>
	c.full.length <= CITE_MAX ? c.full : `${formatCount(c.count)} art. ${c.abbr}`;

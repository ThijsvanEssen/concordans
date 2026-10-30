// The label on a line of the keten: the articles a regulation rests on, with the abbreviation
// of their law behind them (`art. 19, 23 lid 1, 28 Cbb`). Past 27 characters the line names the
// first and how many more, its law still behind them (`art. 3, 16, 17 +6 Cbw`), never a count
// alone: "4 art." read as article 4 (Thijs, 29 Oct). A law without an abbreviation is cut to the
// room left (`art. 1 Besluit loonbegrip…`, B48). The glance on hover gives them all. One place:
// the drawing, the list on a phone and the glance read it here.
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
/** The least of a law's name a label keeps, cut or not. */
const ABBR_MIN = 10;

/** Text cut to `room` characters with an ellipsis, at a word where one is near. */
const cut = (s: string, room: number) => {
	if (s.length <= room) return s;
	const head = s.slice(0, room - 1);
	const space = head.lastIndexOf(' ');
	return `${(space > room / 2 ? head.slice(0, space) : head).trimEnd()}…`;
};

export function citeOf(articles: readonly Deel[], abbr: string): ArticleCite | null {
	const sorted = [...articles].sort((a, b) =>
		NL.compare(a.article_number ?? '', b.article_number ?? '')
	);
	const line = grondslagArtikelen(sorted);
	return line
		? { full: `${line} ${abbr}`, count: articles.length, abbr, articles: basisArticles(sorted) }
		: null;
}

/**
 * What stands on the line, never past CITE_MAX: as many articles as fit, `+N` for the rest and
 * the law, its name cut where long; the first article cut where even it alone does not fit.
 */
export function citeText(c: ArticleCite): string {
	const labels = c.articles.map((a) => a.label);
	if (c.full.length <= CITE_MAX || !labels.length) return c.full;
	const more = (n: number) => (n < labels.length ? ` +${labels.length - n}` : '');
	for (let n = labels.length; n >= 1; n--) {
		const text = `art. ${labels.slice(0, n).join(', ')}${more(n)}`;
		const room = CITE_MAX - text.length - 1;
		if (room >= Math.min(c.abbr.length, ABBR_MIN)) return `${text} ${cut(c.abbr, room)}`;
	}
	const name = cut(c.abbr, ABBR_MIN);
	return `${cut(`art. ${labels[0]}`, CITE_MAX - more(1).length - name.length - 1)}${more(1)} ${name}`;
}

/** The glance of a label: every article it names on a line of its own (`art. 23 lid 1 Cbb`). */
export const citeLines = (c: ArticleCite): string[] =>
	c.articles.map((a) => ['art.', a.label, c.abbr].join(' '));

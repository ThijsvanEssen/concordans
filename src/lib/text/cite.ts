// The three forms in which an article, a lid or an onderdeel is cited.
// TODO(backend): the API gives no citation formats per article; the short and long
// forms are built from the instrument's `short_title` and `citation_title`, the lid
// and the onderdeel appended here.

const ORDINAL_WORDS = [
	'eerste',
	'tweede',
	'derde',
	'vierde',
	'vijfde',
	'zesde',
	'zevende',
	'achtste',
	'negende',
	'tiende',
	'elfde',
	'twaalfde',
	'dertiende',
	'veertiende',
	'vijftiende',
	'zestiende',
	'zeventiende',
	'achttiende',
	'negentiende',
	'twintigste'
];

/** `2` is `tweede`; a lid beyond twenty, or `2a`, keeps its number: `lid 2a`. */
export const ordinalWord = (lid: string): string | null => {
	const n = /^\d+$/.test(lid) ? Number(lid) : NaN;
	return n >= 1 && n <= ORDINAL_WORDS.length ? ORDINAL_WORDS[n - 1] : null;
};

export type Citation = {
	articleNumber: string;
	/** `Sr`; null when the law has no short title. */
	shortTitle: string | null;
	/** `Wetboek van Strafrecht` */
	citationTitle: string;
	lid?: string | null;
	/** The onderdelen from the outside in: `['d', 'i']` is onderdeel d, onder i. */
	onderdelen?: string[];
	/** The aanhef of the lid, or of the article when there is no lid. */
	aanhef?: boolean;
	/** The date the citation is dated on. */
	date?: Date;
};

export type CitationForms = { kort: string; voluit: string; metDatum: string };

const longDate = (d: Date) =>
	d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

/** A book of the Burgerlijk Wetboek is cited as the code with the book before the article: `art. 7:3 BW`. */
function bookOf(c: Citation): { articleNumber: string; citationTitle: string } {
	const book = /^Burgerlijk Wetboek Boek (\d+)$/i.exec(c.citationTitle)?.[1];
	if (!book) return c;
	const articleNumber = c.articleNumber.includes(':')
		? c.articleNumber
		: `${book}:${c.articleNumber}`;
	return { articleNumber, citationTitle: 'Burgerlijk Wetboek' };
}

/**
 * `art. 5 lid 1 onder d sub i Sr`, `artikel 5, eerste lid, onderdeel d, onder i, Wetboek
 * van Strafrecht` (Aanwijzingen voor de regelgeving), and the dated short form.
 */
export function citeArticle(c: Citation): CitationForms {
	const { articleNumber, citationTitle } = bookOf(c);
	const law = c.shortTitle ?? citationTitle;
	const onderdelen = c.onderdelen ?? [];

	const kort = [
		`art. ${articleNumber}`,
		c.lid ? `lid ${c.lid}` : null,
		c.aanhef ? 'aanhef' : null,
		...onderdelen.map((o, i) => (i === 0 ? `onder ${o}` : `sub ${o}`)),
		law
	]
		.filter(Boolean)
		.join(' ');

	const ordinal = c.lid ? ordinalWord(c.lid) : null;
	const voluit = [
		`artikel ${articleNumber}`,
		c.lid ? (ordinal ? `${ordinal} lid` : `lid ${c.lid}`) : null,
		c.aanhef ? 'aanhef' : null,
		...onderdelen.map((o, i) => (i === 0 ? `onderdeel ${o}` : `onder ${o}`)),
		citationTitle
	]
		.filter(Boolean)
		.join(', ');

	const dated = `${kort.charAt(0).toUpperCase()}${kort.slice(1)} (geldend op ${longDate(c.date ?? new Date())})`;
	return { kort, voluit, metDatum: dated };
}

/** The lid, onderdelen and aanhef an anchor names: `lid-1-onder-d-onder-i`, `lid-3-aanhef`. */
export function partOfAnchor(anchor: string | null): {
	lid: string | null;
	onderdelen: string[];
	aanhef: boolean;
} {
	if (!anchor) return { lid: null, onderdelen: [], aanhef: false };
	const lid = /^lid-([^-]+)/.exec(anchor)?.[1] ?? null;
	const onderdelen = [...anchor.matchAll(/onder-([^-]+)/g)].map((m) => m[1]);
	return { lid, onderdelen, aanhef: /(^|-)aanhef$/.test(anchor) };
}

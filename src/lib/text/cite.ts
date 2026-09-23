// The four forms in which an article, a lid or an onderdeel is cited.
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
	onderdeel?: string | null;
	/** The date the citation is dated on. */
	date?: Date;
};

export type CitationForms = { kort: string; voluit: string; metDatum: string };

const longDate = (d: Date) =>
	d.toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

/** `art. 300 lid 2 Sr`, `artikel 300, tweede lid, Wetboek van Strafrecht`, and the dated form. */
export function citeArticle(c: Citation): CitationForms {
	const law = c.shortTitle ?? c.citationTitle;
	const onder = c.onderdeel ? `onder ${c.onderdeel}` : null;
	const kort = c.lid
		? onder
			? `art. ${c.articleNumber} lid ${c.lid}, ${onder}, ${law}`
			: `art. ${c.articleNumber} lid ${c.lid} ${law}`
		: onder
			? `art. ${c.articleNumber}, ${onder}, ${law}`
			: `art. ${c.articleNumber} ${law}`;
	const ordinal = c.lid ? ordinalWord(c.lid) : null;
	const lidWords = c.lid ? (ordinal ? `${ordinal} lid` : `lid ${c.lid}`) : null;
	const voluit = [`artikel ${c.articleNumber}`, lidWords, onder, c.citationTitle]
		.filter(Boolean)
		.join(', ');
	const dated = `${kort.charAt(0).toUpperCase()}${kort.slice(1)} (geldend op ${longDate(c.date ?? new Date())})`;
	return { kort, voluit, metDatum: dated };
}

/** The lid and onderdeel an anchor names: `lid-2-onder-a`. */
export function partOfAnchor(anchor: string | null): {
	lid: string | null;
	onderdeel: string | null;
} {
	if (!anchor) return { lid: null, onderdeel: null };
	const lid = /^lid-([^-]+)/.exec(anchor)?.[1] ?? null;
	const onderdeel = /onder-([^-]+)$/.exec(anchor)?.[1] ?? null;
	return { lid, onderdeel };
}

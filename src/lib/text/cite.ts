import { langeDatum, vandaag } from './datum';
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
	/** The heading of an article without a number ("Algemene bepaling"), cited in its place. */
	heading?: string | null;
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

/** What an article is cited by, before the place in it: ArticleText's `citation`. */
export type ArticleCitation = Omit<Citation, 'lid' | 'onderdelen' | 'aanhef' | 'date'>;

/**
 * What the reader cites an article by, from its detail and its law's names: the name the
 * article gives its law (an EU act's citation title), else the law's names as known, else the
 * name its detail carries. The reader and a map's item (MapInhoud) cite it alike.
 */
export function articleCitation(
	article: { article_number?: string | null; address?: string | null; label?: string | null },
	law: {
		own?: string | null;
		meta?: { citationTitle: string | null; title: string | null; shortTitle: string | null } | null;
		displayName?: string | null;
	}
): ArticleCitation | null {
	const address = article.article_number ?? article.address;
	if (!address) return null;
	const title = law.own ?? law.meta?.citationTitle ?? law.meta?.title ?? law.displayName ?? null;
	if (!title) return null;
	return {
		articleNumber: address,
		// An article without a number is cited by its heading: "Algemene bepaling Gw".
		heading: article.article_number ? null : (article.label ?? null),
		shortTitle: law.meta?.shortTitle ?? null,
		citationTitle: title
	};
}

const longDate = (d: Date) => langeDatum(vandaag(d));

/** A book of the Burgerlijk Wetboek is cited as the code with the book before the article: `art. 7:3 BW`. */
function bookOf(c: Citation): Pick<Citation, 'articleNumber' | 'citationTitle' | 'shortTitle'> {
	const book = /^Burgerlijk Wetboek Boek (\d+)$/i.exec(c.citationTitle)?.[1];
	if (!book) return c;
	const articleNumber = c.articleNumber.includes(':')
		? c.articleNumber
		: `${book}:${c.articleNumber}`;
	// The book is in the number, so the code is cited as a whole: `BW`, never `BW6`.
	return { articleNumber, citationTitle: 'Burgerlijk Wetboek', shortTitle: 'BW' };
}

/** The name of a law with its article: `het Wetboek van Strafrecht`, `de Algemene wet
 * bestuursrecht`; an EU act or a treaty title keeps its own form (`Richtlijn 2013/36/EU`). */
function lawWithArticle(title: string): string {
	if (/^(Richtlijn|Verordening|Uitvoeringsverordening|Gedelegeerde)\b/i.test(title)) return title;
	if (/^(Burgerlijk Wetboek|Wetboek|Verdrag|Reglement|Statuut|Besluit)\b/i.test(title))
		return `het ${title}`;
	return `de ${title}`;
}

/**
 * `art. 5 lid 1 onder d sub i Sr`, `artikel 5, eerste lid, onderdeel d, onder i, Wetboek
 * van Strafrecht` (Aanwijzingen voor de regelgeving), and the dated short form.
 */
export function citeArticle(c: Citation): CitationForms {
	const { articleNumber, citationTitle, shortTitle } = bookOf(c);
	const law = shortTitle ?? citationTitle;
	const onderdelen = c.onderdelen ?? [];

	const kort = [
		c.heading ?? `art. ${articleNumber}`,
		c.lid ? `lid ${c.lid}` : null,
		c.aanhef ? 'aanhef' : null,
		...onderdelen.map((o, i) => (i === 0 ? `onder ${o}` : `sub ${o}`)),
		law
	]
		.filter(Boolean)
		.join(' ');

	const ordinal = c.lid ? ordinalWord(c.lid) : null;
	const parts = [
		c.heading ?? `artikel ${articleNumber}`,
		c.lid ? (ordinal ? `${ordinal} lid` : `lid ${c.lid}`) : null,
		c.aanhef ? 'aanhef' : null,
		...onderdelen.map((o, i) => (i === 0 ? `onderdeel ${o}` : `onder ${o}`))
	].filter(Boolean);
	// Aanwijzing 3.29: "artikel 5, eerste lid, onderdeel d, van de Wet …"; with the article
	// alone, "artikel 5 van de Wet …".
	const of = `van ${lawWithArticle(citationTitle)}`;
	const voluit = parts.length > 1 ? `${parts.join(', ')}, ${of}` : `${parts[0]} ${of}`;

	// Lower case like the short form: a citation is pasted into a sentence.
	const dated = `${kort} (tekst geldend op ${longDate(c.date ?? new Date())})`;
	return { kort, voluit, metDatum: dated };
}

/** The lid, onderdelen and aanhef an anchor names: `lid-1-onder-d-onder-i`, `lid-3-aanhef`. */
export function partOfAnchor(anchor: string | null): {
	lid: string | null;
	onderdelen: string[];
	aanhef: boolean;
} {
	if (!anchor) return { lid: null, onderdelen: [], aanhef: false };
	// An anchor tells two parts of the same number apart (`onder-q_2`, the second onderdeel q
	// of Wft 1:1); the citation names them as the law prints them: `onder q`.
	const gedrukt = (x: string) => x.replace(/_\d+$/, '');
	const lid = /^lid-([^-]+)/.exec(anchor)?.[1] ?? null;
	const onderdelen = [...anchor.matchAll(/onder-([^-]+)/g)].map((m) => gedrukt(m[1]));
	// A dash has no number to cite it by (`onder-_39`, Cbw 1): from there the article is cited.
	if (onderdelen.some((o) => !o)) return { lid: null, onderdelen: [], aanhef: false };
	return {
		lid: lid === null ? null : gedrukt(lid),
		onderdelen,
		aanhef: /(^|-)aanhef$/.test(anchor)
	};
}

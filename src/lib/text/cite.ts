import { parentAnchor, parseAnchor, printedOnderdeel } from './anchor';
import { articleRef, bookNumber, bwCode, isNamedNumber } from './bw';
import { langeDatum, vandaag } from './datum';
import { ordinalWord } from './getal';
// The three forms in which an article, a lid or an onderdeel is cited.
// TODO(backend): the API gives no citation formats per article; the short and long
// forms are built from the instrument's `short_title` and `citation_title`, the lid
// and the onderdeel appended here.

export type Citation = {
	/** The law's BWB id: an article of a book of the Burgerlijk Wetboek is cited with its book. */
	bwbId?: string | null;
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
	/** The term of an unmarked definition the place is (or stands in), which names it:
	 *  `art. 1, definitie van 'netwerk- en informatiesysteem', onder a Cbw`. */
	definitie?: string | null;
	/** The date the citation is dated on. */
	date?: Date;
	/** An act of the EU, whose text is as adopted (no later changes): dated on the day it was
	 *  adopted (`on`, ISO), never as in force; without that day, no dated form. */
	adopted?: { on: string | null } | null;
};

type CitationForms = { short: string; full: string; dated: string | null };

/** What an article is cited by, before the place in it: ArticleText's `citation`. */
export type ArticleCitation = Omit<
	Citation,
	'lid' | 'onderdelen' | 'aanhef' | 'definitie' | 'date'
>;

/**
 * What the reader cites an article by, from its detail and its law's names: the name the
 * article gives its law (an EU act's citation title), else the law's names as known, else the
 * name its detail carries. The reader and a map's item (MapInhoud) cite it alike.
 */
export function articleCitation(
	article: {
		bwb_id?: string | null;
		article_number?: string | null;
		address?: string | null;
		label?: string | null;
	},
	law: {
		own?: string | null;
		meta?: { citationTitle: string | null; title: string | null; shortTitle: string | null } | null;
		displayName?: string | null;
		/** Of an act of the EU: its text as adopted, on that day where known. */
		adopted?: { on: string | null } | null;
	}
): ArticleCitation | null {
	const address = article.article_number ?? article.address;
	if (!address) return null;
	const title = law.own ?? law.meta?.citationTitle ?? law.meta?.title ?? law.displayName ?? null;
	if (!title) return null;
	return {
		bwbId: article.bwb_id ?? null,
		articleNumber: address,
		// An article without a number is cited by its heading: "Algemene bepaling Gw"; the sole
		// article of a law (`enig-artikel`) by its label: "Enig artikel".
		heading:
			article.article_number && !isNamedNumber(article.article_number)
				? null
				: (article.label ?? null),
		shortTitle: law.meta?.shortTitle ?? null,
		citationTitle: title,
		...(law.adopted ? { adopted: law.adopted } : {})
	};
}

/** A book of the Burgerlijk Wetboek is cited as the code with the book before the article: `art. 7:3 BW`. */
function bookOf(c: Citation): Pick<Citation, 'articleNumber' | 'citationTitle' | 'shortTitle'> {
	const code = bwCode(c.bwbId);
	if (!code) return c;
	// The book is in the number, so the code is cited as a whole: `BW`, never `BW6`.
	return {
		articleNumber: bookNumber(c.bwbId, c.articleNumber),
		citationTitle: 'Burgerlijk Wetboek',
		shortTitle: code
	};
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

	const head = [c.heading ?? articleRef(null, articleNumber), c.lid ? `lid ${c.lid}` : null];
	const rest = [
		c.aanhef ? 'aanhef' : null,
		...onderdelen.map((o, i) => (i === 0 ? `onder ${o}` : `sub ${o}`))
	];
	const words = (xs: (string | null)[]) => xs.filter(Boolean).join(' ');
	// A definition without a letter is named by its term, set off by commas: `art. 1,
	// definitie van 'netwerk- en informatiesysteem', onder a Cbw`.
	const short = c.definitie
		? `${[words(head), `definitie van '${c.definitie}'`, words(rest)].filter(Boolean).join(', ')} ${law}`
		: words([...head, ...rest, law]);

	const ordinal = c.lid ? ordinalWord(c.lid) : null;
	const parts = [
		c.heading ?? articleRef(null, articleNumber, { form: 'artikel' }),
		c.lid ? (ordinal ? `${ordinal} lid` : `lid ${c.lid}`) : null,
		c.definitie ? `definitie van '${c.definitie}'` : null,
		c.aanhef ? 'aanhef' : null,
		...onderdelen.map((o, i) => (i === 0 ? `onderdeel ${o}` : `onder ${o}`))
	].filter(Boolean);
	// Aanwijzing 3.29: "artikel 5, eerste lid, onderdeel d, van de Wet …"; with the article
	// alone, "artikel 5 van de Wet …".
	const of = `van ${lawWithArticle(citationTitle)}`;
	const full = parts.length > 1 ? `${parts.join(', ')}, ${of}` : `${parts[0]} ${of}`;

	// Lower case like the short form: a citation is pasted into a sentence. The text of an act
	// of the EU is as adopted (the source has no later versions): dated on that day, or not.
	const dated = c.adopted
		? c.adopted.on
			? `${short} (tekst zoals vastgesteld op ${langeDatum(c.adopted.on)})`
			: null
		: `${short} (tekst geldend op ${langeDatum(vandaag(c.date ?? new Date()))})`;
	return { short, full, dated };
}

type PartPlace = { lid: string | null; onderdelen: string[]; aanhef: boolean };

const NO_PART: PartPlace = { lid: null, onderdelen: [], aanhef: false };

/**
 * The lid, onderdelen and aanhef an anchor names, as the law prints them: `onder-q_2` (the
 * second onderdeel q of Wft 1:1) is `onder q`. A dash (`onder-_39`) has no number: it is
 * skipped where a definition names it, else the article is cited from there.
 */
function readPart(anchor: string, dashes: 'skip' | 'cite-article'): PartPlace | null {
	const a = parseAnchor(anchor);
	if (a?.kind !== 'part') return null;
	const onderdelen = a.onderdelen.map(printedOnderdeel);
	if (dashes === 'cite-article' && onderdelen.some((o) => !o)) return NO_PART;
	return {
		lid: a.lid === null ? null : printedOnderdeel(a.lid),
		onderdelen: onderdelen.filter(Boolean),
		aanhef: a.aanhef
	};
}

/** The lid, onderdelen and aanhef an anchor names: `lid-1-onder-d-onder-i`, `lid-3-aanhef`. */
export const partOfAnchor = (anchor: string | null): PartPlace =>
	(anchor ? readPart(anchor, 'cite-article') : null) ?? NO_PART;

/**
 * The place an anchor names, read with the article's parts: where the place is, or stands in,
 * an unmarked definition (a part with a `term`: a dash item, a definition paragraph), that
 * definition names it and the onderdelen below it follow: `onder-_39-onder-a` is
 * `definitie van 'netwerk- en informatiesysteem', onder a`. Without a term (an API that gives
 * none) the anchor alone, as `partOfAnchor` reads it.
 */
export function placeCitation(
	anchor: string | null,
	parts: Iterable<{ id: string | null; term?: string | null }>
): Pick<Citation, 'lid' | 'onderdelen' | 'aanhef' | 'definitie'> {
	if (!anchor) return { ...NO_PART, definitie: null };
	const terms = new Map<string, string>();
	for (const p of parts) if (p.id && p.term) terms.set(p.id, p.term);
	// The nearest of the place and the parts around it that defines a term: `lid-2-onder-a`
	// stands in `lid-2`, `tekst-6-onder-a` in `tekst-6`.
	let at: string | null = anchor;
	while (at !== null && !terms.has(at)) at = parentAnchor(at);
	if (at === null) return { ...partOfAnchor(anchor), definitie: null };
	// The definition itself (`onder-_39`, `tekst-6`) has no number to cite it by: its term
	// names it, and only the onderdelen with a number are cited.
	return { ...(readPart(anchor, 'skip') ?? NO_PART), definitie: terms.get(at)! };
}

const SERIES: Record<string, string> = { stb: 'Stb.', stcrt: 'Stcrt.', trb: 'Trb.' };

/**
 * `Stb. 2026, 204`, as a publication is cited: the series as the feed codes it (`stb`) or as
 * a version records it (`Stb`). Null without a series, year and number.
 */
export function citePublication(
	series: string | null | undefined,
	year: number | null | undefined,
	number: string | null | undefined
): string | null {
	if (!series || !year || !number) return null;
	return `${SERIES[series.toLowerCase()] ?? `${series}.`} ${year}, ${number}`;
}

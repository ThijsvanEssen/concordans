// One citation record per bron (besluit 33, E6): the name its heading gives it, its place as a
// lawyer cites it (Leidraad voor juridische auteurs: `art. 6:162 BW`, `Kamerstukken II 2023/24,
// 36306, nr. 11`, `Stb. 2018, 387`, `HR 20 december 2019, ECLI:NL:HR:2019:2006`), short in a
// list and in full in Citeer, dated where its text changes. Every place that names a bron by
// its place reads it here; the forms of each kind are built in their own module, which nothing
// else imports (guards/citation-record.test.ts). The stand of a law or an article is its own
// line (api/validity, Validity.svelte).
import { articleName, bwCode, isNamedNumber, lawShortName, withBook } from './bw';
import { citeArticle, citePublication, type Citation } from './cite';
import { stbCitation } from './enacted-law';
import { headingCite, type HeadingSource } from './judgment-heading';
import { kamerstukCitation, kamerstukLabel, kamerstukName, type Paper } from './kamerstuk';
import { kamerstukNummer, officialNumber } from '$lib/bron/dossier-naam';

type CitationRecord = {
	/** The name its heading gives it: `Artikel 6:162 BW`, `Wet beveiliging netwerk- en
	 *  informatiesystemen (Wbni), Stb. 2018, 387`. */
	heading: string;
	/** As a list names it and a footnote cites it (Citeer kort): `art. 6:162 BW`, `Kamerstukken
	 *  II 2023/24, 36306, nr. 11`. */
	short: string;
	/** In full, as Citeer gives it (voluit): `artikel 6:162 van het Burgerlijk Wetboek`. */
	full: string;
	/** The short form with the day its text applies (met datum); null for a bron whose text does
	 *  not change. */
	dated: string | null;
	/** Its place where what holds it is named beside it (a column Kamerstuk, a dossier's list, a
	 *  tab): `36306, nr. 11`. */
	place: string;
};

/** A law by its names: its citeertitel, the abbreviation it is cited by, the name it goes by. */
type CitedLaw = {
	bwbId?: string | null;
	/** `Wet beveiliging netwerk- en informatiesystemen`, `Verordening (EU) 2016/679`. */
	citationTitle: string;
	/** `Wbni`, `AVG`; null without one. */
	abbreviation?: string | null;
	/** Its short title: of an act of the EU the name it goes by beside its citeertitel
	 *  (`Algemene verordening gegevensbescherming`), of a Dutch law its abbreviation again. */
	shortTitle?: string | null;
	/** Its official title in full, where that says more. */
	fullTitle?: string | null;
};

type CitedSource =
	| ({ kind: 'article'; label?: string | null } & Citation)
	| ({ kind: 'law' } & CitedLaw)
	| ({ kind: 'kamerstuk'; paperKind?: string | null } & Paper)
	| {
			kind: 'publication';
			series: string | null | undefined;
			year: number | string | null | undefined;
			number: string | number | null | undefined;
			/** The law it enacted, by its citeertitel and abbreviation. */
			law?: { title: string; abbreviation?: string | null } | null;
	  }
	| {
			kind: 'dossier';
			number: string;
			/** The name it goes by: `Wet betaalbare huur`. */
			name?: string | null;
	  }
	| ({ kind: 'judgment' } & HeadingSource);

/** A name with the abbreviation it is cited by, where that is another: `Wet … (Wbni)`. */
const withAbbreviation = (name: string, abbreviation: string | null | undefined) =>
	abbreviation && abbreviation !== name ? `${name} (${abbreviation})` : name;

/** The abbreviation a law is cited by; a book of the BW is cited as the code (`BW`). */
const lawAbbreviation = (law: { bwbId?: string | null; abbreviation?: string | null }) =>
	bwCode(law.bwbId) ?? law.abbreviation ?? null;

function articleRecord(c: Extract<CitedSource, { kind: 'article' }>): CitationRecord {
	const forms = citeArticle(c);
	const name = articleName(c.bwbId, c.articleNumber, c.label ?? c.heading) ?? forms.short;
	// The law after a number, as it is cited: `Artikel 6:162 BW`, `Artikel 6 AVG`; an article
	// that goes by its label ("Enig artikel") and a law without an abbreviation (its name stands
	// above the heading) keep the name alone.
	const law = lawAbbreviation({ bwbId: c.bwbId, abbreviation: c.shortTitle });
	const numbered = !isNamedNumber(c.articleNumber) && !/\s/.test(c.articleNumber.trim());
	return {
		heading: law && numbered && !c.heading ? `${name} ${law}` : name,
		short: forms.short,
		full: forms.full,
		dated: forms.dated,
		place: name
	};
}

function lawRecord(l: CitedLaw): CitationRecord {
	const book = lawShortName(l.bwbId, null);
	// A book of the BW is named by its citeertitel (`Burgerlijk Wetboek Boek 6`), cited as
	// `Boek 6 BW`; another law with its abbreviation: `Wet … (Wbni)`, an act of the EU by the
	// name it goes by (`Algemene verordening gegevensbescherming (AVG)`).
	const abbreviation = book ? null : (l.abbreviation ?? null);
	const cited = book ? l.citationTitle : withAbbreviation(l.citationTitle, abbreviation);
	// A short title of words is a name; one without a space an abbreviation.
	const name =
		l.shortTitle && /\s/.test(l.shortTitle.trim()) && l.shortTitle !== l.citationTitle
			? l.shortTitle
			: l.citationTitle;
	return {
		heading: withAbbreviation(name, abbreviation),
		short: cited,
		full: l.fullTitle ?? cited,
		dated: null,
		place: book ?? abbreviation ?? l.citationTitle
	};
}

function kamerstukRecord(p: Extract<CitedSource, { kind: 'kamerstuk' }>): CitationRecord | null {
	// Without a number the dossier it is in: `Kamerstuk 36764`.
	const cited = kamerstukCitation(p) ?? kamerstukName(p);
	if (!cited) return null;
	const place = kamerstukLabel(p) ?? cited;
	return {
		heading: cited,
		short: cited,
		full: p.paperKind ? `${cited} (${p.paperKind})` : cited,
		dated: null,
		place
	};
}

function publicationRecord(
	p: Extract<CitedSource, { kind: 'publication' }>
): CitationRecord | null {
	const cited = citePublication(
		p.series,
		p.year == null ? null : Number(p.year),
		p.number == null ? null : String(p.number)
	);
	if (!cited) return null;
	// The law it enacted before its place: `Wet beveiliging netwerk- en informatiesystemen
	// (Wbni), Stb. 2018, 387`.
	const heading = p.law ? `${withAbbreviation(p.law.title, p.law.abbreviation)}, ${cited}` : cited;
	return { heading, short: cited, full: heading, dated: null, place: cited };
}

function dossierRecord(d: Extract<CitedSource, { kind: 'dossier' }>): CitationRecord {
	const number = officialNumber(d.number);
	const cited = `Kamerstukken ${number}`;
	return {
		heading: d.name ?? kamerstukNummer(d.number),
		short: cited,
		full: d.name ? `${cited} (${d.name})` : cited,
		dated: null,
		place: number
	};
}

function judgmentRecord(j: HeadingSource): CitationRecord | null {
	const cited = headingCite(j);
	if (!cited) return null;
	return {
		heading: cited.short,
		short: cited.short,
		full: cited.full,
		dated: null,
		place: cited.short
	};
}

/** The kinds whose record is always there: their data names them. */
type AlwaysCited = Extract<CitedSource, { kind: 'article' | 'law' | 'dossier' }>;

/** The record of a bron; null where its data cannot place it (a paper without a dossier). */
export function citationRecord(source: AlwaysCited): CitationRecord;
export function citationRecord(source: CitedSource): CitationRecord | null;
export function citationRecord(source: CitedSource): CitationRecord | null {
	switch (source.kind) {
		case 'article':
			return articleRecord(source);
		case 'law':
			return lawRecord(source);
		case 'kamerstuk':
			return kamerstukRecord(source);
		case 'publication':
			return publicationRecord(source);
		case 'dossier':
			return dossierRecord(source);
		case 'judgment':
			return judgmentRecord(source);
	}
}

/**
 * An article in a list by the abbreviation its law is cited by (API 0.73,
 * `instrument_abbreviation`), as its record heads it: "Artikel 8 EVRM", "Artikel 3:4 Awb",
 * "Artikel 6 AVG"; a BW article by its book ("Artikel 6:162 BW", not "BW6"). Without one, the
 * name the API gives.
 */
export function articleTitle(
	name: string,
	props: Record<string, unknown> | null | undefined
): string {
	const abbreviation =
		typeof props?.instrument_abbreviation === 'string' ? props.instrument_abbreviation.trim() : '';
	const number = typeof props?.article_number === 'string' ? props.article_number.trim() : '';
	if (!abbreviation || /^BW\d/i.test(abbreviation) || !number) return withBook(name);
	const record = articleRecord({
		kind: 'article',
		articleNumber: number,
		shortTitle: abbreviation,
		citationTitle: name
	});
	// A number that is a name or a place ("Enig artikel") keeps the name the API gives.
	return record.heading === record.place ? withBook(name) : record.heading;
}

/** A law of the Staatsblad the BWB does not hold (STB-2026-56) by its place: `Stb. 2026, 56`. */
export const enactedLawPlace = (lawId: string): string | null => stbCitation(lawId);

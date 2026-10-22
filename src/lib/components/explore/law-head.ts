// The head of a law in the reader: its kind, the full title under the name, and where
// the official text is. A Dutch law is a Wet on wetten.overheid.nl; an act of the EU is a
// Verordening or a Richtlijn on EUR-Lex.
import type { Schema } from '$lib/api/types';
import type { Validity } from '$lib/api/validity';
import { enactedLawId, enactedLawStatus } from '$lib/text/enacted-law';
import { lawName, type InstrumentMeta } from '$lib/api/instrument-cache';
import { citationRecord, type CitationRecord } from '$lib/text/citation-record';
import { kindName } from '$lib/text/law-kind';

type Detail = Pick<
	Schema<'InstrumentDetailDTO'>,
	'kind' | 'title' | 'citation_title' | 'official_title' | 'official_url' | 'jurisdiction'
>;
type Dates = Pick<
	Schema<'InstrumentDetailDTO'>,
	'date_in_force' | 'version_date_in_force' | 'article_count' | 'inbound_citation_count'
> &
	Partial<Pick<Schema<'InstrumentDetailDTO'>, 'status' | 'in_force' | 'official_id'>>;

// The kinds of regeling the BWB knows (its `soort-regeling`, as the API gives it in lower
// case), as a lawyer names them. A kind of the Caribbean Netherlands says so.
/** Wet, Verdrag, Beleidsregel; for an act of the EU the first word of its citation: Verordening, Richtlijn. */
export function lawKind(
	d: Pick<Detail, 'kind' | 'jurisdiction' | 'citation_title'> | null
): string {
	const named = kindName(d?.kind);
	if (named) return named;
	if (d?.jurisdiction === 'eu') {
		const first = /^(Verordening|Richtlijn|Besluit|Kaderbesluit)\b/.exec(d.citation_title ?? '');
		if (first) return first[1];
	}
	return 'Regeling';
}

const PUBLICATION: Record<string, string> = { Stb: 'Staatsblad', Stcrt: 'Staatscourant' };

/** Where a publication appeared, as the reader and the breadcrumb name it: Staatsblad, Staatscourant. */
export function publicationName(kind: string): string {
	return PUBLICATION[kind] ?? kind;
}

/**
 * What the API's `title` of a publication says beyond its name: "Stb. 2018, 100: Besluit van
 * 23 maart 2018, houdende …" under "Stb. 2018, 100" (B36). Null where it says nothing more.
 */
export function publicationTitle(title: string | null | undefined, name: string): string | null {
	const t = title?.trim();
	if (!t) return null;
	const rest = t.startsWith(`${name}:`) ? t.slice(name.length + 1).trim() : t;
	return rest && rest !== name ? rest : null;
}

/** The full title under the name, where it says more than the name. */
export function lawFullTitle(d: Detail | null, name: string | null): string | null {
	const full = d?.official_title ?? d?.title ?? null;
	return full && full !== name ? full : null;
}

/**
 * The site of the official text, as the link says it: wetten.overheid.nl, eur-lex.europa.eu,
 * officielebekendmakingen.nl (its search, zoek., is the address, not the name).
 */
export function sourceName(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.replace(/^(www|zoek)\./, '');
	} catch {
		return null;
	}
}

/**
 * The head in sentences: 587 artikelen. In werking sinds 1 januari 1994. Geldende tekst:
 * versie van 15 augustus 2026. 15.108 keer aangehaald. The law came into force once; its
 * text in force is that of its latest version. On a peildatum only the count of that day. A
 * law of the Staatsblad the BWB does not hold yet: Vastgesteld, nog niet in werking (Stb.
 * 2026, 56).
 */
export function lawHeadLine(
	d: Dates | null,
	opts: {
		count: number;
		peildatum: string | null;
		/** The current version of `/versions`, where the law gives no version_date_in_force. */
		currentFrom?: string | null;
		longDate: (day: string) => string;
		formatCount: (n: number) => string;
		/**
		 * What the API says of whether the law holds (undefined: an API without it). The line
		 * Validity says it then, once: no Vastgesteld, nog niet in werking beside it, and no
		 * Geldende tekst where the law does not hold or is not known to.
		 */
		validity?: Validity | null;
	}
): string {
	const { count, peildatum, currentFrom, longDate, formatCount, validity } = opts;
	const saysHolds = validity === undefined || validity?.state === 'in_force';
	const version = d?.version_date_in_force ?? currentFrom ?? null;
	// The list is the count where the law says 0 (a BWB treaty); a record without text none.
	const n = peildatum ? count : d?.article_count || count;
	return [
		n > 0 ? `${formatCount(n)} artikelen.` : null,
		validity === undefined ? enactedStatus(d) : null,
		d?.date_in_force ? `In werking sinds ${longDate(d.date_in_force)}.` : null,
		saysHolds && !peildatum && version && version !== d?.date_in_force
			? `Geldende tekst: versie van ${longDate(version)}.`
			: null,
		d?.inbound_citation_count ? `${formatCount(d.inbound_citation_count)} keer aangehaald.` : null
	]
		.filter(Boolean)
		.join(' ');
}

/** Of a law of the Staatsblad not in force yet (`status` vastgesteld), its status as a sentence. */
function enactedStatus(d: Dates | null): string | null {
	const law =
		d?.status === 'vastgesteld' && d.in_force !== true ? enactedLawId(d.official_id) : null;
	const status = law ? enactedLawStatus(law) : null;
	return status ? `${status}.` : null;
}

/** The same treaty elsewhere (`same_treaty`): the BWB text of a Verdragenbank record, or the other way. */
type TreatyRef = Pick<Schema<'LinkedInstrumentDTO'>, 'key' | 'bwb_id'>;

type TreatyLink = {
	label: string;
	/** A bron in Concordans, or the Verdragenbank itself where the dataset lacks the record. */
	target: { kind: 'bron'; key: string } | { kind: 'url'; url: string };
};

/**
 * The link between a treaty's text in the BWB and its record in the Verdragenbank:
 * from the BWB, Verdragenbank: nr. 005132; from the Verdragenbank, the text in the BWB.
 */
export function treatyLink(
	d: { bwb_id?: string | null; treaty_number?: string | null } | null,
	same: TreatyRef[]
): TreatyLink | null {
	const number = d?.treaty_number?.trim();
	if (!number) return null;
	if (d?.bwb_id?.toUpperCase().startsWith('BWBV')) {
		const record = same.find((t) => !t.bwb_id);
		return {
			label: `Verdragenbank: nr. ${number}`,
			target: record
				? { kind: 'bron', key: record.key }
				: {
						kind: 'url',
						url: `https://verdragenbank.overheid.nl/nl/Verdrag/Details/${encodeURIComponent(number)}`
					}
		};
	}
	const text = same.find((t) => t.bwb_id?.toUpperCase().startsWith('BWBV'));
	return text
		? {
				label: `Tekst in het BWB: ${text.bwb_id!.toUpperCase()}`,
				target: { kind: 'bron', key: text.key }
			}
		: null;
}

/**
 * The citation record of a law as its page has it: its heading, Citeer short and in full. The
 * head of the law and the name over its table of contents read this one, so they say alike.
 */
export function lawCitationRecord(
	bwbId: string,
	detail: Partial<
		Pick<
			Schema<'InstrumentDetailDTO'>,
			'title' | 'citation_title' | 'official_title' | 'short_title' | 'abbreviation'
		>
	> | null,
	meta: InstrumentMeta | null | undefined
): CitationRecord {
	const name = lawName(meta, detail?.citation_title ?? detail?.title ?? bwbId);
	return citationRecord({
		kind: 'law',
		bwbId,
		citationTitle: name,
		abbreviation: detail?.abbreviation ?? meta?.abbreviation,
		shortTitle: detail?.short_title,
		fullTitle: lawFullTitle(detail as Detail | null, name)
	});
}

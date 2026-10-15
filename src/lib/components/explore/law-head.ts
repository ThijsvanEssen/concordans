// The head of a law in the reader: its kind, the full title under the name, and where
// the official text is. A Dutch law is a Wet on wetten.overheid.nl; an act of the EU is a
// Verordening or a Richtlijn on EUR-Lex.
import type { Schema } from '$lib/api/types';

type Detail = Pick<
	Schema<'InstrumentDetailDTO'>,
	'kind' | 'title' | 'citation_title' | 'official_title' | 'official_url' | 'jurisdiction'
>;
type Dates = Pick<
	Schema<'InstrumentDetailDTO'>,
	'date_in_force' | 'version_date_in_force' | 'article_count' | 'inbound_citation_count'
>;

// The kinds of regeling the BWB knows (its `soort-regeling`, as the API gives it in lower
// case), as a lawyer names them. A kind of the Caribbean Netherlands says so.
const KIND: Record<string, string> = {
	wet: 'Wet',
	rijkswet: 'Rijkswet',
	amvb: 'AMvB',
	rijksamvb: 'Rijks-AMvB',
	kb: 'Koninklijk besluit',
	rijkskb: 'Rijksbesluit',
	'ministeriele-regeling': 'Ministeriële regeling',
	'ministeriele-regeling-archiefselectielijst': 'Archiefselectielijst',
	beleidsregel: 'Beleidsregel',
	circulaire: 'Circulaire',
	zbo: 'Regeling van een zbo',
	pbo: 'Regeling van een pbo',
	reglement: 'Reglement',
	verdrag: 'Verdrag',
	bilateraalverdrag: 'Bilateraal verdrag',
	multilateraalverdrag: 'Multilateraal verdrag'
};

/** The name of a kind the BWB gives, or null for one it does not know. */
export function kindName(kind: string | null | undefined): string | null {
	const k = (kind ?? '').toLowerCase();
	if (KIND[k]) return KIND[k];
	const bes = /^(.+)-bes$/.exec(k);
	return bes && KIND[bes[1]] ? `${KIND[bes[1]]} BES` : null;
}

/** Wet, Verdrag, Beleidsregel; for an act of the EU the first word of its citation: Verordening, Richtlijn. */
export function lawKind(d: Detail | null): string {
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

/** The full title under the name, where it says more than the name. */
export function lawFullTitle(d: Detail | null, name: string | null): string | null {
	const full = d?.official_title ?? d?.title ?? null;
	return full && full !== name ? full : null;
}

/** The site of the official text, as the link says it: wetten.overheid.nl, eur-lex.europa.eu. */
export function sourceName(url: string | null | undefined): string | null {
	if (!url) return null;
	try {
		return new URL(url).hostname.replace(/^www\./, '');
	} catch {
		return null;
	}
}

/**
 * The head in sentences: 587 artikelen. In werking sinds 1 januari 1994. Geldende tekst:
 * versie van 15 augustus 2026. 15.108 keer aangehaald. The law came into force once; its
 * text in force is that of its latest version. On a peildatum only the count of that day.
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
	}
): string {
	const { count, peildatum, currentFrom, longDate, formatCount } = opts;
	const version = d?.version_date_in_force ?? currentFrom ?? null;
	// The list is the count where the law says 0 (a BWB treaty); a record without text none.
	const n = peildatum ? count : d?.article_count || count;
	return [
		n > 0 ? `${formatCount(n)} artikelen.` : null,
		d?.date_in_force ? `In werking sinds ${longDate(d.date_in_force)}.` : null,
		!peildatum && version && version !== d?.date_in_force
			? `Geldende tekst: versie van ${longDate(version)}.`
			: null,
		d?.inbound_citation_count ? `${formatCount(d.inbound_citation_count)} keer aangehaald.` : null
	]
		.filter(Boolean)
		.join(' ');
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

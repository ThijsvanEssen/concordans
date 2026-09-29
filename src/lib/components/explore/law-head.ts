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

const KIND: Record<string, string> = {
	wet: 'Wet',
	verdrag: 'Verdrag',
	bilateraalverdrag: 'Bilateraal verdrag',
	multilateraalverdrag: 'Multilateraal verdrag'
};

/** Wet, Verdrag; for an act of the EU the first word of its citation: Verordening, Richtlijn. */
export function lawKind(d: Detail | null): string {
	if (d?.kind && KIND[d.kind]) return KIND[d.kind];
	if (d?.jurisdiction === 'eu') {
		const first = /^(Verordening|Richtlijn|Besluit|Kaderbesluit)\b/.exec(d.citation_title ?? '');
		if (first) return first[1];
	}
	return 'Regeling';
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
	return [
		`${formatCount(peildatum ? count : (d?.article_count ?? count))} artikelen.`,
		d?.date_in_force ? `In werking sinds ${longDate(d.date_in_force)}.` : null,
		!peildatum && version && version !== d?.date_in_force
			? `Geldende tekst: versie van ${longDate(version)}.`
			: null,
		d?.inbound_citation_count ? `${formatCount(d.inbound_citation_count)} keer aangehaald.` : null
	]
		.filter(Boolean)
		.join(' ');
}

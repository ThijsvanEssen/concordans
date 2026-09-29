// The head of a law in the reader: its kind, the full title under the name, and where
// the official text is. A Dutch law is a Wet on wetten.overheid.nl; an act of the EU is a
// Verordening or a Richtlijn on EUR-Lex.
import type { Schema } from '$lib/api/types';

type Detail = Pick<
	Schema<'InstrumentDetailDTO'>,
	'kind' | 'title' | 'citation_title' | 'official_title' | 'official_url' | 'jurisdiction'
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

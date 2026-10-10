// Één naam per bron, op het canvas en in het
// netwerkpaneel gelijk, en gelijk aan de titel in Verbonden. Een artikel draagt de korte titel van zijn wet ("Art. 3:4 Awb").
import type { InstrumentMeta } from '$lib/api/instrument-cache';
import { lawIdOf, type GraphNode } from '$lib/graph/types';
import { describe, UNNAMED } from '$lib/verbonden/rows';
import { decisionOutcome } from '$lib/components/explore/index/decision-kind';
import { isEkDecision } from '$lib/components/parliamentary/timeline-kind';
import { langeDatum } from '$lib/text/datum';

const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

export function bronNaam(n: GraphNode, meta: Map<string, InstrumentMeta>): string {
	const p = n.raw?.props ?? undefined;
	if (n.kind === 'instrument') {
		const m = meta.get(lawIdOf(p) ?? n.key.toUpperCase());
		return (
			m?.shortTitle ??
			m?.citationTitle ??
			(p?.['citation_title'] as string | undefined) ??
			(p?.['title'] as string | undefined) ??
			n.label
		);
	}
	// Anything else by the title Verbonden gives it: "Rechtbank Rotterdam, 2 juni 2022".
	if (n.kind !== 'article') {
		// The source's own name, not the short label of the canvas ("2026-09, Brief").
		const title = describe(n.collection, n.key, n.raw?.display_name ?? n.label, p ?? {}).title;
		return title && title !== UNNAMED ? title : n.label;
	}
	const bwb = lawIdOf(p);
	const shortTitle = bwb ? meta.get(bwb)?.shortTitle : null;
	if (shortTitle) return `${n.label} ${shortTitle}`;
	// Until its law's short title is in, the abbreviation or citation title the article itself
	// carries: never "Art. 419" without its law (UX test 10 Oct, #23).
	const wet = text(p?.['instrument_abbreviation']) ?? text(p?.['instrument_citation_title']);
	return wet && !n.label.includes(wet) ? `${n.label} ${wet}` : n.label;
}

/**
 * A vote as the dossier's procedure names it, with its day and what was decided:
 * "Stemming Tweede Kamer, aangenomen, 29 september 2026: Wijziging van de Wet …". The
 * API's own name ("Wetgeving 2025Z15911: …") carries the Kamer's zaak number instead.
 */
export function stemmingNaam(n: Pick<GraphNode, 'id' | 'label' | 'raw'>): string {
	const p = n.raw?.props ?? {};
	const kamer = isEkDecision(n.id) || p['chamber'] === 'EK' ? 'Eerste Kamer' : 'Tweede Kamer';
	const uitslag = decisionOutcome({
		kind: text(p['kind']),
		decision_kind: text(p['decision_kind']),
		passed: typeof p['passed'] === 'boolean' ? p['passed'] : null
	});
	const datum = text(p['date']);
	const kop = [`Stemming ${kamer}`, uitslag?.toLowerCase(), datum ? langeDatum(datum) : null]
		.filter(Boolean)
		.join(', ');
	const over = text(p['subject']) ?? text(p['title']);
	return over ? `${kop}: ${over}` : kop;
}

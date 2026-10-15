// Één naam per bron, op het canvas en in het
// netwerkpaneel gelijk, en gelijk aan de titel in Verbonden. Een artikel draagt de korte titel van zijn wet ("Art. 3:4 Awb").
import { textOf } from '$lib/text/words';
import type { InstrumentMeta } from '$lib/api/instrument-cache';
import { lawIdOf, type GraphNode } from '$lib/graph/types';
import { describeBron, UNNAMED } from '$lib/bron/describe';
import { decisionOutcome } from '$lib/components/explore/index/decision-kind';
import { isEkDecision } from '$lib/components/parliamentary/ek-decision';
import { chamberName } from '$lib/components/parliamentary/chamber';
import { langeDatum } from '$lib/text/datum';
import { bwCode } from '$lib/text/bw';
import { dossierOwnName, dossierUitProps, kamerstukNummer } from './dossier-naam';

export function bronNaam(n: GraphNode, meta: Map<string, InstrumentMeta>): string {
	const p = n.raw?.props ?? undefined;
	if (n.drawClass === 'instrument') {
		const m = meta.get(lawIdOf(p) ?? n.key.toUpperCase());
		return (
			m?.shortTitle ??
			m?.citationTitle ??
			(p?.['citation_title'] as string | undefined) ??
			(p?.['title'] as string | undefined) ??
			n.label
		);
	}
	// A dossier by the name it is known by (its props' short title), as its row in
	// Verbonden: "Cyberbeveiligingswet", never the title of three lines.
	if (n.collection === 'dossiers') {
		const d = dossierUitProps({ display_name: n.raw?.display_name, ...p }, n.key);
		return dossierOwnName(d) ?? kamerstukNummer(d.number);
	}
	// Anything else by the title Verbonden gives it: "Rechtbank Rotterdam, 2 juni 2022".
	if (n.drawClass !== 'article') {
		// The source's own name, not the short label of the canvas ("2026-09, Brief").
		const title = describeBron(n.collection, n.key, n.raw?.display_name ?? n.label, p ?? {}).title;
		return title && title !== UNNAMED ? title : n.label;
	}
	const bwb = lawIdOf(p);
	// A book of the BW by the code, as the article is cited: "Art. 7A:1576 BW" (F21).
	const shortTitle = bwCode(bwb) ?? (bwb ? meta.get(bwb)?.shortTitle : null);
	if (shortTitle) return `${n.label} ${shortTitle}`;
	// Until its law's short title is in, the abbreviation or citation title the article itself
	// carries: never "Art. 419" without its law (UX test 10 Oct, #23).
	const wet = textOf(p?.['instrument_abbreviation']) ?? textOf(p?.['instrument_citation_title']);
	return wet && !n.label.includes(wet) ? `${n.label} ${wet}` : n.label;
}

/**
 * A vote as the dossier's procedure names it, with its day and what was decided:
 * "Stemming Tweede Kamer, aangenomen, 29 september 2026: Wijziging van de Wet …". The
 * API's own name ("Wetgeving 2025Z15911: …") carries the Kamer's zaak number instead.
 */
export function stemmingNaam(n: Pick<GraphNode, 'id' | 'label' | 'raw'>): string {
	const p = n.raw?.props ?? {};
	const kamer = chamberName(isEkDecision(n.id) ? 'EK' : textOf(p['chamber']));
	const uitslag = decisionOutcome({
		kind: textOf(p['kind']),
		decision_kind: textOf(p['decision_kind']),
		passed: typeof p['passed'] === 'boolean' ? p['passed'] : null
	});
	const datum = textOf(p['date']);
	const kop = [`Stemming ${kamer}`, uitslag?.toLowerCase(), datum ? langeDatum(datum) : null]
		.filter(Boolean)
		.join(', ');
	const over = textOf(p['subject']) ?? textOf(p['title']);
	return over ? `${kop}: ${over}` : kop;
}

/**
 * A vote as the map cites it, from its reader and from a row alike: "Stemming 20 december
 * 2016: Amendement …", in full with its Kamer. Never the citation of what was voted on.
 */
export function voteCitation(d: {
	date?: string | null;
	chamber?: string | null;
	subject?: string | null;
}): { kort: string; voluit: string } {
	const datum = d.date ? langeDatum(d.date) : '';
	const over = d.subject?.trim() ?? '';
	const tail = over ? `: ${over}` : '';
	return {
		kort: `Stemming${datum ? ` ${datum}` : ''}${tail}`,
		voluit: `Stemming ${chamberName(d.chamber)}${datum ? `, ${datum}` : ''}${tail}`
	};
}

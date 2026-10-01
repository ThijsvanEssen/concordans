// Ontwerpstudie ronde 5 (prototype): één naam per bron, op het canvas en in het
// netwerkpaneel gelijk. Een artikel draagt de korte titel van zijn wet ("Art. 3:4 Awb").
import type { InstrumentMeta } from '$lib/api/instrument-cache';
import { lawIdOf, type GraphNode } from '$lib/graph/types';

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
	if (n.kind !== 'article') return n.label;
	const bwb = lawIdOf(p);
	const shortTitle = bwb ? meta.get(bwb)?.shortTitle : null;
	return shortTitle ? `${n.label} ${shortTitle}` : n.label;
}

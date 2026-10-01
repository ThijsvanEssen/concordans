// Één naam per bron, op het canvas en in het
// netwerkpaneel gelijk, en gelijk aan de titel in Verbonden. Een artikel draagt de korte titel van zijn wet ("Art. 3:4 Awb").
import type { InstrumentMeta } from '$lib/api/instrument-cache';
import { lawIdOf, type GraphNode } from '$lib/graph/types';
import { describe, UNNAMED } from '$lib/verbonden/rows';

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
		const title = describe(n.collection, n.key, n.label, p ?? {}).title;
		return title && title !== UNNAMED ? title : n.label;
	}
	const bwb = lawIdOf(p);
	const shortTitle = bwb ? meta.get(bwb)?.shortTitle : null;
	return shortTitle ? `${n.label} ${shortTitle}` : n.label;
}

// Soort of the werkplek says per kind how many are drawn, and of how many there are where the
// API cut the neighbourhood off: "63 van 10.395". The drawn come from the canvas (its counts per
// kind), the whole from the API's buckets per collection. One collection can stand under
// several kinds (a Kamerstuk is a toelichting, a wetsvoorstel or another stuk): its whole goes
// to the last of them, less what the others draw.
import type { FilterGroup } from '$lib/verbonden/filter';

/** The kinds a collection's bronnen stand under, the one that takes its whole last. */
const KINDS_OF: Record<string, readonly FilterGroup[]> = {
	articles: ['artikelen'],
	instruments: ['internationaal', 'wetten'],
	judgments: ['uitspraken'],
	documents: ['toelichtingen', 'wetsvoorstellen', 'dossiers'],
	dossiers: ['dossiers'],
	decisions: ['stemmingen'],
	members: ['leden']
};

type KindCut = { total: number; collection: string };

/**
 * Per kind the canvas draws, the whole there is where fewer came (`buckets`: kept below total),
 * and the collection a step loads it by.
 */
export function kindCuts(
	buckets: readonly { collection: string; total: number; kept: number }[],
	drawn: Partial<Record<FilterGroup, number>>
): Partial<Record<FilterGroup, KindCut>> {
	const cuts: Partial<Record<FilterGroup, KindCut>> = {};
	for (const b of buckets) {
		if (b.kept >= b.total) continue;
		const kinds = KINDS_OF[b.collection] ?? [];
		const shown = kinds.filter((k) => (drawn[k] ?? 0) > 0);
		const last = shown.at(-1);
		if (!last) continue;
		const others = shown.slice(0, -1).reduce((n, k) => n + (drawn[k] ?? 0), 0);
		const total = (cuts[last]?.total ?? 0) + b.total - others;
		if (total > (drawn[last] ?? 0)) cuts[last] = { total, collection: b.collection };
	}
	return cuts;
}

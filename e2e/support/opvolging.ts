// What became of an old article no new article takes the place of, as the API gives it from
// lawgraph #860 on (`TRANSPOSED_TO` to the new law, `meta.outcome` and `parts[].outcome`): a
// bucket of the article's node, added to its recorded fixture with `patchApi` until the live
// API gives it. blg-1081574 p. 4: art. 10 Sv lapses in each of its leden, art. 2 lid 2 lapses.

/** The new Wetboek van Strafvordering, as a neighbour of a node (live 0.79.68). */
const NIEUW_SV = {
	id: 'instruments/wet_stb_2026_56',
	key: 'wet_stb_2026_56',
	collection: 'instruments',
	type: 'instrument',
	display_name: 'Wetboek van Strafvordering (Stb. 2026, 56)',
	labels: ['Staatsblad'],
	props: {
		citation_title: 'Wetboek van Strafvordering',
		title: 'Wetboek van Strafvordering',
		display_name: 'Wetboek van Strafvordering (Stb. 2026, 56)',
		kind: 'wet',
		official_id: 'stb-2026-56'
	},
	path: '/wetten/STB-2026-56'
};

/** The bucket of the edge to the new code, with what the table says of the parts. */
export const opvolging = (parts: { from: string; to: string; outcome: string }[]) => ({
	relation: 'TRANSPOSED_TO',
	direction: 'outbound',
	collection: 'instruments',
	type: 'instrument',
	total: 1,
	next_offset: null,
	lid_counts: null,
	capacity_counts: null,
	items: [
		{
			...NIEUW_SV,
			edge_id: 'e2e-transposed-to-outcome',
			relation: 'TRANSPOSED_TO',
			direction: 'outbound',
			confidence: 1,
			status: 'canoniek',
			meta: {
				basis: 'transposition_table',
				source: 'blg-1081574',
				parts,
				...(new Set(parts.map((p) => p.outcome)).size === 1 ? { outcome: parts[0].outcome } : {})
			}
		}
	]
});

/** A node response with the bucket added to its neighbours. */
export const metOpvolging =
	(bucket: ReturnType<typeof opvolging>) =>
	(body: Record<string, unknown>): Record<string, unknown> => {
		const neighbors = (body.neighbors ?? {}) as { buckets?: unknown[] };
		return {
			...body,
			neighbors: { ...neighbors, buckets: [...(neighbors.buckets ?? []), bucket] }
		};
	};

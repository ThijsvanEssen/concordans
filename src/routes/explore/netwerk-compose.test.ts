// A bron alone brings 150 neighbours per bucket, a composed netwerk 200 per bron (besluit 29).
import { describe, expect, it } from 'vitest';
import type { Schema } from '$lib/api/types';
import { NEIGHBORHOOD_CAP } from '$lib/graph/store/types';
import { withinCap } from './netwerk-compose.svelte';

type Response = Schema<'NodeGraphResponse'>;

const response = (n: number, total = 905) =>
	({
		node: { collection: 'instruments', key: 'bwbr0005290' },
		neighbors: {
			total,
			buckets: [
				{
					collection: 'articles',
					relation: 'PART_OF',
					direction: 'inbound',
					total,
					items: Array.from({ length: n }, (_, i) => ({ id: `articles/a${i}` }))
				}
			]
		}
	}) as unknown as Response;

describe('withinCap', () => {
	it('cuts a bucket of 200 to 150 and keeps its total, so Tonen says "150 van 905"', () => {
		const cut = withinCap(response(200), NEIGHBORHOOD_CAP);
		const bucket = cut.neighbors!.buckets[0];
		expect(bucket.items).toHaveLength(150);
		expect(bucket.total).toBe(905);
	});
	it('leaves a smaller bucket alone, the same object', () => {
		const small = response(40);
		expect(withinCap(small, NEIGHBORHOOD_CAP)).toBe(small);
	});
});

import { describe, expect, it, vi } from 'vitest';
import type { GraphStore } from '$lib/graph/graph-store';
import type { GraphNode } from '$lib/graph/types';

const node = (n: number) => ({
	node: { id: 'factions/d66', props: {} },
	neighbors: {
		total: 79,
		buckets: [
			{
				relation: 'MEMBER_OF',
				node_type: 'member',
				direction: 'inbound',
				total: 79,
				items: Array.from({ length: n }, (_, i) => ({
					id: `members/m${i}`,
					collection: 'members',
					key: `m${i}`,
					label: `Lid ${i}`,
					relation: 'MEMBER_OF',
					direction: 'inbound',
					props: {}
				}))
			}
		]
	}
});

let later: (v: unknown) => void = () => {};
vi.mock('$lib/api/records', async (original) => ({
	...(await original<typeof import('$lib/api/records')>()),
	getNodeFirst: () => Promise.resolve(node(1)),
	getNodeVerbonden: () => new Promise((r) => (later = r))
}));

const { createVerbondenSource } = await import('./source');

describe('the whole node, asked for before the first rows are in', () => {
	it('is asked once they are (an address with ?tabel=1)', async () => {
		const nodeResponse = vi.fn(() => Promise.resolve(node(79)));
		const source = createVerbondenSource({ nodeResponse } as unknown as GraphStore);
		source.load({ id: 'factions/d66', collection: 'factions', key: 'd66' } as GraphNode);
		await source.volledig();
		expect(nodeResponse).not.toHaveBeenCalled();
		later(node(5));
		await vi.waitFor(() => expect(nodeResponse).toHaveBeenCalledTimes(1));
		source.destroy();
	});
});

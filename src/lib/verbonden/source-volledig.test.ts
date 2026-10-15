import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VERBONDEN_BUCKET } from '$lib/api/records';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphStore } from '$lib/graph/store/types';
import type { GraphNode } from '$lib/graph/types';
import { createVerbondenSource } from './source';

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

// The light node comes at once, the rows of Verbonden when the test lets them.
let later: (v: unknown) => void = () => {};
beforeEach(() =>
	fakeApi({
		'/api/nodes/{collection}/{key}': ({ params }) =>
			params.query?.limit === VERBONDEN_BUCKET ? new Promise((r) => (later = r)) : node(1)
	})
);

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

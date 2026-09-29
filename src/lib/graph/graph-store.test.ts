import { describe, expect, it, vi } from 'vitest';

// A wet with more articles than the canvas keeps (SOFT_NODE_CAP): the Awb.
const ARTICLES = 450;
const awb = {
	node: {
		id: 'instruments/bwbr0005537',
		key: 'bwbr0005537',
		collection: 'instruments',
		type: 'instrument',
		display_name: 'Algemene wet bestuursrecht',
		labels: [],
		props: { bwb_id: 'BWBR0005537', title: 'Algemene wet bestuursrecht', short_title: 'Awb' }
	},
	neighbors: {
		total: ARTICLES,
		buckets: [
			{
				relation: 'PART_OF',
				collection: 'articles',
				direction: 'inbound',
				type: 'article',
				total: ARTICLES,
				items: Array.from({ length: ARTICLES }, (_, i) => ({
					id: `articles/bwbr0005537_${i}`,
					key: `bwbr0005537_${i}`,
					collection: 'articles',
					type: 'article',
					display_name: `Artikel ${i} Algemene wet bestuursrecht`,
					labels: [],
					relation: 'PART_OF',
					direction: 'inbound',
					props: { bwb_id: 'BWBR0005537', article_number: String(i) }
				}))
			}
		]
	}
};

vi.mock('$lib/api/nodes', async (original) => ({
	...(await original<typeof import('$lib/api/nodes')>()),
	getNodeGraph: vi.fn(async () => awb)
}));

const { createGraphStore } = await import('./graph-store');

describe('a wet as the focus', () => {
	it('stays on the canvas when it has more articles than the canvas keeps', async () => {
		const store = createGraphStore();
		const node = await store.expandNode('instruments', 'bwbr0005537', {
			neighborLimit: Number.POSITIVE_INFINITY
		});
		expect(node?.id).toBe('instruments/bwbr0005537');
	});
});

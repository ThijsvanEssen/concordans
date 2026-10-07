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

const getNodeGraph = vi.fn(async (_c: string, _k: string, opts: { limit?: number } = {}) =>
	opts.limit === 1
		? {
				...awb,
				neighbors: {
					...awb.neighbors,
					buckets: awb.neighbors.buckets.map((b) => ({ ...b, items: b.items.slice(0, 1) }))
				}
			}
		: awb
);
vi.mock('$lib/api/nodes', async (original) => ({
	...(await original<typeof import('$lib/api/nodes')>()),
	getNodeGraph
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

describe('the bron before its neighbours', () => {
	it('is drawn alone from its light node, and its neighbours follow with the full one', async () => {
		const store = createGraphStore();
		const nodes = () => {
			let all: { id: string }[] = [];
			store.nodes.subscribe((ns) => (all = ns))();
			return all.map((n) => n.id);
		};
		const first = await store.peekNode('instruments', 'bwbr0005537');
		expect(first?.id).toBe('instruments/bwbr0005537');
		expect(nodes()).toEqual(['instruments/bwbr0005537']);
		expect(getNodeGraph).toHaveBeenCalledWith('instruments', 'bwbr0005537', { limit: 1 });
		await store.expandNode('instruments', 'bwbr0005537', {
			neighborLimit: Number.POSITIVE_INFINITY
		});
		expect(nodes().length).toBeGreaterThan(1);
	});
});

import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import type { Schema } from '$lib/api/types';

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

// A cabinet, without neighbours: its bewindspersonen come from Verbonden (showRows).
const jetten = {
	node: {
		id: 'cabinets/jetten',
		key: 'jetten',
		collection: 'cabinets',
		type: 'cabinet',
		display_name: 'kabinet-Jetten',
		labels: [],
		props: {}
	},
	neighbors: { total: 0, buckets: [] }
};

// A stuk in dossier 36764: the dossier is its one neighbour, by PART_OF.
const dossier = {
	id: 'dossiers/36764',
	key: '36764',
	collection: 'dossiers',
	type: 'dossier',
	display_name: 'Cyberbeveiligingswet',
	labels: [],
	props: { label: '36764', title: 'Cyberbeveiligingswet' }
};
const stuk = (key: string) => ({
	node: {
		id: `documents/${key}`,
		key,
		collection: 'documents',
		type: 'document',
		display_name: `Kamerstuk 36764, nr. ${key}`,
		labels: [],
		props: {}
	},
	neighbors: {
		total: 1,
		buckets: [
			{
				relation: 'PART_OF',
				collection: 'dossiers',
				direction: 'outbound',
				type: 'dossier',
				total: 1,
				items: [{ ...dossier, relation: 'PART_OF', direction: 'outbound' }]
			}
		]
	}
});

const getNodeGraph = vi.fn(async (c: string, k: string, opts: { limit?: number } = {}) =>
	c === 'cabinets'
		? jetten
		: c === 'documents'
			? stuk(k)
			: opts.limit === 1
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

/** The hull of a container as the canvas gets it: after the microtask the store batches in. */
const hullOf = async (store: ReturnType<typeof createGraphStore>, id: string) => {
	await Promise.resolve();
	return get(store.containers).get(id);
};

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

describe('rows shown on a cabinet', () => {
	it('go into its hull with their seat, not out of it on a verbinding', async () => {
		const store = createGraphStore();
		const focus = await store.expandNode('cabinets', 'jetten');
		expect(focus?.id).toBe('cabinets/jetten');
		const rows = ['a', 'b', 'c'].map((key, i) => ({
			ref: { collection: 'members' as const, key },
			title: key,
			relation: 'SERVED_IN' as const,
			direction: 'inbound' as const,
			period: { from: '2026-02-23', to: i === 2 ? '2026-06-01' : null }
		}));
		expect(store.showRows('cabinets/jetten', rows)).toBe(true);
		let edges: { source: string; target: string }[] = [];
		store.edges.subscribe((es) => (edges = es))();
		expect(
			edges.filter((e) => e.target === 'cabinets/jetten' || e.source === 'cabinets/jetten')
		).toEqual([]);
		const group = await hullOf(store, 'cabinets/jetten');
		// The cabinet is the focus: the anchor of its own hull.
		expect([...(group?.members ?? [])]).toEqual([
			'cabinets/jetten',
			'members/a',
			'members/b',
			'members/c'
		]);
		expect(group?.periods.get('members/c')).toEqual({ from: '2026-02-23', to: '2026-06-01' });
	});
});

describe('the hulls of a canvas', () => {
	/** A path from stuk 1 to stuk 2: the dossier of each is drawn around it alone. */
	const path = {
		ids: ['documents/1', 'documents/2'],
		paths: [
			{
				source: 'documents/1',
				target: 'documents/2',
				node_ids: ['documents/1', 'documents/2'],
				edge_ids: ['e1']
			}
		],
		nodes: [stuk('1').node, stuk('2').node],
		edges: [{ id: 'e1', source: 'documents/1', target: 'documents/2', relation: 'CITES' }]
	} as unknown as Schema<'PathsResponse'>;

	it('start afresh after a reset: a dossier on a path no longer stands around one stuk', async () => {
		const store = createGraphStore();
		await store.mergePaths(path);
		await vi.waitFor(async () => expect((await hullOf(store, 'dossiers/36764'))?.lone).toBe(true));
		store.reset();
		expect(await hullOf(store, 'dossiers/36764')).toBeUndefined();
		await store.expandNode('documents', '3');
		const group = await hullOf(store, 'dossiers/36764');
		expect([...(group?.parts ?? [])]).toEqual(['documents/3']);
		expect(group?.lone).toBeUndefined();
	});

	it('belong to one store: another canvas does not see them', async () => {
		const one = createGraphStore();
		const other = createGraphStore();
		await one.expandNode('documents', '4');
		expect([...((await hullOf(one, 'dossiers/36764'))?.parts ?? [])]).toEqual(['documents/4']);
		expect(await hullOf(other, 'dossiers/36764')).toBeUndefined();
		await other.expandNode('documents', '5');
		expect([...((await hullOf(other, 'dossiers/36764'))?.parts ?? [])]).toEqual(['documents/5']);
		expect([...((await hullOf(one, 'dossiers/36764'))?.parts ?? [])]).toEqual(['documents/4']);
	});
});

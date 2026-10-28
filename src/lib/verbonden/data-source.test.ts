import { describe, expect, it, vi, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphStore } from '$lib/graph/store/types';
import type { GraphNode } from '$lib/graph/types';
import { createVerbondenSource, luiTeLaden } from './data-source';
import { VERBONDEN_BUCKET } from '$lib/api/records';

const first = (buckets: unknown[]) => ({ node: {}, neighbors: { total: 0, buckets } }) as never;

describe('luiTeLaden', () => {
	it('starts every kind but an article from five per bucket', () => {
		expect(luiTeLaden('instruments', null)).toBe(true);
		expect(luiTeLaden('dossiers', null)).toBe(true);
	});

	it('starts an article from five per bucket only where the API counts its leden', () => {
		expect(luiTeLaden('articles', null)).toBe(false);
		expect(luiTeLaden('articles', first([{ relation: 'REFERS_TO' }]))).toBe(false);
		expect(luiTeLaden('articles', first([{ relation: 'REFERS_TO', lid_counts: { '1': 3 } }]))).toBe(
			true
		);
	});

	it('stays lazy for an article whose counts are still being counted', () => {
		const pending = {
			node: {},
			neighbors: { total: 0, buckets: [{ relation: 'REFERS_TO', lid_counts: null }] },
			lid_counts_pending: true
		} as never;
		expect(luiTeLaden('articles', pending)).toBe(true);
	});
});

describe('the order of the judgments that cite an article', () => {
	const article = {
		node: {
			id: 'articles/bwbr0005537_3_4',
			key: 'bwbr0005537_3_4',
			props: { bwb_id: 'BWBR0005537', article_number: '3:4' }
		},
		neighbors: { total: 0, buckets: [] }
	};

	it('asks only that group again, in the order chosen', async () => {
		vi.spyOn(console, 'warn').mockImplementation(() => {});
		const api = fakeApi({
			'/api/nodes/{collection}/{key}': article,
			'/api/articles/{bwb_id}/{article_number}/cited-by': {
				items: [],
				total: 0,
				judgment_total: 0,
				echr_judgment_total: 0
			}
		});
		const nodeResponse = vi.fn(() => Promise.resolve(article));
		const source = createVerbondenSource({ nodeResponse } as unknown as GraphStore);
		source.load({
			id: 'articles/bwbr0005537_3_4',
			collection: 'articles',
			key: 'bwbr0005537_3_4'
		} as GraphNode);
		await vi.waitFor(() => {
			const st = get(source);
			expect(st.groups.length).toBeGreaterThan(0);
			expect(st.loading).toBe(false);
		});
		const before = api.requests.length;
		// The most cited first is where the group starts (besluit 32); the newest is the other order.
		expect(
			api.asked('/api/articles/{bwb_id}/{article_number}/cited-by').at(-1)?.query
		).toMatchObject({ sort: 'citation_count' });
		source.reloadGroup('judgments', { order: 'date' });
		expect(get(source).options.order).toBe('date');
		await vi.waitFor(() =>
			expect(
				api.asked('/api/articles/{bwb_id}/{article_number}/cited-by').at(-1)?.query
			).toMatchObject({ sort: 'date_desc' })
		);
		await vi.waitFor(() => expect(get(source).loading).toBe(false));
		expect(api.requests.slice(before).map((r) => r.path)).toEqual([
			'/api/articles/{bwb_id}/{article_number}/cited-by'
		]);
		expect(nodeResponse).toHaveBeenCalledTimes(1);
		source.destroy();
	});
});

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

describe('the laws of a ministry while they load (B3)', () => {
	it('say no count of the buckets: they count every law, the list those in force', async () => {
		const ministry = {
			node: { id: 'ministries/jenv', key: 'jenv', props: {} },
			neighbors: {
				total: 5551,
				buckets: [
					{
						relation: 'LED_BY',
						collection: 'instruments',
						direction: 'inbound',
						total: 5551,
						items: [
							{
								id: 'instruments/bwbr0001854',
								collection: 'instruments',
								key: 'bwbr0001854',
								relation: 'LED_BY',
								direction: 'inbound',
								props: {}
							}
						]
					}
				]
			}
		};
		fakeApi({
			'/api/nodes/{collection}/{key}': ministry,
			'/api/instruments': () => new Promise(() => {}),
			'/api/dossiers': () => new Promise(() => {}),
			'/api/commitments': () => new Promise(() => {})
		});
		const source = createVerbondenSource({
			nodeResponse: () => Promise.resolve(ministry)
		} as unknown as GraphStore);
		source.load({ id: 'ministries/jenv', collection: 'ministries', key: 'jenv' } as GraphNode);
		await vi.waitFor(() => expect(get(source).groups.length).toBeGreaterThan(0));
		const st = get(source);
		expect(st.verwacht?.laws).toBeUndefined();
		expect(st.preview?.find((p) => p.id === 'laws')?.count ?? null).toBeNull();
		source.destroy();
	});
});

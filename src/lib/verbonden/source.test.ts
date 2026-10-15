import { describe, expect, it, vi } from 'vitest';
import { get } from 'svelte/store';
import { fakeApi } from '$lib/test/fakeApi';
import type { GraphStore } from '$lib/graph/store/types';
import type { GraphNode } from '$lib/graph/types';
import { createVerbondenSource, luiTeLaden } from './source';

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
		source.reloadGroup('judgments', { order: 'cited' });
		expect(get(source).options.order).toBe('cited');
		await vi.waitFor(() =>
			expect(
				api.asked('/api/articles/{bwb_id}/{article_number}/cited-by').at(-1)?.query
			).toMatchObject({ sort: 'citation_count' })
		);
		await vi.waitFor(() => expect(get(source).loading).toBe(false));
		expect(api.requests.slice(before).map((r) => r.path)).toEqual([
			'/api/articles/{bwb_id}/{article_number}/cited-by'
		]);
		expect(nodeResponse).toHaveBeenCalledTimes(1);
		source.destroy();
	});
});

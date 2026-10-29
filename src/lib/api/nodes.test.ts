import { describe, expect, it } from 'vitest';
import { fail, fakeApi } from '$lib/test/fakeApi';
import { ApiError } from './client';
import { getBuckets, lidCountsOf, tierCountsOf } from './nodes';

const response = (buckets: unknown[]) => ({ node: {}, neighbors: { total: 0, buckets } }) as never;

describe('lidCountsOf', () => {
	it('adds the counts per lid of every bucket, "" for none that names a lid', () => {
		const counts = lidCountsOf(
			response([
				{ relation: 'REFERS_TO', direction: 'inbound', lid_counts: { '1': 28, '2': 174, '': 12 } },
				{ relation: 'EXPLAINS', direction: 'inbound', lid_counts: { '1': 2 } },
				{ relation: 'PART_OF', direction: 'outbound', lid_counts: null }
			])
		);
		expect(counts).toEqual(
			new Map([
				['1', 30],
				['2', 174],
				['', 12]
			])
		);
	});

	it('gives null where the API counts no lid', () => {
		expect(lidCountsOf(response([{ relation: 'PART_OF', direction: 'outbound' }]))).toBeNull();
	});
});

describe('tierCountsOf', () => {
	it('adds the judgments per tier of every bucket of judgments, all of them', () => {
		const counts = tierCountsOf(
			response([
				{
					relation: 'REFERS_TO',
					direction: 'inbound',
					tier_counts: { hoge_raad: 60, rechtbank: 900 }
				},
				{ relation: 'REFERS_TO', direction: 'outbound', tier_counts: { hoge_raad: 3, '': 1 } },
				{ relation: 'REFERS_TO', direction: 'outbound', tier_counts: null }
			])
		);
		expect(counts).toEqual(
			new Map([
				['hoge_raad', 63],
				['rechtbank', 900],
				['', 1]
			])
		);
	});

	it('gives null where the API counts no tier', () => {
		expect(tierCountsOf(response([{ relation: 'PART_OF', direction: 'outbound' }]))).toBeNull();
	});
});

describe('getBuckets', () => {
	const bucket = (relation: string) => ({
		node: {},
		neighbors: {
			total: 1,
			buckets: [{ relation, direction: 'inbound', items: [{ key: relation }] }]
		}
	});

	it('gives the rows of every bucket', async () => {
		fakeApi({
			'/api/nodes/{collection}/{key}': ({ params }) => bucket(String(params.query?.relations))
		});
		const rows = await getBuckets('articles', 'a', [
			{ relation: 'EXPLAINS', direction: 'inbound', collection: 'documents' },
			{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments' }
		]);
		expect(rows.map((r) => r.key)).toEqual(['EXPLAINS', 'REFERS_TO']);
	});

	it('rejects when one bucket fails, instead of leaving its rows out', async () => {
		fakeApi({
			'/api/nodes/{collection}/{key}': ({ params }) =>
				params.query?.relations === 'REFERS_TO' ? fail(500) : bucket('EXPLAINS')
		});
		await expect(
			getBuckets('articles', 'a', [
				{ relation: 'EXPLAINS', direction: 'inbound', collection: 'documents' },
				{ relation: 'REFERS_TO', direction: 'inbound', collection: 'judgments' }
			])
		).rejects.toBeInstanceOf(ApiError);
	});
});

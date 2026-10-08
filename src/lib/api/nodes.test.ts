import { describe, expect, it } from 'vitest';
import { lidCountsOf } from './nodes';

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

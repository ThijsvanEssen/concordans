import { describe, expect, it } from 'vitest';
import { luiTeLaden } from './source';

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
});

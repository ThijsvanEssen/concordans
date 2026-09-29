import { describe, expect, it } from 'vitest';
import { uniqueBy } from './unique';

describe('uniqueBy', () => {
	it('keeps the first of each key, in order', () => {
		const rows = [
			{ key: 'a', n: 1 },
			{ key: 'b', n: 2 },
			{ key: 'a', n: 3 }
		];
		expect(uniqueBy(rows, (r) => r.key)).toEqual([
			{ key: 'a', n: 1 },
			{ key: 'b', n: 2 }
		]);
	});
	it('keeps every item without a key', () => {
		expect(uniqueBy([1, 2, 2], () => null)).toEqual([1, 2, 2]);
	});
	it('leaves a list without duplicates as it is', () => {
		expect(uniqueBy(['x', 'y'], (s) => s)).toEqual(['x', 'y']);
	});
});

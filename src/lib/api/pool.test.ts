import { describe, expect, it } from 'vitest';
import { inPool } from './pool';

describe('inPool', () => {
	it('runs at most `parallel` at once and keeps the order of the results', async () => {
		let running = 0;
		let most = 0;
		const results = await inPool(
			[1, 2, 3, 4, 5, 6, 7, 8, 9],
			async (n) => {
				running++;
				most = Math.max(most, running);
				await new Promise((r) => setTimeout(r, 5));
				running--;
				return n * 2;
			},
			{ parallel: 4 }
		);
		expect(most).toBe(4);
		expect(results).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18]);
	});

	it('does no more than `max` items', async () => {
		const seen: number[] = [];
		await inPool([1, 2, 3, 4, 5], async (n) => void seen.push(n), { max: 3 });
		expect(seen).toEqual([1, 2, 3]);
	});
});

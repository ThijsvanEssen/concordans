import { describe, expect, it } from 'vitest';
import { twoAtATime } from './two-at-a-time';

describe('twoAtATime', () => {
	it('starts the items in their order, never more than two at once', async () => {
		const started: number[] = [];
		const release: (() => void)[] = [];
		let running = 0;
		let most = 0;
		const done = twoAtATime([1, 2, 3, 4, 5], async (n) => {
			started.push(n);
			most = Math.max(most, ++running);
			await new Promise<void>((r) => release.push(r));
			running--;
		});
		for (let i = 0; i < 5; i++) {
			await Promise.resolve();
			release.shift()?.();
			await new Promise((r) => setTimeout(r));
		}
		await done;
		expect(started).toEqual([1, 2, 3, 4, 5]);
		expect(most).toBe(2);
	});

	it('fails with the first failure', async () => {
		await expect(
			twoAtATime([1, 2], async (n) => {
				if (n === 2) throw new Error('twee');
			})
		).rejects.toThrow('twee');
	});

	it('is done at once without items', async () => {
		await expect(twoAtATime([], async () => {})).resolves.toBeUndefined();
	});
});

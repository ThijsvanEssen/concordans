import { describe, expect, it, vi } from 'vitest';
import { untilCounted } from './counted';

describe('untilCounted', () => {
	it('asks no more once the signal ended, even before the wait began', async () => {
		const ac = new AbortController();
		const ask = vi.fn(async () => {
			ac.abort();
			return { partial: true };
		});
		await expect(untilCounted(ask, (r) => r.partial, ac.signal)).rejects.toBeDefined();
		expect(ask).toHaveBeenCalledTimes(1);
	});

	it('asks again past the cache while counting, and stops at the counted answer', async () => {
		vi.useFakeTimers();
		const answers = [{ partial: true }, { partial: false }];
		const ask = vi.fn(async () => answers.shift()!);
		const done = untilCounted(ask, (r) => r.partial);
		await vi.runAllTimersAsync();
		await expect(done).resolves.toEqual({ partial: false });
		expect(ask.mock.calls).toEqual([[false], [true]]);
		vi.useRealTimers();
	});
});

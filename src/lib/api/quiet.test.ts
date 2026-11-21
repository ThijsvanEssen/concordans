import { afterEach, describe, expect, it, vi } from 'vitest';
import { sparingLine, tracked, whenApiQuiet } from './quiet';

afterEach(() => vi.useRealTimers());

describe('whenApiQuiet', () => {
	it('waits until no request has been under way for the settle time', async () => {
		vi.useFakeTimers();
		let answer!: () => void;
		const first = tracked(new Promise<void>((r) => (answer = r)));
		const fn = vi.fn();
		whenApiQuiet(fn, 600);
		vi.advanceTimersByTime(5000);
		expect(fn).not.toHaveBeenCalled();
		answer();
		await first;
		vi.advanceTimersByTime(599);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('starts over when the next wave begins before it settled', async () => {
		vi.useFakeTimers();
		const fn = vi.fn();
		whenApiQuiet(fn, 600);
		vi.advanceTimersByTime(400);
		let answer!: () => void;
		const wave = tracked(new Promise<void>((r) => (answer = r)));
		vi.advanceTimersByTime(5000);
		expect(fn).not.toHaveBeenCalled();
		answer();
		await wave;
		vi.advanceTimersByTime(600);
		expect(fn).toHaveBeenCalledOnce();
	});

	it('counts a failed request as done, and can be cancelled', async () => {
		vi.useFakeTimers();
		const failed = tracked(Promise.reject(new Error('down')));
		await failed.catch(() => {});
		const fn = vi.fn();
		const cancel = whenApiQuiet(fn, 100);
		cancel();
		vi.advanceTimersByTime(1000);
		expect(fn).not.toHaveBeenCalled();
	});
});

describe('sparingLine', () => {
	it('spares Data Saver and 3g or slower', () => {
		expect(sparingLine({ saveData: true, effectiveType: '4g' })).toBe(true);
		expect(sparingLine({ effectiveType: '3g' })).toBe(true);
		expect(sparingLine({ effectiveType: '2g' })).toBe(true);
		expect(sparingLine({ effectiveType: '4g' })).toBe(false);
	});

	it('does not spare a browser that cannot say', () => {
		expect(sparingLine(undefined)).toBe(false);
	});
});

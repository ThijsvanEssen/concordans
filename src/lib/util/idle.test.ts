import { afterEach, describe, expect, it, vi } from 'vitest';
import { whenIdle } from './idle';

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});

describe('whenIdle', () => {
	it('waits for the browser to be idle, with its timeout', () => {
		const ric = vi.fn((_fn: () => void, _o: { timeout: number }) => 7);
		const cic = vi.fn();
		vi.stubGlobal('requestIdleCallback', ric);
		vi.stubGlobal('cancelIdleCallback', cic);
		const fn = vi.fn();
		const cancel = whenIdle(fn, { timeout: 5000 });
		expect(ric.mock.calls[0][1]).toEqual({ timeout: 5000 });
		ric.mock.calls[0][0]();
		expect(fn).toHaveBeenCalledOnce();
		cancel();
		expect(cic).toHaveBeenCalledWith(7);
	});

	it('waits the fallback where the browser cannot say it is idle, and can be cancelled', () => {
		vi.stubGlobal('requestIdleCallback', undefined);
		vi.useFakeTimers();
		const fn = vi.fn();
		whenIdle(fn, { fallback: 200 });
		vi.advanceTimersByTime(199);
		expect(fn).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fn).toHaveBeenCalledOnce();
		const other = vi.fn();
		whenIdle(other)();
		vi.advanceTimersByTime(5000);
		expect(other).not.toHaveBeenCalled();
	});
});

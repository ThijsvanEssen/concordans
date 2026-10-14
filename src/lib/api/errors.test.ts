import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { ifExists, ignore, isAborted, isNotFound, isSlow, report } from './errors';

const aborted = () => {
	const controller = new AbortController();
	controller.abort();
	return controller.signal.reason;
};
const timeout = new DOMException('signal timed out', 'TimeoutError');
const status = (code: number) => new ApiError(code, '/api/x');

afterEach(() => vi.restoreAllMocks());

describe('what a failure means', () => {
	it('tells an abort from a timeout', () => {
		expect(isAborted(aborted())).toBe(true);
		expect(isAborted(timeout)).toBe(false);
		expect(isAborted(status(500))).toBe(false);
	});

	it('calls a timeout, a 503 and a 504 slow, not a 500 or an abort', () => {
		expect(isSlow(timeout)).toBe(true);
		expect(isSlow(status(503))).toBe(true);
		expect(isSlow(status(504))).toBe(true);
		expect(isSlow(status(500))).toBe(false);
		expect(isSlow(aborted())).toBe(false);
	});

	it('knows a 404 and nothing else as not found', () => {
		expect(isNotFound(status(404))).toBe(true);
		expect(isNotFound(status(500))).toBe(false);
		expect(isNotFound(new Error('404'))).toBe(false);
	});
});

describe('ifExists', () => {
	it('gives the answer, or null for a 404', async () => {
		expect(await ifExists(Promise.resolve(7))).toBe(7);
		expect(await ifExists(Promise.reject(status(404)))).toBeNull();
	});

	it('throws a 500, a timeout and an abort on', async () => {
		await expect(ifExists(Promise.reject(status(500)))).rejects.toBeInstanceOf(ApiError);
		await expect(ifExists(Promise.reject(timeout))).rejects.toBe(timeout);
		const abort = aborted();
		await expect(ifExists(Promise.reject(abort))).rejects.toBe(abort);
	});
});

describe('report and ignore', () => {
	it('reports a failure with where it happened, and an abort not at all', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const e = status(500);
		report('Verbonden', e);
		report('Verbonden', aborted());
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith('Verbonden:', e);
	});

	it('ignores a prefetch, logging it while developing only', () => {
		const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		ignore('leesbaar')(status(500));
		ignore('leesbaar')(aborted());
		expect(debug).toHaveBeenCalledTimes(import.meta.env.DEV ? 1 : 0);
		expect(warn).not.toHaveBeenCalled();
	});
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { SEARCH_TIMEOUT_MS, TIMEOUT_MS, api, isTimeout, zoekApi } from './client';

describe('api timeouts', () => {
	afterEach(() => vi.restoreAllMocks());

	const timeoutsOf = async (call: () => Promise<unknown>) => {
		const timeout = vi.spyOn(AbortSignal, 'timeout');
		vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('{}'));
		await call();
		return timeout.mock.calls.map((c) => c[0]);
	};

	it('gives an ordinary call 10 s', async () => {
		expect(await timeoutsOf(() => api.GET('/api/health'))).toEqual([TIMEOUT_MS]);
	});

	it('gives the slow search lanes 30 s, the deadline of the API', async () => {
		expect(
			await timeoutsOf(() =>
				zoekApi.GET('/api/search', { params: { query: { q: 'huur', types: ['judgments'] } } })
			)
		).toEqual([SEARCH_TIMEOUT_MS]);
		expect(SEARCH_TIMEOUT_MS).toBe(30_000);
	});

	it('tells a timeout from an abort', () => {
		expect(isTimeout(new DOMException('', 'TimeoutError'))).toBe(true);
		expect(isTimeout(new DOMException('', 'AbortError'))).toBe(false);
	});
});

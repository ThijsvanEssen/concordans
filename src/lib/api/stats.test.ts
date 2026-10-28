// The two answers of Bronnen en de voet: asked once at a time, given the caller's signal, and
// asked once more when the first gave up on its time.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { getCoverage, getStats } from './stats';

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });
const timeout = () => new DOMException('timed out', 'TimeoutError');

afterEach(() => {
	vi.restoreAllMocks();
});

describe('getStats', () => {
	it('asks once more by itself when the first request gave up on its time', async () => {
		const fetch = vi
			.spyOn(globalThis, 'fetch')
			.mockRejectedValueOnce(timeout())
			.mockResolvedValueOnce(json({ nodes: { a: 1 } }));
		await expect(getStats()).resolves.toMatchObject({ nodes: { a: 1 } });
		expect(fetch).toHaveBeenCalledTimes(2);
	});

	it('fails when the second request also gives up, and asks anew on the next call', async () => {
		const fetch = vi.spyOn(globalThis, 'fetch').mockRejectedValue(timeout());
		await expect(getCoverage()).rejects.toMatchObject({ name: 'TimeoutError' });
		expect(fetch).toHaveBeenCalledTimes(2);
		fetch.mockResolvedValue(json({ tiers: [] }));
		await expect(getCoverage()).resolves.toMatchObject({ tiers: [] });
		expect(fetch).toHaveBeenCalledTimes(3);
	});

	it('hands the caller signal to the request, and does not ask again after leaving', async () => {
		vi.resetModules();
		const { getStats: fresh } = await import('./stats');
		const controller = new AbortController();
		const fetch = vi.spyOn(globalThis, 'fetch').mockImplementation(
			(input) =>
				new Promise((_, reject) => {
					(input as Request).signal.addEventListener('abort', () =>
						reject(new DOMException('gone', 'AbortError'))
					);
				})
		);
		const asked = fresh(controller.signal);
		controller.abort();
		await expect(asked).rejects.toMatchObject({ name: 'AbortError' });
		expect(fetch).toHaveBeenCalledTimes(1);
	});
});

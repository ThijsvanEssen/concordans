import { afterEach, describe, expect, it, vi } from 'vitest';
import { getFeed } from './feed';

describe('getFeed', () => {
	afterEach(() => vi.restoreAllMocks());

	const cacheOf = async (opts: Parameters<typeof getFeed>[1]) => {
		const fetch = vi
			.spyOn(globalThis, 'fetch')
			.mockResolvedValue(new Response('{"items":[]}', { status: 200 }));
		await getFeed({ limit: 1, facets: true }, opts);
		return (fetch.mock.calls.at(-1)![0] as Request).cache;
	};

	it('asks the counts again past the browser cache: a partial answer is kept 60 s (B1)', async () => {
		expect(await cacheOf({ wait: 'short', fresh: true })).toBe('reload');
		expect(await cacheOf({ wait: 'short' })).toBe('default');
	});
});

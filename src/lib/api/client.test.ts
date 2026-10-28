import { afterEach, describe, expect, it, vi } from 'vitest';
import {
	SLOW_TIMEOUT_MS,
	TIMEOUT_MS,
	api,
	isTimeout,
	onAnswer,
	teller,
	timedFetch,
	slowApi,
	unwrap
} from './client';
import { getNodeGraph, getNodeNeighborhood, NODE_BUCKET } from './nodes';
import { getFactionDossiers } from './verbonden';
import { getFeedSummary } from './feed';

describe('api timeouts', () => {
	afterEach(() => vi.restoreAllMocks());

	const timeoutsOf = async (call: () => Promise<unknown>) => {
		vi.restoreAllMocks();
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
				slowApi.GET('/api/search', { params: { query: { q: 'huur', types: ['judgments'] } } })
			)
		).toEqual([SLOW_TIMEOUT_MS]);
		expect(SLOW_TIMEOUT_MS).toBeGreaterThan(TIMEOUT_MS);
	});

	it('lets a caller shorten the wait but never lengthen it: a slow call goes to slowApi', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(
			(input) =>
				new Promise((_, reject) => {
					const { signal } = input as Request;
					signal.addEventListener('abort', () => reject(signal.reason));
				})
		);
		const start = Date.now();
		const call = timedFetch(50)(
			new Request('http://api.test/api/feed', { signal: AbortSignal.timeout(5_000) })
		);
		await expect(call).rejects.toSatisfy(isTimeout);
		expect(Date.now() - start).toBeLessThan(2_000);
	});

	it('lets a node wait as long as the API, and a light one the ordinary 10 s', async () => {
		const node = (opts: Parameters<typeof getNodeGraph>[2]) => () =>
			getNodeGraph('articles', 'a', opts);
		expect(await timeoutsOf(node({ limit: NODE_BUCKET }))).toEqual([SLOW_TIMEOUT_MS]);
		expect(await timeoutsOf(node({ limit: 2 }))).toEqual([SLOW_TIMEOUT_MS]);
		expect(await timeoutsOf(node({}))).toEqual([SLOW_TIMEOUT_MS]);
		expect(await timeoutsOf(node({ limit: 1, wait: 'short' }))).toEqual([TIMEOUT_MS]);
	});

	it('lets the cold calls (neighbourhood, fractie dossiers, Actueel on the start page) wait 30 s (N3)', async () => {
		const neighborhood = () => getNodeNeighborhood('factions', 'vvd', { depth: 1, cap: 150 });
		expect(await timeoutsOf(neighborhood)).toEqual([SLOW_TIMEOUT_MS]);
		expect(await timeoutsOf(() => getFactionDossiers('vvd-koud', 100))).toEqual([SLOW_TIMEOUT_MS]);
		expect(await timeoutsOf(() => getFeedSummary({ days: 7 }))).toEqual([SLOW_TIMEOUT_MS]);
	});

	it('tells a timeout from an abort', () => {
		expect(isTimeout(new DOMException('', 'TimeoutError'))).toBe(true);
		expect(isTimeout(new DOMException('', 'AbortError'))).toBe(false);
	});
});

describe('the guard against a loop of requests', () => {
	it('refuses the request past the limit within the window, and lets them through again after', () => {
		let t = 0;
		const bewaak = teller(3, 1000, () => t);
		const err = vi.spyOn(console, 'error').mockImplementation(() => {});
		bewaak('/a');
		bewaak('/a');
		bewaak('/a');
		expect(() => bewaak('/a')).toThrow(/Meer dan 3 verzoeken/);
		t = 1500;
		expect(() => bewaak('/a')).not.toThrow();
		err.mockRestore();
	});
});

describe('who reads the answers', () => {
	afterEach(() => vi.restoreAllMocks());

	it('gives every answer to every reader until it stops reading', async () => {
		vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response('{"a":1}'));
		const first: unknown[] = [];
		const second: unknown[] = [];
		const stopFirst = onAnswer((data) => first.push(data));
		const stopSecond = onAnswer((data) => second.push(data));
		await unwrap(api.GET('/api/health'));
		stopFirst();
		await unwrap(api.GET('/api/health'));
		stopSecond();
		expect(first).toEqual([{ a: 1 }]);
		expect(second).toEqual([{ a: 1 }, { a: 1 }]);
	});
});

describe('a failed answer', () => {
	afterEach(() => vi.restoreAllMocks());

	it('keeps the request id the API gives a 500, from its body or its header', async () => {
		const id = '1a2b3c4d-0000-4000-8000-000000000000';
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response(JSON.stringify({ detail: 'Internal error.', request_id: id }), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			})
		);
		await expect(unwrap(api.GET('/api/health'))).rejects.toMatchObject({
			status: 500,
			requestId: id
		});
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
			new Response('Internal Server Error', { status: 500, headers: { 'X-Request-ID': id } })
		);
		await expect(unwrap(api.GET('/api/health'))).rejects.toMatchObject({ requestId: id });
		vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(new Response('{}', { status: 404 }));
		await expect(unwrap(api.GET('/api/health'))).rejects.toMatchObject({ requestId: null });
	});
});

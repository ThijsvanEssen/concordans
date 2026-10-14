import { describe, expect, it, vi } from 'vitest';
import { ApiError, api, isTimeout, unwrap, zoekApi } from '$lib/api/client';
import { aborted, fail, fakeApi, slow } from './fakeApi';

const member = (key: string) =>
	unwrap(api.GET('/api/members/{key}', { params: { path: { key } } }));

describe('fakeApi', () => {
	it('answers a path by its template, with the answer or with what a function makes of the request', async () => {
		fakeApi({
			'/api/health': { status: 'ok' },
			'/api/members/{key}': ({ params }) => ({ key: params.path?.key })
		});
		expect(await unwrap(api.GET('/api/health'))).toEqual({ status: 'ok' });
		expect(await member('yesilgoz')).toEqual({ key: 'yesilgoz' });
	});

	it('answers the slow client too, and keeps what was asked of which', async () => {
		const fake = fakeApi({ '/api/search': { items: [] } });
		await zoekApi.GET('/api/search', { params: { query: { q: 'huur' } } });
		await api.GET('/api/search', { params: { query: { q: 'pacht' } } });
		expect(fake.requests.map((r) => [r.client, r.path])).toEqual([
			['zoekApi', '/api/search'],
			['api', '/api/search']
		]);
		expect(fake.asked('/api/search')).toEqual([
			{ query: { q: 'huur' } },
			{ query: { q: 'pacht' } }
		]);
	});

	it('fails with a status: no data, and unwrap throws an ApiError naming the path', async () => {
		fakeApi({ '/api/members/{key}': fail(503) });
		const { data, response } = await api.GET('/api/members/{key}', {
			params: { path: { key: 'x' } }
		});
		expect([data, response.ok, response.status]).toEqual([undefined, false, 503]);
		const e = await member('x').catch((e: unknown) => e);
		expect(e).toBeInstanceOf(ApiError);
		expect(e).toMatchObject({ status: 503, message: '/api/members/{key} answered 503' });
	});

	it('runs out of time as the client does: a TimeoutError', async () => {
		fakeApi({ '/api/health': slow() });
		const e = await api.GET('/api/health').catch((e: unknown) => e);
		expect(isTimeout(e)).toBe(true);
	});

	it('breaks off as an aborted fetch does: an AbortError, no timeout', async () => {
		fakeApi({ '/api/health': aborted() });
		const e = await api.GET('/api/health').catch((e: unknown) => e);
		expect(e).toMatchObject({ name: 'AbortError' });
		expect(isTimeout(e)).toBe(false);
	});

	it("rejects with the caller's reason when its signal has aborted", async () => {
		const answer = vi.fn(() => ({ status: 'ok' }));
		fakeApi({ '/api/health': answer });
		const ac = new AbortController();
		ac.abort('nieuw filter');
		await expect(api.GET('/api/health', { signal: ac.signal })).rejects.toBe('nieuw filter');
		expect(answer).not.toHaveBeenCalled();
	});

	it('fails loudly on a path it has no answer for', async () => {
		fakeApi({});
		await expect(api.GET('/api/health')).rejects.toThrow('fakeApi: no answer for /api/health');
	});

	it('lets a function fail in turn: the first request fails, the next one is answered', async () => {
		const answers = [fail(500), { status: 'ok' }];
		fakeApi({ '/api/health': () => answers.shift() });
		await expect(unwrap(api.GET('/api/health'))).rejects.toBeInstanceOf(ApiError);
		expect(await unwrap(api.GET('/api/health'))).toEqual({ status: 'ok' });
	});

	it('is gone in the next test: the clients ask the network again', () => {
		expect(vi.isMockFunction(api.GET)).toBe(false);
		expect(vi.isMockFunction(zoekApi.GET)).toBe(false);
	});
});

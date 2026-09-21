import { describe, expect, it, vi } from 'vitest';
import { forwardWrite, isAllowedWrite } from './write-proxy';

const KEY = 'secret-write-key';
const apiBaseUrl = 'http://api.test';

function setup(upstream: Response = new Response('{"id":"w1"}', { status: 201 })) {
	const fetch = vi.fn(async () => upstream);
	const call = (
		request: Request,
		path: string,
		config: { writeKey?: string } = { writeKey: KEY }
	) => forwardWrite(request, path, { apiBaseUrl, writeKey: config.writeKey, fetch });
	return { fetch, call };
}

const post = (body = '{"node_id":"articles/x"}') =>
	new Request('http://app.test/proxy/api/watches', { method: 'POST', body });

describe('write proxy', () => {
	it('adds the key, passes status and body through, and shows the key to nobody', async () => {
		const { fetch, call } = setup();
		const response = await call(post(), 'api/watches');

		expect(fetch).toHaveBeenCalledOnce();
		const [url, init] = fetch.mock.calls[0] as unknown as [URL, RequestInit];
		expect(String(url)).toBe('http://api.test/api/watches');
		expect(new Headers(init.headers).get('X-Write-Key')).toBe(KEY);
		expect(init.body).toBe('{"node_id":"articles/x"}');

		expect(response.status).toBe(201);
		expect(await response.text()).toBe('{"id":"w1"}');
		expect([...response.headers.values()].join()).not.toContain(KEY);
	});

	it('forwards a delete without body and answers 204 without one', async () => {
		const { fetch, call } = setup(new Response(null, { status: 204 }));
		const response = await call(
			new Request('http://app.test/proxy/api/watches/w1', { method: 'DELETE' }),
			'api/watches/w1'
		);
		expect(response.status).toBe(204);
		expect((fetch.mock.calls[0] as unknown as [URL, RequestInit])[1].body).toBeUndefined();
	});

	it('passes the API status through, also when it refuses', async () => {
		const { call } = setup(new Response('{"detail":"node not found"}', { status: 400 }));
		const response = await call(post(), 'api/watches');
		expect(response.status).toBe(400);
		expect(await response.text()).toBe('{"detail":"node not found"}');
	});

	it.each([
		['POST', 'api/relationships/tag'],
		['POST', 'api/relationships/e1/vote'],
		['GET', 'api/watches'],
		['DELETE', 'api/watches'],
		['POST', 'api/watches/w1'],
		['DELETE', 'api/watches/../health'],
		['POST', 'api/watchesx'],
		['POST', '']
	])('refuses %s %s without calling the API', async (method, path) => {
		const { fetch, call } = setup();
		const response = await call(
			new Request('http://app.test/proxy/x', {
				method,
				body: method === 'GET' ? undefined : '{}'
			}),
			path
		);
		expect(response.status).toBe(404);
		expect(fetch).not.toHaveBeenCalled();
		expect(isAllowedWrite(method, path)).toBe(false);
	});

	it('answers 503 and sends nothing when no key is configured', async () => {
		const { fetch, call } = setup();
		const response = await call(post(), 'api/watches', {});
		expect(response.status).toBe(503);
		expect(fetch).not.toHaveBeenCalled();
	});
});

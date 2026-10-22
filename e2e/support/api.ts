// The API of the suite: every request the app makes to it is answered from e2e/api/, one file
// per request (method, path and sorted query). The build talks to API_ORIGIN, a host that
// does not exist, so nothing reaches a real API by accident. `npm run e2e:record` runs the
// suite with E2E_RECORD=1: a request without its file is asked of the live API (E2E_LIVE_API,
// default https://concordans.nl) and written down, compact and gzipped: the answers of a
// network are large, and a fixture is read by the suite, not by a person (`zcat` reads one).
import type { BrowserContext, Page, Route } from '@playwright/test';
import { createHash } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const API_ORIGIN = 'http://api.e2e.test';
const LIVE = process.env.E2E_LIVE_API ?? 'https://concordans.nl';
const RECORD = process.env.E2E_RECORD === '1';
export const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '..', 'api');

/** What a cross-origin answer needs for the app to read it. */
export const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-headers': '*',
	'access-control-expose-headers': '*'
};

type Recorded = { url: string; status: number; type: string; body: unknown };

/** The request as the file knows it: path and sorted query, without the host. */
export function keyOf(url: string): string {
	const u = new URL(url);
	const query = [...u.searchParams].sort(([a, x], [b, y]) =>
		a === b ? x.localeCompare(y) : a.localeCompare(b)
	);
	return u.pathname + (query.length ? '?' + new URLSearchParams(query).toString() : '');
}

/** One file per request: a readable slug of the path and a hash of the whole key. */
export function fileOf(key: string): string {
	const slug = key
		.replace(/^\/api\//, '')
		.split('?')[0]
		.replace(/[^A-Za-z0-9._-]+/g, '_')
		.slice(0, 60);
	const hash = createHash('sha1').update(key).digest('hex').slice(0, 10);
	return join(FIXTURES, `${slug}-${hash}.json.gz`);
}

async function record(key: string, file: string): Promise<Recorded> {
	const res = await fetch(LIVE + key, { headers: { accept: 'application/json' } });
	const type = res.headers.get('content-type') ?? 'application/json';
	const text = await res.text();
	let body: unknown = text;
	if (type.includes('json')) {
		try {
			body = JSON.parse(text);
		} catch {
			body = text;
		}
	}
	const recorded = { url: key, status: res.status, type, body };
	mkdirSync(FIXTURES, { recursive: true });
	const tmp = `${file}.${process.pid}.tmp`;
	writeFileSync(tmp, gzipSync(JSON.stringify(recorded), { level: 9 }));
	renameSync(tmp, file);
	return recorded;
}

/** A body as the wire carries it. */
const wire = (r: Recorded) => (typeof r.body === 'string' ? r.body : JSON.stringify(r.body));

/**
 * Answers the API from the fixtures for every page of `context`; a request without its file
 * is added to `missing` (and answered 404), so the test fails with what to record.
 */
export async function serveApi(context: BrowserContext, missing: string[]) {
	await context.route(`${API_ORIGIN}/**`, async (route) => {
		const request = route.request();
		if (request.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
		const key = keyOf(request.url());
		const file = fileOf(key);
		let recorded: Recorded | null = null;
		if (existsSync(file))
			recorded = JSON.parse(gunzipSync(readFileSync(file)).toString()) as Recorded;
		else if (RECORD) recorded = await record(key, file).catch(() => null);
		if (!recorded) {
			missing.push(key);
			return route.fulfill({ status: 404, headers: CORS, body: '{"detail":"no fixture"}' });
		}
		return route.fulfill({
			status: recorded.status,
			headers: { ...CORS, 'content-type': recorded.type },
			body: wire(recorded)
		});
	});
}

/** Requests the page means for the API, matched on the path (and query) without the host. */
export const apiPath = (path: string | RegExp) =>
	typeof path === 'string'
		? `${API_ORIGIN}${path}`
		: (url: URL) => url.origin === API_ORIGIN && path.test(url.pathname + url.search);

/**
 * Lets the API fail for what matches `path`, as prod does: a 500 with the request_id the
 * API gives it, a 503 of the proxy, or a connection that breaks. Later routes win, so this
 * stands before the fixtures.
 */
export async function failApi(
	target: Page | BrowserContext,
	path: string | RegExp,
	how: 500 | 503 | 429 | 'offline',
	times?: number
) {
	const fail = (route: Route) =>
		how === 'offline'
			? route.abort('internetdisconnected')
			: route.fulfill({
					status: how,
					headers: {
						...CORS,
						'content-type': 'application/json',
						'x-request-id': REQUEST_ID,
						// The API's limit asks a wait; two seconds keeps a test short.
						...(how === 429 ? { 'retry-after': '2' } : {})
					},
					body: JSON.stringify(
						how === 500
							? { detail: 'Internal Server Error', request_id: REQUEST_ID }
							: how === 429
								? { detail: 'Rate limit exceeded. Try again later.' }
								: { detail: 'Service Unavailable' }
					)
				});
	await target.route(apiPath(path), fail, times ? { times } : undefined);
}

/** The request_id of a failing answer: the page shows its first eight characters. */
export const REQUEST_ID = '5e2a91c4d7b04f3e8a16c0d2b9e47f15';

/**
 * Answers `path` from its fixture, changed by `change`: for what the live API does not give
 * yet (a field still being filled), so the page can be tested with it.
 */
export async function patchApi(
	target: Page | BrowserContext,
	path: RegExp,
	change: (body: Record<string, unknown>) => Record<string, unknown>
) {
	await target.route(apiPath(path), async (route) => {
		const key = keyOf(route.request().url());
		const file = fileOf(key);
		const recorded =
			RECORD && !existsSync(file)
				? await record(key, file)
				: (JSON.parse(gunzipSync(readFileSync(file)).toString()) as Recorded);
		return route.fulfill({
			status: recorded.status,
			headers: { ...CORS, 'content-type': recorded.type },
			body: JSON.stringify(change(recorded.body as Record<string, unknown>))
		});
	});
}

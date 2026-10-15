// The API as it answered once, for a test that follows a bron through many requests: each
// answer is kept per request (path and params) in a fixture, cut to a few items per list so
// the fixture stays small. `OPNAME=1 npx vitest run <file>` asks the live API again and
// writes the fixture anew; without it the test reads the fixture and never the network.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fakeApi, fail, type FakeRequest } from './fakeApi';

const LIVE = 'https://concordans.nl';
/** The items of a list kept: enough for every group to show rows, small enough to read. */
const ITEMS = 4;

/** Whether this run records the live API. */
export const OPNAME = !!process.env.OPNAME;

/** A request as its fixture key: the path with its params, the params sorted. */
function keyOf(r: Pick<FakeRequest, 'path' | 'params'>): string {
	const sorted = (o: Record<string, unknown> = {}) =>
		Object.fromEntries(
			Object.entries(o)
				.filter(([, v]) => v !== undefined)
				.sort(([a], [b]) => a.localeCompare(b))
		);
	return `${r.path} ${JSON.stringify(sorted(r.params.path))} ${JSON.stringify(sorted(r.params.query))}`;
}

function urlOf(r: FakeRequest): string {
	const path = r.path.replace(/\{(\w+)\}/g, (_, k: string) =>
		encodeURIComponent(String(r.params.path?.[k] ?? ''))
	);
	const query = new URLSearchParams();
	for (const [k, v] of Object.entries(r.params.query ?? {})) {
		if (v === undefined) continue;
		for (const one of Array.isArray(v) ? v : [v]) query.append(k, String(one));
	}
	const q = query.toString();
	return `${LIVE}${path}${q ? `?${q}` : ''}`;
}

/** Every list cut to its first few items, at any depth. */
const cut = (v: unknown): unknown =>
	Array.isArray(v)
		? v.slice(0, ITEMS).map(cut)
		: v && typeof v === 'object'
			? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, cut(x)]))
			: v;

/**
 * Answers every request of the API from the fixture at `file` (an absolute path), or, with
 * OPNAME, from the live API, cut, and keeps it there. The answers are written by `bewaar`.
 */
export function opname(file: string) {
	const answers: Record<string, unknown> = OPNAME
		? {}
		: (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>);
	const answer = async (r: FakeRequest) => {
		const key = keyOf(r);
		if (!OPNAME) {
			if (!(key in answers)) throw new Error(`opname: no answer for ${key}`);
			const a = answers[key];
			return a === null ? fail(404) : a;
		}
		const res = await fetch(urlOf(r));
		const data = res.ok ? cut(await res.json()) : null;
		if (!res.ok && res.status !== 404) throw new Error(`opname: ${res.status} for ${urlOf(r)}`);
		answers[key] = data;
		return data === null ? fail(404) : data;
	};
	// Every path, as the API has them.
	const routes = new Proxy({}, { has: () => true, get: () => answer });
	fakeApi(routes);
	return {
		bewaar() {
			if (!OPNAME) return;
			mkdirSync(dirname(file), { recursive: true });
			const sorted = Object.fromEntries(
				Object.entries(answers).sort(([a], [b]) => a.localeCompare(b))
			);
			writeFileSync(file, `${JSON.stringify(sorted, null, '\t')}\n`);
		}
	};
}

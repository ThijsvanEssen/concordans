// The numbers the API decides, held against its schema (openapi.json): the largest `limit`
// of each route, the first pages the warm-up warms (first-pages.json), the deadline of a
// request and the limit per visitor (code-eenvoud F118).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import spec from './openapi.json';
import pages from './first-pages.json';
import { limitMaxima } from './limit-maxima';
import { volledig } from './limits';
import { LUS, SLOW_TIMEOUT_MS } from './client';
import { CITED_BY_PAGE, CITED_BY_TOP } from './first-pages';

const maxima = limitMaxima(spec as never);
const SRC = join(process.cwd(), 'src');

/** Every source file of the app, without its tests and the generated types. */
function sources(dir = SRC): string[] {
	return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory()) return e.name === 'generated' ? [] : sources(path);
		return /\.(ts|svelte)$/.test(e.name) && !/\.test\.ts$/.test(e.name) ? [path] : [];
	});
}

/** The text of the call whose `(` stands at `open`, up to its own `)`. */
function callAt(text: string, open: number): string {
	let depth = 0;
	for (let i = open; i < text.length; i++) {
		if (text[i] === '(') depth++;
		else if (text[i] === ')' && --depth === 0) return text.slice(open, i);
	}
	return text.slice(open);
}

const GET = /\.GET\(\s*'(\/api\/[^']+)'/g;

/**
 * Each literal `limit` asked of a route: in its `.GET('/api/…')`, or in a call of an exported
 * helper whose body asks that one route. A name is read where one file sets it to a number.
 */
function literalLimits(): { file: string; path: string; limit: number }[] {
	const files = sources().map((file) => ({ file, text: readFileSync(file, 'utf8') }));
	const numbers = new Map<string, number>();
	for (const { text } of files)
		for (const m of text.matchAll(/\bconst ([A-Z][A-Z0-9_]*) = ([\d_]+);/g))
			numbers.set(m[1], Number(m[2].replaceAll('_', '')));
	const helpers = new Map<string, string>();
	for (const { text } of files) {
		const starts = [...text.matchAll(/^export (?:async )?(?:const|function) (\w+)/gm)];
		starts.forEach((m, i) => {
			const body = text.slice(m.index, starts[i + 1]?.index ?? text.length);
			const routes = new Set([...body.matchAll(GET)].map((g) => g[1]));
			if (routes.size === 1) helpers.set(m[1], [...routes][0]);
		});
	}
	const found: { file: string; path: string; limit: number }[] = [];
	const asked = (file: string, path: string, call: string) => {
		for (const m of call.matchAll(/\blimit: ([\w.]+)/g)) {
			const limit = /^\d+$/.test(m[1]) ? Number(m[1]) : numbers.get(m[1]);
			if (limit !== undefined) found.push({ file: file.slice(SRC.length + 1), path, limit });
		}
	};
	for (const { file, text } of files) {
		for (const m of text.matchAll(GET)) asked(file, m[1], callAt(text, text.indexOf('(', m.index)));
		for (const [name, path] of helpers)
			for (const m of text.matchAll(new RegExp(`\\b${name}\\(`, 'g')))
				asked(file, path, callAt(text, m.index + name.length));
	}
	return found;
}

describe('the largest limit of a route', () => {
	it('is read from the schema for every route with a page', () => {
		expect(maxima['/api/feed']).toBe(200);
		expect(maxima['/api/instruments/{bwb_id}/articles']).toBe(2000);
		expect(volledig('/api/feed')).toBe(maxima['/api/feed']);
	});

	it('is never passed by a literal limit', () => {
		const found = literalLimits();
		// The direct requests and the helpers both count (a scan that finds nothing tests nothing).
		expect(found.length).toBeGreaterThan(20);
		expect(found.filter((f) => !(f.limit <= (maxima[f.path] ?? Infinity)))).toEqual([]);
	});

	it('is asked by its name where a list is asked whole, never as a number', () => {
		const exact = literalLimits().filter((f) => f.limit === maxima[f.path]);
		// The instruments by their size are a first page of their own (first-pages.json).
		expect(exact.map((f) => f.file)).toEqual([]);
	});
});

describe('first-pages.json', () => {
	it('asks the cited-by pages Verbonden and the law network ask', () => {
		expect(pages.article_citations).toEqual([
			{ sort: 'date_desc', limit: CITED_BY_PAGE },
			{ sort: 'citation_count', limit: CITED_BY_PAGE },
			{ sort: 'citation_count', limit: CITED_BY_TOP }
		]);
	});

	it('asks every list a page as large as Bladeren asks', () => {
		const { instruments, documents, judgments } = pages.lists;
		expect([documents, judgments]).toEqual([instruments, instruments]);
		expect(pages.instrument_names.sort).toBe('article_count');
	});

	it('asks no page larger than the API gives', () => {
		const asked: [string, number][] = [
			...pages.article_citations.map(
				(p) => ['/api/articles/{bwb_id}/{article_number}/cited-by', p.limit] as [string, number]
			),
			['/api/instruments/{bwb_id}/judgments', pages.law_judgments],
			['/api/instruments', pages.instrument_names.limit],
			['/api/instruments', pages.lists.instruments],
			['/api/documents', pages.lists.documents],
			['/api/judgments', pages.lists.judgments],
			['/api/feed', pages.lists.feed],
			['/api/feed/summary', pages.home_summary.limit]
		];
		expect(asked.filter(([path, limit]) => !(limit <= maxima[path]))).toEqual([]);
	});
});

describe('the info of the schema', () => {
	const info = spec.info as {
		'x-request-timeout-ms': number;
		'x-rate-limit': { calls: number; period_seconds: number };
	};

	it('lets a slow request wait as long as the API does', () => {
		expect(SLOW_TIMEOUT_MS).toBeGreaterThanOrEqual(info['x-request-timeout-ms']);
	});

	it('stops a loop while developing before the API refuses it', () => {
		const { calls, period_seconds } = info['x-rate-limit'];
		expect(LUS.max).toBeLessThan(calls);
		expect(LUS.ms).toBeLessThanOrEqual(period_seconds * 1000);
	});
});

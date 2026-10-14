import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { SPA_ROUTES, canonical, routeKop, routePath } from './routes';
import { LADEN_TITEL, siteTitle } from './kop.svelte';

/** Every +page.svelte under src/routes, with its route id as SvelteKit gives it. */
const PAGES = readdirSync('src/routes', { recursive: true, encoding: 'utf8' })
	.filter((f) => f.endsWith('+page.svelte'))
	.map((file) => {
		const dir = dirname(file);
		return { file: `src/routes/${file}`, id: dir === '.' ? '/' : `/${dir}` };
	});

describe('routePath', () => {
	it('leaves the groups out of a route id', () => {
		expect(routePath('/(main)')).toBe('/');
		expect(routePath('/(main)/actueel')).toBe('/actueel');
		expect(routePath('/(main)/(prose)/over')).toBe('/over');
		expect(routePath('/(main)/onderwerpen/overzicht')).toBe('/onderwerpen/overzicht');
		expect(routePath('/explore')).toBe('/explore');
	});
});

describe('spa-routes.json', () => {
	it('lists every page, and only pages, so the server serves no 404 for a page', () => {
		expect(SPA_ROUTES.map((r) => r.path).sort()).toEqual(PAGES.map((p) => routePath(p.id)).sort());
	});

	it('gives each page under (main) its head from its own route id, with RouteKop', () => {
		for (const { file, id } of PAGES.filter((p) => p.id.startsWith('/(main)'))) {
			expect(() => routeKop(routePath(id)), file).not.toThrow();
			const source = readFileSync(file, 'utf8');
			expect(source, file).toMatch(/<RouteKop\b/);
			expect(source, file).not.toMatch(/<RouteKop[^>]*\bpad=/);
		}
	});

	it('has a title and a description for each, without em-dashes', () => {
		for (const r of SPA_ROUTES) {
			expect(r.title).toMatch(/Concordans/);
			expect(r.description.length).toBeGreaterThan(20);
			expect(r.description.length).toBeLessThanOrEqual(160);
			expect(`${r.title} ${r.description}`).not.toMatch(/—/);
		}
	});

	it('names the site after the page, the same way everywhere', () => {
		expect(siteTitle('Actueel')).toBe('Actueel, Concordans');
		expect(LADEN_TITEL).toBe(siteTitle('Laden…'));
		expect(routeKop('/actueel').title).toBe(siteTitle('Actueel'));
	});

	it('gives the canonical address without the view state', () => {
		const c = (u: string) => canonical(new URL(u, 'https://concordans.nl'));
		expect(c('/wetten/BWBR0005289/artikel/6:162?lezen=1&netwerk=a')).toBe(
			'https://concordans.nl/wetten/BWBR0005289/artikel/6:162'
		);
		expect(c('/explore?mode=index&kind=ministers')).toBe('https://concordans.nl/explore');
		expect(c('/explore?focus=decisions/decision_1&lezen=1')).toBe(
			'https://concordans.nl/explore?focus=decisions/decision_1'
		);
	});
});

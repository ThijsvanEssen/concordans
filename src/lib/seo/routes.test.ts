import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { SPA_ROUTES, canonical } from './routes';

/** The paths of the pages under src/routes, groups like (main) left out. */
function pages(dir = 'src/routes', path = ''): string[] {
	const uit: string[] = [];
	for (const naam of readdirSync(dir)) {
		const vol = join(dir, naam);
		if (statSync(vol).isDirectory()) {
			const deel = /^\(.*\)$/.test(naam) ? '' : `/${naam}`;
			uit.push(...pages(vol, path + deel));
		} else if (naam === '+page.svelte') uit.push(path || '/');
	}
	return uit;
}

describe('spa-routes.json', () => {
	it('lists every page, and only pages, so the server serves no 404 for a page', () => {
		expect(SPA_ROUTES.map((r) => r.path).sort()).toEqual(pages().sort());
	});

	it('has a title and a description for each, without em-dashes', () => {
		for (const r of SPA_ROUTES) {
			expect(r.title).toMatch(/Concordans/);
			expect(r.description.length).toBeGreaterThan(20);
			expect(r.description.length).toBeLessThanOrEqual(160);
			expect(`${r.title} ${r.description}`).not.toMatch(/—/);
		}
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

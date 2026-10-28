import { describe, expect, it, vi } from 'vitest';
import { readFileSync, writeFileSync } from 'node:fs';
import type { Component } from 'svelte';
import { render } from 'svelte/server';
import { SPA_ROUTES, routePath } from './routes';

const route = vi.hoisted(() => ({ id: '' }));
vi.mock('$app/state', () => ({ page: { route, url: new URL('https://concordans.nl/') } }));

// The text of the fixed pages as the server puts it in <main id="seo"> (the pages of
// spa-routes.json that are prose): rendered from the page itself, so there is no second copy
// to keep. One source for the server, which reads the built copy, spa-texts.json next to
// index.html, as it reads spa-routes.json. spa-texts.test.ts keeps the file equal to the pages.

/** The page's markup as plain text structure: headings, paragraphs, lists, tables and links. */
function serverText(html: string): string {
	return (
		html
			.replace(/<!--[\s\S]*?-->/g, '')
			// Controls and scripts are the app's, not the text's.
			.replace(/<(button|script|style|svg|form|input|select|textarea)\b[\s\S]*?<\/\1>/g, '')
			.replace(/<(input|img|br|hr)\b[^>]*>/g, '')
			// Wrappers of the layout: the text is what stands in them.
			.replace(/<\/?(div|header|section|span|small)\b[^>]*>/g, ' ')
			// Every attribute but where a link goes.
			.replace(
				/<(\w+)((?:\s+[^\s=>]+(?:="[^"]*")?)*)\s*\/?>/g,
				(_all, tag: string, attrs: string) => {
					const href = /\shref="([^"]*)"/.exec(attrs)?.[1];
					return `<${tag}${href ? ` href="${href}"` : ''}>`;
				}
			)
			.replace(/\s+/g, ' ')
			.replace(/(<\/?(?:h[1-6]|p|ul|ol|li|nav|table|tr|td|th|dl|dt|dd)>) /g, '$1')
			.replace(/ (<\/?(?:h[1-6]|p|ul|ol|li|nav|table|tr|td|th|dl|dt|dd)>)/g, '$1')
			.trim()
	);
}

const FILE = 'src/lib/seo/spa-texts.json';
/** The prose pages: the fixed text of these is what the server puts in main#seo. */
const PROSE = /\(prose\)|\/docs\/(methode|sneltoetsen)\//;
const PAGES = import.meta.glob('/src/routes/**/+page.svelte');

async function rendered(): Promise<Record<string, string>> {
	const texts: Record<string, string> = {};
	for (const [file, load] of Object.entries(PAGES).filter(([f]) => PROSE.test(f))) {
		route.id = file.replace('/src/routes', '').replace('/+page.svelte', '');
		const page = (await load()) as { default: Component };
		texts[routePath(route.id)] = serverText(render(page.default, { props: {} }).body);
	}
	return Object.fromEntries(Object.entries(texts).sort(([a], [b]) => a.localeCompare(b)));
}

describe('spa-texts.json', () => {
	it('is the text of the prose pages (npm run sync:seo-tekst after changing one)', async () => {
		const texts = await rendered();
		if (process.env.SYNC_SEO_TEKST) writeFileSync(FILE, `${JSON.stringify(texts, null, '\t')}\n`);
		expect(JSON.parse(readFileSync(FILE, 'utf8'))).toEqual(texts);
	});

	it('holds a title and the text for each of the six pages, and only for pages of the list', async () => {
		const texts = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, string>;
		expect(Object.keys(texts)).toEqual([
			'/bronnen',
			'/docs/methode',
			'/docs/sneltoetsen',
			'/over',
			'/privacy',
			'/voorwaarden'
		]);
		for (const [path, html] of Object.entries(texts)) {
			expect(SPA_ROUTES.map((r) => r.path)).toContain(path);
			expect(html.match(/<h1>/g)).toHaveLength(1);
			expect(html.length).toBeGreaterThan(500);
			expect(html).not.toMatch(/class=|<!--|<script|<button/);
		}
	});
});

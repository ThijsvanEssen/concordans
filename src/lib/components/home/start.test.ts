// The start page as the server writes it (home.py of the API, copied by `npm run
// sync:start`) and as the app shows it: the same text and links, from start.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { START } from './start';

const SERVER = readFileSync(
	join(process.cwd(), 'src/lib/components/home/start-server.html'),
	'utf8'
);

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#x27': "'" };
const text = (html: string) =>
	html.replace(/<[^>]+>/g, '').replace(/&(amp|lt|gt|quot|#x27);/g, (_, e) => ENTITIES[e]);
/** The inner HTML of each element with this tag (and class) in *html*, in order. */
const all = (html: string, tag: string, cls?: string) =>
	[
		...html.matchAll(
			new RegExp(`<${tag}\\b[^>]*${cls ? `class="${cls}"` : ''}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
		)
	].map((m) => m[1]);
const links = (html: string) =>
	[...html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/g)].map((m) => ({
		href: text(m[1]),
		label: text(m[2])
	}));

describe('the start page of the server and of the app', () => {
	it('has the heading, the lede and the search field of start.json', () => {
		expect(text(all(SERVER, 'h1')[0])).toBe(START.heading);
		expect(text(all(SERVER, 'p', 'lede')[0])).toBe(START.lede);
		expect(SERVER).toContain(`placeholder="${START.placeholder}"`);
		// A form that works without scripts: /?q=, which the app reads into its field.
		expect(SERVER).toMatch(/<form action="\/" method="get"[^>]*><input type="search" name="q"/);
	});

	it('has the three features, each a picture and its line, in the same order', () => {
		const items = all(SERVER, 'li');
		expect(
			items.slice(0, START.features.length).map((li) => text(all(li, 'span', 'onderschrift')[0]))
		).toEqual(START.features.map((x) => x.text));
		expect(items.map((li) => /class="beeld beeld--(\w+)"/.exec(li)?.[1])).toEqual(
			START.features.map((x) => x.visual)
		);
	});

	it('has the three questions, each with its sentence and its way in', () => {
		const { questions } = START;
		expect(all(SERVER, 'h2').map(text)).toEqual([questions.heading]);
		const tiles = all(SERVER, 'section', 'vraag');
		expect(tiles.map((t) => text(all(t, 'h3')[0]))).toEqual(questions.items.map((q) => q.title));
		expect(tiles.map((t) => text(all(t, 'p')[0]))).toEqual(questions.items.map((q) => q.text));
		expect(tiles.flatMap(links)).toEqual(
			questions.items.map((q) => ({ href: q.href, label: q.linkLabel }))
		);
	});
});

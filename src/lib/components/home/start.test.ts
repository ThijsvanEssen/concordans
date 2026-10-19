// The start page as the server writes it (home.py of the API, copied by `npm run
// sync:start`) and as the app shows it: the same text and links, from start.json.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCollection } from '$lib/vocabulary';
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
const section = (key: string) =>
	new RegExp(`<section[^>]*aria-labelledby="entrance-${key}"[^>]*>([\\s\\S]*?)</section>`).exec(
		SERVER
	)?.[1] ?? '';

describe('the start page of the server and of the app', () => {
	it('has the heading, the lead and the search field of start.json', () => {
		expect(text(all(SERVER, 'h1')[0])).toBe(START.heading);
		expect(text(all(SERVER, 'p', 'lead')[0])).toBe(START.lead);
		expect(SERVER).toContain(`placeholder="${START.placeholder}"`);
		// A form that works without scripts: /?q=, which the app reads into its field.
		expect(SERVER).toMatch(/<form action="\/" method="get"[^>]*><input type="search" name="q"/);
	});

	it('has the three ways in, in the same order and under the same names', () => {
		const names = all(SERVER, 'h2').map(text);
		expect(names).toEqual([START.article.heading, START.vote.heading, START.bundle.heading]);
	});

	it('links the article and its parts as the card does', () => {
		const { article } = START;
		expect(links(section('article'))).toEqual([
			{ href: article.href, label: article.title },
			...article.parts.map((p) => ({
				href: `${article.href}?bronnen=${p.bronnen}`,
				label: p.label
			}))
		]);
	});

	it('shows the vote as the card does: title, date, outcome and the parties per side', () => {
		const { vote } = START;
		const html = section('vote');
		expect(links(html)).toEqual([{ href: vote.href, label: vote.title }]);
		expect(text(all(html, 'p', 'meta')[0])).toBe(vote.date);
		expect(text(all(html, 'p', 'outcome')[0])).toBe(`${vote.outcome}, ${vote.tally}`);
		// Voor first, then Tegen: app.html marks the sides in that order.
		expect(all(html, 'dt').map(text)).toEqual(['Voor', 'Tegen']);
		expect(all(html, 'dt').map(text)).toEqual(vote.sides.map((s) => s.choice));
		expect(all(html, 'dd').map(text)).toEqual(vote.sides.map((s) => s.parties));
	});

	it('links the bundel and its lines to their readable addresses, with its note', () => {
		const { bundle } = START;
		const html = section('bundle');
		expect(links(html)).toEqual([
			{ href: bundle.href, label: bundle.title },
			...bundle.lines.map(({ href, label }) => ({ href, label }))
		]);
		expect(html).toContain(`<li>${bundle.noteLabel}: <em>${bundle.note}</em></li>`);
	});

	it('marks each line with the kind of what it opens', () => {
		const kinds = [...START.article.parts, ...START.bundle.lines].map((l) => l.collection);
		expect(kinds.every(isCollection)).toBe(true);
	});
});

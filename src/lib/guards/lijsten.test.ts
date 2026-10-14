// A list page: its choose-line, its facets and its period, and the feed of Actueel and Gevolgd.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek } from '$lib/test/bronnen';

describe('list pages and the feed', () => {
	it('sets the choose-line of a list page with Bepaalregel (docs/bediening.md)', () => {
		const lijsten = [
			'lib/components/explore/IndexView.svelte',
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/overzicht/+page.svelte'
		];
		expect(lijsten.filter((p) => !bron(p).includes('<Bepaalregel'))).toEqual([]);
	});

	it('asks the facets of an index list by faceted, and builds its period once (code-eenvoud F47)', () => {
		const index = bron('lib/components/explore/IndexView.svelte');
		// The stemmingen are counted through $lib/api/decisions (geteld), which waits for the count.
		expect(index).not.toMatch(/api\.GET\([^)]*facets: true/s);
		expect(index.match(/id: 'period'/g)).toHaveLength(1);
	});

	it('says why a row of the feed is there by one rule, on Actueel and Gevolgd alike (pakket H)', () => {
		// The words asked for (`q`) are marked where the row shows them, else the line under it
		// says where they are (`In dossier: …`): FeedDay through $lib/text/treffer. Every page
		// with FeedDay passes its words, so a search in Actueel reads as a followed topic does.
		const pages = BRONNEN.filter(({ text }) => /<FeedDay\b/.test(text));
		expect(pages.map((s) => s.path).sort()).toEqual([
			'routes/(main)/actueel/+page.svelte',
			'routes/(main)/onderwerpen/+page.svelte'
		]);
		for (const { text } of pages)
			expect(/<FeedDay\b[\s\S]*?\/>/.exec(text)?.[0]).toMatch(/\btermen\b/);
		const day = bron('lib/components/actueel/FeedDay.svelte');
		expect(day).toMatch(/\btermen: readonly string\[\]/);
		expect(day).toMatch(/plekVan\(/);
		// One rule for the words: woordIn and markeer live in treffer.ts alone.
		expect(
			overtreders(
				(t) => /export function (woordIn|markeer)\b/.test(t),
				[plek('lib/text/treffer.ts')]
			)
		).toEqual([]);
	});

	it('wires the feed of Actueel and Gevolgd once (code-eenvoud F53)', () => {
		// A ministry by its name from ministries.svelte.ts, a fractie's colour in FeedDay, the Atom link
		// from feed.ts and "Doorzocht vanaf" from Doorzocht.svelte: no page keeps its own copy.
		expect(overtreders((t) => /ministries\.find\(/.test(t))).toEqual([]);
		expect(
			overtreders((t) => /\/api\/feed\.atom/.test(t), [plek('lib/components/actueel/feed.ts')])
		).toEqual([]);
		expect(
			overtreders(
				(t) => /Doorzocht vanaf \{/.test(t),
				[plek('lib/components/actueel/Doorzocht.svelte')]
			)
		).toEqual([]);
		expect(overtreders((t) => /<FeedDay\b[^>]*\b(colorOf|ministryName)=?/.test(t))).toEqual([]);
	});
});

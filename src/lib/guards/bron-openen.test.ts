// How a bron opens from a click: one click opens in place, the bron is a step further.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek, type Uitzondering } from '$lib/test/bronnen';

describe('opening a bron', () => {
	it('opens a bron from a click by one rule, $lib/bron/href.ts openHref', () => {
		// Every bron opens in Tekst (besluit 32). A link forced to the werkplek is one that says
		// so: In het netwerk, under the drawing of Netwerk tonen or on an opened row.
		const netwerkLinks: Uitzondering[] = [
			{ pad: 'lib/bron/href.ts', reden: 'the rule itself' },
			{ pad: 'lib/verbonden/VerbondenTabel.svelte', reden: 'In het netwerk of an opened row' },
			{ pad: 'lib/components/open/PostOpen.svelte', reden: 'In het netwerk of a bewindspersoon' },
			{ pad: 'routes/explore/+page.svelte', reden: 'In het netwerk under Netwerk tonen, key L' }
		];
		expect(overtreders((t) => /mode: 'graph'/.test(t), netwerkLinks)).toEqual([]);
	});

	it('opens a row in place on one click, through the shared rule', () => {
		// A row whose title is a link to the bron (Actueel, the table) takes the click through
		// terPlekke ($lib/actions/klik), so a plain click opens the row and a cmd-click goes to
		// the bron. A row of Verbonden has no panel of actions (Thijs, 10 Oct): its title and the
		// row itself go to the bron in Netwerk; only a Kamerstuk opens in place, on its core text
		// (RijInhoud, as in Actueel and Bronnen; pakket C, 14 Oct).
		const rows = BRONNEN.filter(({ text }) =>
			/class="(row-title|row__title)"[\s\S]{0,240}(href=|\{href\})/.test(text)
		);
		expect(rows.length).toBeGreaterThan(0);
		expect(rows.filter(({ text }) => !text.includes('terPlekke')).map((s) => s.path)).toEqual([]);
		const verbonden = rows.find(({ path }) => path.endsWith('verbonden/VerbondenRow.svelte'))!;
		expect(verbonden.text).toMatch(/opentTerPlekke && terPlekke\(/);
	});

	it('opens a row of a list on the bron’s content, with Bewaar on the row (Thijs, 10 Oct)', () => {
		// One row for Actueel, Gevolgd and Bladeren (IndexRow): what opens is the content
		// (RijInhoud), the actions are RijActies on the row; no Lees or In het netwerk buttons.
		expect(bron('lib/components/explore/index/IndexRow.svelte')).toContain('<RijActies');
		expect(
			overtreders(
				(t) => /\/>Lees<\/a|>In het netwerk<\/a/.test(t),
				[plek('lib/components/open/OpenRij.svelte', 'In het netwerk of an opened row')]
			)
		).toEqual([]);
	});

	it('opens a clickable row by one rule, blockClick in $lib/actions/klik (F50, F81)', () => {
		// A row is marked data-rij; RijActies only looks for its row. The timeline keeps rowClick.
		expect(
			overtreders((t) => /\sdata-rij[\s>]/.test(t) && !/use:blockClick|rowClick\(/.test(t))
		).toEqual([]);
	});
});

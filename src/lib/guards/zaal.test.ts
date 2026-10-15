// The seats of a cabinet and the places of a hall, said once.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders } from '$lib/test/bronnen';

describe('the hall', () => {
	it('says the seats of a cabinet once, on the Kamer’s whole scale (Thijs, 12 Oct)', () => {
		const t = bron('lib/components/explore/readers/KamerZetels.svelte');
		// The majority's line on the scale of zetelHoogte, none to all seats: no scale of its own.
		expect(t).toMatch(/zetelHoogte\([^)]*\bzetelsVanKamer\b/);
		expect(t).not.toMatch(/Math\.(min|max)\(\.\.\.v/);
		// The head figure states the totals: no second sentence or bar of the two sides.
		expect(t).not.toMatch(/<Meerderheid\b|class="aantal"/);
		// Uncertain once, with the count.
		expect(t.match(/['"`]\s*\(onzeker\)['"`]/g)).toHaveLength(1);
		expect(t).not.toContain('de zetels zijn onzeker');
		// The Eerste Kamer's hall always with its seats: today's plan, else the day's by fractie.
		expect(t).toContain('hallOfDay(');
		expect(bron('lib/components/explore/readers/zetels.ts')).toMatch(
			/export async function hallOfDay[\s\S]*?zaalMetPlan\(/
		);
		expect(t).toContain('<ZaalTegenover data={zaal}');
		expect(bron('lib/components/explore/ZaalTegenover.svelte')).toContain('plaatsenOpVolgorde(');
		// A hall drawn by fractie is marked by its date, alike on both pages of the hall.
		for (const pad of [
			'lib/components/explore/readers/KamerZetels.svelte',
			'lib/components/explore/index/rows/FactionsHall.svelte'
		])
			expect(bron(pad)).toContain('indelingMarkering(');
	});

	it('sets the places of a hall on one line at the left, in ZaalPlaatsen', () => {
		expect(overtreders((t) => /<p class="(sleutel|pl)"/.test(t) && /Voorzitter/.test(t))).toEqual(
			[]
		);
		const zaal = ['ZaalLegenda', 'ZaalPlaatsen', 'Hemicycle'].map(
			(n) => `lib/components/explore/${n}.svelte`
		);
		expect(
			BRONNEN.filter((s) => zaal.includes(s.path))
				.filter((s) => /margin:[^;]*\bauto\b|text-align:\s*center/.test(s.text))
				.map((s) => s.path)
		).toEqual([]);
	});

	it('lets the legend of the hall stand for the fracties of both Kamers (Thijs, 16 Oct)', () => {
		// One hall with one legend for the Tweede and the Eerste Kamer alike.
		const hall = bron('lib/components/explore/index/rows/FactionsHall.svelte');
		expect(hall.match(/<ZaalLegenda\b/g)).toHaveLength(1);
		// The legend is what the list was: each fractie opens in place, its members and its
		// vacancies marked where they differ from its seats.
		const legend = bron('lib/components/explore/ZaalLegenda.svelte');
		expect(legend).toContain('openHref(');
		expect(legend).toMatch(/\bvacant\b/);
		expect(legend).toMatch(/count\([^)]*'lid', 'leden'\)/);
		// The source in full: no line cut off.
		expect(legend.match(/\.peil \{[^}]*\}/)?.[0]).not.toMatch(/ellipsis|nowrap/);
		// The list under the hall only where it shows more than the legend.
		const list = bron('lib/components/explore/index/lists/factions.ts');
		expect(list).toMatch(/rowsShown:/);
		expect(bron('lib/components/explore/IndexView.svelte')).toContain('list.rowsShown');
		// Without the rows no rule of a list under the hall; while the hall loads, its place.
		expect(bron('lib/components/explore/IndexView.svelte')).toMatch(
			/\{#if rowsShown\}<div class="result-head">/
		);
		expect(hall).toMatch(/hemi-card--loading[\s\S]*?class="sr-only" role="status">Laden…/);
		// No name cut off; the whole row is the link, a finger's height.
		expect(legend.match(/\.n \{[^}]*\}/)?.[0]).not.toMatch(/ellipsis|nowrap/);
		expect(legend).toMatch(/\.entry \{[^}]*min-height: var\(--veld-h\)/);
		// A share of the seats of the Kamer, not of the rows a search leaves.
		expect(bron('lib/components/explore/index/rows/FactionRows.svelte')).not.toMatch(
			/rows[^\n]*reduce\([^\n]*seats/
		);
	});
});

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
			'lib/components/explore/IndexView.svelte'
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
});

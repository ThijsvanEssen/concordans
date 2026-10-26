import { describe, expect, it, vi } from 'vitest';
import { OTHER_TIERS, citingTiers, eenInstantie, lawTiers, tierParts, vormVanTier } from './tiers';

const facet = [
	{ value: 'rechtbank', count: 60 },
	{ value: 'gerechtshof', count: 20 },
	{ value: 'parket', count: 4 },
	{ value: 'hoge_raad', count: 6 },
	{ value: 'raad_van_state', count: 5 },
	{ value: 'ehrm', count: 2 },
	{ value: 'hvj_eu', count: 3 },
	{ value: null, count: 5 }
];
vi.mock('$lib/api/articles', () => ({
	getCitedByTop: () => Promise.resolve({ facets: { tier: facet } })
}));
vi.mock('$lib/api/verbonden', () => ({
	getInstrumentJudgments: () => Promise.resolve({ facets: { tier: facet } })
}));

describe('the judgments per instantie', () => {
	it('orders the highest rechter first, the Europese hoven after the Dutch, the rest last', () => {
		const parts = tierParts(facet, 105);
		expect(parts.map((d) => [d.label, d.count])).toEqual([
			['Hoge Raad', 10],
			['Raad van State', 5],
			['Gerechtshoven', 20],
			['Rechtbanken', 60],
			['EHRM', 2],
			['Hof van Justitie EU', 3],
			[OTHER_TIERS, 5]
		]);
		expect(parts.map((d) => [d.trap, d.europa])).toEqual([
			[1, false],
			[2, false],
			[3, false],
			[4, false],
			[1, true],
			[2, true],
			[null, false]
		]);
	});

	it('leaves out a part of none, and no rest where the parts fill the total', () => {
		const parts = tierParts(
			[
				{ value: 'gerechtshof', count: 3 },
				{ value: 'rechtbank', count: 2 }
			],
			5
		);
		expect(parts.map((d) => d.label)).toEqual(['Gerechtshoven', 'Rechtbanken']);
	});

	it('counts the Parket with the Hoge Raad, as the filter Rechter does', () => {
		expect(tierParts([{ value: 'parket', count: 890 }], 890)[0]).toMatchObject({
			label: 'Hoge Raad',
			count: 890
		});
	});

	it('counts an article and a law from the tier facet, the rest of the total as Overige', async () => {
		expect((await citingTiers('BWBR1', '300', 105)).at(-1)).toMatchObject({ count: 5 });
		expect((await lawTiers('BWBR1', 105)).at(-1)).toMatchObject({ label: OTHER_TIERS });
	});

	it('knows the vlak of a judgment by its tier', () => {
		expect(vormVanTier('rechtbank')).toEqual({ trap: 4, europa: false });
		expect(vormVanTier('hvj_eu')).toEqual({ trap: 2, europa: true });
		expect(vormVanTier('kantongerecht')).toEqual({ trap: null, europa: false });
		expect(vormVanTier(undefined)).toEqual({ trap: null, europa: false });
	});

	it('says in a line where one instantie is all there is', () => {
		expect(eenInstantie(tierParts([{ value: 'hoge_raad', count: 3 }], 3))).toBe(
			'Alle drie van de Hoge Raad'
		);
		expect(eenInstantie(tierParts([{ value: 'ehrm', count: 1 }], 1))).toBe('De enige van het EHRM');
		expect(eenInstantie(tierParts(facet, 105))).toBeNull();
		expect(eenInstantie(null)).toBeNull();
	});
});

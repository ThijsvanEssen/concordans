import { describe, expect, it, vi } from 'vitest';
import { OTHER_TIERS, citingTiers, lawTiers, tierParts } from './tiers';

const asked: string[][] = [];
vi.mock('$lib/api/verbonden', () => ({
	getCitingJudgmentsOfTier: (_b: string, _n: string, tiers: string[]) => {
		asked.push([...tiers]);
		return Promise.resolve(tiers.length);
	},
	getInstrumentJudgments: () =>
		Promise.resolve({
			facets: {
				tier: [
					{ value: 'rechtbank', count: 60 },
					{ value: 'gerechtshof', count: 20 },
					{ value: 'parket', count: 4 },
					{ value: 'hoge_raad', count: 6 },
					{ value: 'raad_van_state', count: 5 },
					{ value: null, count: 5 }
				]
			}
		})
}));

describe('the judgments per instantie', () => {
	it('counts the rest of the total as Overige instanties', () => {
		expect(tierParts([199, 2337, 6507], 10385).map((d) => [d.label, d.count])).toEqual([
			['Hoge Raad', 199],
			['Gerechtshoven', 2337],
			['Rechtbanken', 6507],
			[OTHER_TIERS, 1342]
		]);
	});

	it('leaves out a part of none, and no rest where the parts fill the total', () => {
		expect(tierParts([0, 3, 2], 5).map((d) => d.label)).toEqual(['Gerechtshoven', 'Rechtbanken']);
	});

	it('counts the conclusions of the Parket with the Hoge Raad, as the filter Rechter does', async () => {
		const parts = await citingTiers('BWBR1', '300', 10);
		expect(asked).toContainEqual(['hoge_raad', 'parket']);
		expect(parts[0]).toMatchObject({ label: 'Hoge Raad', count: 2 });
	});

	it('counts a law from the tier facet, the Parket with the Hoge Raad, the rest of the total as Overige', async () => {
		const parts = await lawTiers('BWBR1', 100);
		expect(parts.map((d) => [d.label, d.count])).toEqual([
			['Hoge Raad', 10],
			['Gerechtshoven', 20],
			['Rechtbanken', 60],
			[OTHER_TIERS, 10]
		]);
	});
});

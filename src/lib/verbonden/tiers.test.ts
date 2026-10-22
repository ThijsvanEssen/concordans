import { describe, expect, it } from 'vitest';
import { OTHER_TIERS, tierParts } from './tiers';

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
});

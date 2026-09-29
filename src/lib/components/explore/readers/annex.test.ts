import { describe, expect, it } from 'vitest';
import { annexGroups } from './annex';

describe('annexGroups', () => {
	it('groups the entries under their heading in their own order, nested by parent', () => {
		const groups = annexGroups([
			{ index: 0, name: 'a. artikel 38', heading: 'Archiefwet 1995' },
			{ index: 1, name: 'a. Boek 1:', heading: 'Burgerlijk Wetboek' },
			{ index: 2, name: '1. artikel 7', heading: 'Burgerlijk Wetboek', parent_index: 1 },
			{ index: 3, name: 'b. Boek 2', heading: 'Burgerlijk Wetboek' },
			{ index: 4, name: 'a. artikel 3', heading: 'Tegen een besluit van de Dienst' },
			{ index: 5, name: 'a. Boek 8', heading: 'Burgerlijk Wetboek', description: 'titel 6' }
		]);
		expect(groups.map((g) => [g.heading, g.items.map((i) => i.name)])).toEqual([
			['Archiefwet 1995', ['a. artikel 38']],
			['Burgerlijk Wetboek', ['a. Boek 1:', 'b. Boek 2']],
			['Tegen een besluit van de Dienst', ['a. artikel 3']],
			['Burgerlijk Wetboek', ['a. Boek 8']]
		]);
		expect(groups[1].items[0].children.map((c) => c.name)).toEqual(['1. artikel 7']);
		expect(groups[3].items[0].note).toBe('titel 6');
	});

	it('keeps entries without a heading together', () => {
		expect(
			annexGroups([
				{ index: 0, name: 'x' },
				{ index: 1, name: 'y' }
			])
		).toEqual([
			{
				heading: null,
				items: [
					{ name: 'x', note: null, children: [] },
					{ name: 'y', note: null, children: [] }
				]
			}
		]);
	});
});

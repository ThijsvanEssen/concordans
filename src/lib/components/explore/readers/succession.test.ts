import { describe, expect, it } from 'vitest';
import {
	partRows,
	successionName,
	successionSources,
	successionStatus,
	type Succession
} from './succession';
import { newSv, oldSv } from '$lib/fixtures/succession';

const sv = { citationTitle: 'Wetboek van Strafvordering', shortTitle: 'Sv' };

describe('successionName', () => {
	it('cites the new code under the old title by the old short title, marked new', () => {
		expect(successionName(newSv, sv, 'new')).toBe('art. 2.8.6 Sv (nieuw)');
	});

	it('cites the old article by its own short title', () => {
		expect(
			successionName(oldSv, { citationTitle: sv.citationTitle, shortTitle: null }, 'old')
		).toBe('art. 126ffa Sv');
	});

	it('cites a law with a title of its own by that title', () => {
		const other: Succession = {
			...newSv,
			article: {
				...newSv.article,
				instrument: { ...newSv.article.instrument!, citation_title: 'Omgevingswet' }
			}
		};
		expect(successionName(other, sv, 'new')).toBe('art. 2.8.6 Omgevingswet');
	});
});

describe('successionStatus', () => {
	it('says a law that is not in force yet is not', () => {
		expect(successionStatus(newSv)).toBe('vastgesteld, nog niet in werking');
	});

	it('says nothing of a law in force', () => {
		expect(successionStatus(oldSv)).toBeNull();
	});
});

describe('partRows', () => {
	it('puts the leden that go to one place in one row', () => {
		expect(partRows(newSv.parts)).toEqual([
			{ old: 'leden 1, 2 en 3', place: '2.8.6, 1' },
			{ old: 'lid 4', place: '2.8.6, 2' }
		]);
	});

	it('has no rows for a whole article that goes to one place', () => {
		expect(partRows([{ old_part: '', new_place: '2.1.10' }])).toEqual([]);
	});
});

describe('successionSources', () => {
	it('names each table once', () => {
		expect(successionSources([newSv, newSv])).toEqual([
			'https://zoek.officielebekendmakingen.nl/blg-1081574.html'
		]);
	});
});

import { describe, expect, it } from 'vitest';
import { LOWER_TIERS, areaLine, areaParam, areaQuery, rowHeadline, rowId } from './lower-courts';

const day = {
	total: 293,
	subject_areas: [
		{ value: 'Bestuursrecht', count: 151 },
		{ value: 'Civiel recht', count: 94 },
		{ value: 'Strafrecht', count: 48 }
	]
};

describe('de dagrij van de lagere rechtspraak', () => {
	it('noemt het aantal uitspraken, elk één keer', () => {
		expect(rowHeadline(day)).toBe('293 uitspraken');
		expect(rowHeadline({ total: 1, subject_areas: [] })).toBe('1 uitspraak');
	});

	it('zet de grootste rechtsgebieden onder de rij en telt de rest', () => {
		expect(areaLine(day)).toBe('Bestuursrecht 151, civiel recht 94, strafrecht 48');
		const veel = {
			total: 9,
			subject_areas: ['a', 'b', 'c', 'd', 'e', 'f'].map((v, n) => ({ value: v, count: 6 - n }))
		};
		expect(areaLine(veel)).toBe('a 6, b 5, c 4, d 3 en 2 andere rechtsgebieden');
	});

	it('noemt een uitspraak zonder rechtsgebied onbekend en vraagt haar met none', () => {
		const geen = { total: 3, subject_areas: [{ value: null, count: 3 }] };
		expect(areaLine(geen)).toBe('onbekend 3');
		expect(areaParam({ value: null, count: 3 })).toBe('none');
	});

	it('vraagt de uitspraken van één day en één rechtsgebied, zonder facetten', () => {
		const q = areaQuery('2026-10-28', day.subject_areas[2], 3);
		expect(q).toMatchObject({
			tier: LOWER_TIERS,
			subject_area: 'Strafrecht',
			since: '2026-10-28',
			until: '2026-10-28',
			kind: 'uitspraak',
			facets: false,
			limit: 3
		});
		expect(q).not.toHaveProperty('cursor');
		expect(areaQuery('2026-10-28', day.subject_areas[2], 50, 'abc')).toHaveProperty(
			'cursor',
			'abc'
		);
	});

	it('noemt de rij in het adres per day', () => {
		expect(rowId('2026-10-28')).toBe('rechtspraak/2026-10-28');
	});
});

import { describe, expect, it } from 'vitest';
import { PERIOD_LABEL, seatedOnly } from './period';

describe('the period filter of a list', () => {
	it('is there for every list with dates, under the name of its date', () => {
		expect(PERIOD_LABEL).toEqual({
			instruments: 'In werking getreden',
			commitments: 'Gedaan',
			members: 'Actief',
			factions: 'Actief',
			committees: 'Actief',
			ministers: 'In functie'
		});
	});

	it('shows who sat in the period, not only the seats of today', () => {
		expect(seatedOnly(false, '', '')).toBe(true);
		expect(seatedOnly(false, '2020-01-01', '')).toBe(false);
		expect(seatedOnly(false, '', '2020-12-31')).toBe(false);
		expect(seatedOnly(true, '', '')).toBe(false);
	});
});

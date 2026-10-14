import { describe, expect, it } from 'vitest';
import { BOTH_CHAMBERS, CHAMBER_CHOICES, CHAMBER_OPTIONS, ekListSource } from './chamber';

describe('the Kamers as choices', () => {
	it('offers each Kamer by its name', () => {
		expect(CHAMBER_OPTIONS).toEqual([
			{ waarde: 'TK', label: 'Tweede Kamer' },
			{ waarde: 'EK', label: 'Eerste Kamer' }
		]);
	});

	it('offers both first, as a filter does', () => {
		expect(CHAMBER_CHOICES).toEqual([
			{ waarde: BOTH_CHAMBERS, label: 'Beide' },
			{ waarde: 'TK', label: 'Tweede Kamer' },
			{ waarde: 'EK', label: 'Eerste Kamer' }
		]);
	});
});

describe('ekListSource: a list of the Eerste Kamer names the site, not one row (#82)', () => {
	it('keeps the dates and the name of its rows, and links eerstekamer.nl', () => {
		const row = {
			url: 'https://www.eerstekamer.nl/persoon/prof_dr_e_b_van_apeldoorn_sp',
			composition_date: '2026-10-13',
			data_since: '2003-06-10',
			attribution: 'Eerste Kamer der Staten-Generaal, www.eerstekamer.nl'
		};
		expect(ekListSource(row)).toEqual({ ...row, url: 'https://www.eerstekamer.nl' });
	});
});

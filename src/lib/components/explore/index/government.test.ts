import { describe, expect, it } from 'vitest';
import { COMMITMENT_STATUSES, cabinetShortName, commitmentTeken, laterPosts } from './government';

describe('laterPosts', () => {
	it('keeps the counts with the longest post of each person', () => {
		// Rutte II: Blok was minister voor Wonen en Rijksdienst, and ad interim of JenV for ten days.
		const blokJenv = { member: { key: 'blok' }, from_date: '2015-03-10', to_date: '2015-03-20' };
		const blokWoRi = { member: { key: 'blok' }, from_date: '2012-11-05', to_date: '2017-10-26' };
		const steur = { member: { key: 'steur' }, from_date: '2015-03-20', to_date: '2017-01-27' };
		const later = laterPosts([blokJenv, steur, blokWoRi]);
		expect([...later]).toEqual([blokJenv]);
	});
});

describe('cabinetShortName', () => {
	it('says a cabinet by its own name', () => {
		expect(cabinetShortName('kabinet-Schoof')).toBe('Schoof');
		expect(cabinetShortName('Schoof')).toBe('Schoof');
	});
});

describe('commitmentTeken', () => {
	it('draws a toezegging kept as done, one dropped or broken as no, the rest as open', () => {
		expect(COMMITMENT_STATUSES.map((s) => [s, commitmentTeken(s)])).toEqual([
			['Openstaand', 'open'],
			['Afgedaan', 'ja'],
			['Nagekomen', 'ja'],
			['Deels Afgedaan', 'open'],
			['Niet nagekomen', 'nee'],
			['Vervallen', 'nee']
		]);
	});

	it('draws a state the Kamer adds later, or none, as open', () => {
		expect(commitmentTeken('Onbekend')).toBe('open');
		expect(commitmentTeken(null)).toBe('open');
	});
});

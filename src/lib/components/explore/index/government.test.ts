import { describe, expect, it } from 'vitest';
import { cabinetShortName, laterPosts, statusFromParam } from './government';

describe('statusFromParam', () => {
	it('reads a state as the Kamer writes it, and one of before API 0.48 as its word', () => {
		expect(statusFromParam('Nagekomen')).toBe('Nagekomen');
		expect(statusFromParam('open')).toBe('Openstaand');
		expect(statusFromParam('partly_done')).toBe('Deels Afgedaan');
		expect(statusFromParam(null)).toBeNull();
	});
});

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

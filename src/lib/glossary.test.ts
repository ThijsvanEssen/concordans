import { describe, expect, it } from 'vitest';
import { GLOSSARY, termOfKind } from './glossary';

const KINDS = [
	'Nota van wijziging (initiatiefvoorstel)',
	'Nota n.a.v. het (nader/tweede nader/enz.) verslag',
	'Nota naar aanleiding van het verslag',
	'Memorie van toelichting',
	'mvt',
	'Verslag',
	'Nader verslag',
	'Gewijzigd amendement',
	'Motie van het lid',
	'Initiatiefnota'
];

describe('termOfKind', () => {
	it('reads a kind of kamerstuk as the source words it', () => {
		expect(termOfKind('Nota van wijziging (initiatiefvoorstel)')).toBe('Nota van wijziging');
		expect(termOfKind('Nota n.a.v. het (nader/tweede nader/enz.) verslag')).toBe('Nota');
		expect(termOfKind('Nota naar aanleiding van het verslag')).toBe('Nota');
		expect(termOfKind('Memorie van toelichting')).toBe('MvT');
		expect(termOfKind('Verslag')).toBe('Verslag');
		expect(termOfKind('Gewijzigd amendement')).toBe('Amendement');
		expect(termOfKind('Initiatiefnota')).toBe('Initiatiefnota');
	});
	it('gives no term where the glossary has none', () => {
		expect(termOfKind('Memorie van antwoord')).toBeNull();
		expect(termOfKind('Verslag van een schriftelijk overleg')).toBeNull();
		expect(termOfKind('Brief regering')).toBeNull();
	});
	it('has an entry for every term it gives, and no entry it never gives', () => {
		const given = new Set(KINDS.map(termOfKind));
		for (const term of given) expect(term && GLOSSARY[term]).toBeTruthy();
		expect(Object.keys(GLOSSARY).sort()).toEqual([...given].sort());
	});
});

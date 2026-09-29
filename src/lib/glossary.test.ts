import { describe, expect, it } from 'vitest';
import { termOfKind } from './glossary';

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
});

import { describe, expect, it } from 'vitest';
import { kamerstukCitation, kamerstukLabel, sessionYear, withoutKamerstuk } from './kamerstuk';

describe('kamerstukCitation', () => {
	it('cites a paper of either Kamer with its vergaderjaar', () => {
		expect(
			kamerstukCitation({
				chamber: 'EK',
				session_year: '2025-2026',
				dossier_number: '36791',
				number: 'C'
			})
		).toBe('Kamerstukken I 2025/26, 36791, C');
		expect(
			kamerstukCitation({
				chamber: 'TK',
				session_year: '2025-2026',
				dossier_number: '36945',
				dossier_suffix: 'IV',
				number: '5'
			})
		).toBe('Kamerstukken II 2025/26, 36945 IV, nr. 5');
	});

	it('cites no paper that is no Kamerstuk, and leaves out a year it does not know', () => {
		expect(kamerstukCitation({ chamber: 'TK', dossier_number: null, number: null })).toBeNull();
		expect(kamerstukCitation({ chamber: 'TK', dossier_number: '36791', number: '3' })).toBe(
			'Kamerstukken II, 36791, nr. 3'
		);
		expect(sessionYear('2009-2010')).toBe('2009/10');
		expect(kamerstukLabel({ chamber: 'EK', dossier_number: '36791', number: 'C' })).toBe(
			'36791, C'
		);
	});
});

describe('withoutKamerstuk', () => {
	it('drops the Kamerstuk the API puts before a title', () => {
		expect(withoutKamerstuk('Kamerstuk 31058, nr. 11: Verslag van een wetgevingsoverleg')).toBe(
			'Verslag van een wetgevingsoverleg'
		);
		expect(withoutKamerstuk('Kamerstuk 31746, nr. 16. Amendement: Gewijzigd amendement')).toBe(
			'Amendement: Gewijzigd amendement'
		);
		expect(withoutKamerstuk('EK 36901, nr. A: Blanco verslag')).toBe('Blanco verslag');
		expect(withoutKamerstuk('Kamerstuk I 36901, A: Blanco verslag')).toBe('Blanco verslag');
		expect(withoutKamerstuk('Kamerstuk I 36600 VIII, AB: Brief van de minister')).toBe(
			'Brief van de minister'
		);
		expect(withoutKamerstuk('Eindtekst: Wijziging van boek 2')).toBe(
			'Eindtekst: Wijziging van boek 2'
		);
	});
});

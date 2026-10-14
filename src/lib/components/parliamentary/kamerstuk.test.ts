import { describe, expect, it } from 'vitest';
import {
	kamerstukCitation,
	kamerstukLabel,
	kamerstukName,
	sessionYear,
	withoutKamerstuk
} from './kamerstuk';

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

describe('kamerstukName', () => {
	it('names a paper by its place: suffix, Eerste Kamer and a letter number', () => {
		expect(kamerstukName({ dossier_number: '36600', dossier_suffix: 'VIII', number: 5 })).toBe(
			'Kamerstuk 36600 VIII, nr. 5'
		);
		expect(kamerstukName({ chamber: 'TK', dossier_number: '36764', number: '31' })).toBe(
			'Kamerstuk 36764, nr. 31'
		);
		expect(kamerstukName({ chamber: 'EK', dossier_number: '36791', number: 'C' })).toBe(
			'Kamerstuk I 36791, C'
		);
		expect(kamerstukLabel({ chamber: 'TK', dossier_number: '36764', number: 0 })).toBe(
			'36764, nr. 0'
		);
	});

	it('names the dossier alone without a number, and nothing without a dossier', () => {
		expect(kamerstukName({ dossier_number: '36764', number: null })).toBe('Kamerstuk 36764');
		expect(kamerstukName({ chamber: 'EK', dossier_number: '36764' })).toBe('Kamerstuk I 36764');
		expect(kamerstukName({ dossier_number: null, number: '5' })).toBeNull();
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

import { describe, expect, it } from 'vitest';
import { chamberOfDocument, isExplanatory } from './document-chamber';

describe('chamberOfDocument', () => {
	it('reads the chamber from the key', () => {
		expect(chamberOfDocument({ key: 'ek_kst_36327_o' })).toBe('EK');
		expect(chamberOfDocument({ key: 'a572870e_709d_484c_872d_5d84d0829030' })).toBe('TK');
	});

	it('knows the explanatory kinds as the source writes them', () => {
		expect(isExplanatory({ kind: 'Memorie van toelichting' })).toBe(true);
		expect(isExplanatory({ kind: 'Memorie van toelichting (initiatiefvoorstel)' })).toBe(true);
		expect(isExplanatory({ kind: 'Nota van toelichting' })).toBe(true);
		expect(isExplanatory({ kind: 'Nota naar aanleiding van het verslag' })).toBe(false);
		expect(isExplanatory({ kind: null })).toBe(false);
		expect(isExplanatory({ kind: 'Brief', is_explanatory: true })).toBe(true);
		expect(chamberOfDocument({ key: 'x', chamber: 'EK' })).toBe('EK');
	});
});

import { describe, expect, it } from 'vitest';
import { chamberOf, isExplanatory } from './chamber';

describe('chamberOf', () => {
	it('reads the chamber from the key', () => {
		expect(chamberOf({ key: 'ek_kst_36327_o' })).toBe('EK');
		expect(chamberOf({ key: 'a572870e_709d_484c_872d_5d84d0829030' })).toBe('TK');
	});

	it('knows the explanatory kinds as the source writes them', () => {
		expect(isExplanatory({ kind: 'Memorie van toelichting' })).toBe(true);
		expect(isExplanatory({ kind: 'Memorie van toelichting (initiatiefvoorstel)' })).toBe(true);
		expect(isExplanatory({ kind: 'Nota van toelichting' })).toBe(true);
		expect(isExplanatory({ kind: 'Nota naar aanleiding van het verslag' })).toBe(false);
		expect(isExplanatory({ kind: null })).toBe(false);
		expect(isExplanatory({ kind: 'Brief', is_explanatory: true })).toBe(true);
		expect(chamberOf({ key: 'x', chamber: 'EK' })).toBe('EK');
	});
});

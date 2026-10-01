import { describe, expect, it } from 'vitest';
import { nrOf, uitslagVan } from './procedure';

describe('uitslagVan', () => {
	it('follows the source: passed, or the result of the Eerste Kamer', () => {
		expect(uitslagVan({ passed: true })).toBe(true);
		expect(uitslagVan({ passed: false })).toBe(false);
		expect(uitslagVan({ passed: null, result: 'Aangenomen' })).toBe(true);
		expect(uitslagVan({ passed: null, result: 'Verworpen' })).toBe(false);
	});

	it('gives no outcome for a postponed vote (36799, 22 september 2026)', () => {
		expect(uitslagVan({ passed: null, result: null })).toBeNull();
		expect(uitslagVan({})).toBeNull();
	});
});

describe('nrOf', () => {
	it('takes the letter of the Eerste Kamer and the number of the Tweede Kamer', () => {
		expect(nrOf({ title: 'Verslag', body: { chamber: 'EK', number: 'AB' } })).toBe('AB');
		expect(nrOf({ title: 'Kamerstuk 36799, nr. 31: Motie', body: {} })).toBe('31');
		expect(nrOf({ title: 'Motie', body: { sequence: 31 } })).toBe('31');
		expect(nrOf({ title: 'Nader rapport', body: {} })).toBeNull();
	});
});

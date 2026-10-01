import { describe, expect, it } from 'vitest';
import { uitslagVan } from './procedure';

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

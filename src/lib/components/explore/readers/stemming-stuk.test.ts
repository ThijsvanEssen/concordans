import { describe, expect, it } from 'vitest';
import { isAdviesStuk } from './stemming-stuk';

describe('isAdviesStuk', () => {
	it('knows the advice of the Raad van State, which no stemming is over', () => {
		expect(isAdviesStuk({ kind: 'Advies Afdeling advisering Raad van State' })).toBe(true);
		expect(isAdviesStuk({ kind: 'Voorstel van wet' })).toBe(false);
		expect(isAdviesStuk({ kind: null })).toBe(false);
		expect(isAdviesStuk(null)).toBe(false);
	});
});

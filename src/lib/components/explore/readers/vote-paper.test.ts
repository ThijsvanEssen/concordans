import { describe, expect, it } from 'vitest';
import { isAdvicePaper } from './vote-paper';

describe('isAdvicePaper', () => {
	it('knows the advice of the Raad van State, which no stemming is over', () => {
		expect(isAdvicePaper({ kind: 'Advies Afdeling advisering Raad van State' })).toBe(true);
		expect(isAdvicePaper({ kind: 'Voorstel van wet' })).toBe(false);
		expect(isAdvicePaper({ kind: null })).toBe(false);
		expect(isAdvicePaper(null)).toBe(false);
	});
});

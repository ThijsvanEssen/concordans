import { describe, expect, it } from 'vitest';
import { seatedOnly } from './period';

describe('the period filter of a list', () => {
	it('shows who sat in the period, not only the seats of today', () => {
		expect(seatedOnly(false, '', '')).toBe(true);
		expect(seatedOnly(false, '2020-01-01', '')).toBe(false);
		expect(seatedOnly(false, '', '2020-12-31')).toBe(false);
		expect(seatedOnly(true, '', '')).toBe(false);
	});
});

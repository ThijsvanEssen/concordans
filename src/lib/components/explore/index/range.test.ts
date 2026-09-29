import { describe, expect, it } from 'vitest';
import { rangeLabel } from './range';

describe('rangeLabel', () => {
	it('says one day once', () => {
		expect(rangeLabel('2026-09-22', '2026-09-22', 'date')).not.toContain('tot');
	});
	it('says one year once', () => {
		expect(rangeLabel('2024', '2024', 'year')).toBe('2024');
	});
	it('gives a period from and to, open at either end', () => {
		expect(rangeLabel('2020', '2024', 'year')).toBe('2020 tot 2024');
		expect(rangeLabel('', '2024', 'year')).toBe('… tot 2024');
		expect(rangeLabel('2020', '', 'year')).toBe('2020 tot nu');
	});
});

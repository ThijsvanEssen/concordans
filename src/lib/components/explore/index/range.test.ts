import { describe, expect, it } from 'vitest';
import { rangeLabel } from './range';

describe('rangeLabel', () => {
	it('names one day once, without "tot"', () => {
		expect(rangeLabel('2026-09-22', '2026-09-22', 'date')).toBe('22 sep 2026');
	});
	it('names one year once', () => {
		expect(rangeLabel('2024', '2024', 'year')).toBe('2024');
	});
	it('says a period as the Periode line does', () => {
		expect(rangeLabel('2020', '2024', 'year')).toBe('2020 tot 2024');
		expect(rangeLabel('', '2024', 'year')).toBe('Tot 2024');
		expect(rangeLabel('2020-01-01', '2024-06-30', 'date')).toBe('1 jan 2020 tot 30 jun 2024');
	});
});

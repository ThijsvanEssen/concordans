import { describe, expect, it } from 'vitest';
import { dagMaand, dagVan, korteDatum, langeDatum, maandJaar, weekdag } from './datum';

describe('datum', () => {
	it('abbreviates as the Taalunie does', () => {
		expect(korteDatum('2026-09-28')).toBe('28 sep. 2026');
		expect(korteDatum('2026-03-04')).toBe('4 mrt. 2026');
		expect(korteDatum('2026-05-01')).toBe('1 mei 2026');
	});

	it('reads the day of a moment as written, whatever the time zone', () => {
		expect(korteDatum('2026-09-28T23:30:00Z')).toBe('28 sep. 2026');
		expect(langeDatum('2026-01-01T00:00:00+02:00')).toBe('1 januari 2026');
	});

	it('has a short form without the year, and one with month and year', () => {
		expect(dagMaand('2026-09-28')).toBe('28 sep.');
		expect(maandJaar('2026-09-28')).toBe('sep. 2026');
	});

	it('writes the month in full in a sentence', () => {
		expect(langeDatum('2019-12-20')).toBe('20 december 2019');
	});

	it('heads a day with its weekday', () => {
		expect(weekdag('2026-09-29')).toBe('Dinsdag 29 september 2026');
	});

	it('says nothing for a missing or broken date', () => {
		for (const f of [korteDatum, dagMaand, maandJaar, langeDatum, weekdag]) {
			expect(f(null)).toBe('');
			expect(f(undefined)).toBe('');
			expect(f('')).toBe('');
			expect(f('sep 2026')).toBe('');
		}
		expect(dagVan('2026-13-01')).toBeNull();
	});
});

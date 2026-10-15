import { describe, expect, it } from 'vitest';
import {
	addDays,
	yearsOf,
	dagMaand,
	dagVan,
	DAY_MS,
	daysBetween,
	isDay,
	korteDatum,
	langeDatum,
	maandJaar,
	weekdag
} from './datum';

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

describe('days', () => {
	it('takes a day as the URL writes it, and nothing else', () => {
		expect(isDay('2015-01-01')).toBe(true);
		expect(isDay('2015-1-1')).toBe(false);
		expect(isDay('gisteren')).toBe(false);
		expect(isDay('2015-13-45')).toBe(false);
		expect(isDay('')).toBe(false);
		expect(isDay(null)).toBe(false);
	});

	it('counts the days between two dates and adds days to one', () => {
		expect(DAY_MS).toBe(86_400_000);
		expect(daysBetween('2026-10-01', '2026-10-14')).toBe(13);
		expect(daysBetween('2026-10-14', '2026-10-01')).toBe(-13);
		expect(addDays('2026-10-14', -1)).toBe('2026-10-13');
		expect(addDays('2026-03-01T10:00:00Z', -1)).toBe('2026-02-28');
		expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
	});
});

describe('yearsOf', () => {
	it('starts every period with a year, an open one ending in a dash', () => {
		expect(yearsOf('2017-03-23', '2021-03-31')).toBe('2017–2021');
		expect(yearsOf('2026-02-23', null)).toBe('2026–');
		expect(yearsOf('2024-07-02', '2024-11-12')).toBe('2024');
	});
});

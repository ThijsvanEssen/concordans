import { describe, expect, it } from 'vitest';
import {
	addDays,
	onDate,
	asOfDate,
	sinceDate,
	untilDate,
	throughDate,
	fromDate,
	yearsOf,
	holdDatesTogether,
	shortDatesIn,
	splitDates,
	dagMaand,
	dagVan,
	DAY_MS,
	daysBetween,
	isDay,
	korteDatum,
	langeDatum,
	maandJaar,
	vandaag,
	maandagVan,
	weekdag
} from './datum';

const NB = '\u00a0';

describe('datum', () => {
	it('keeps a date on one line: a no-break space between its parts', () => {
		expect(korteDatum('2026-09-28')).toBe(`28${NB}sep.${NB}2026`);
		expect(langeDatum('2026-09-28')).toBe(`28${NB}september${NB}2026`);
		expect(dagMaand('2026-09-28')).toBe(`28${NB}sep.`);
		expect(maandJaar('2026-09-28')).toBe(`sep.${NB}2026`);
		for (const f of [korteDatum, langeDatum, dagMaand, maandJaar, weekdag]) {
			expect(f('2026-09-28')).not.toMatch(/(?<=\d) (?=[a-z])|(?<=[a-z.]) (?=\d{4})/i);
		}
	});

	it('puts a word before a date in one place, always with the long date', () => {
		expect(sinceDate('2026-09-28')).toBe(`sinds 28${NB}september${NB}2026`);
		expect(asOfDate('2026-09-28')).toBe(`per 28${NB}september${NB}2026`);
		expect(onDate('2026-09-28')).toBe(`op 28${NB}september${NB}2026`);
		expect(fromDate('2026-09-28')).toBe(`vanaf 28${NB}september${NB}2026`);
		expect(untilDate('2026-09-28')).toBe(`tot 28${NB}september${NB}2026`);
		expect(throughDate('2026-09-28')).toBe(`tot en met 28${NB}september${NB}2026`);
		expect(sinceDate(null)).toBe('');
	});

	it('abbreviates as the Taalunie does', () => {
		expect(korteDatum('2026-09-28')).toBe('28\u00a0sep.\u00a02026');
		expect(korteDatum('2026-03-04')).toBe('4\u00a0mrt.\u00a02026');
		expect(korteDatum('2026-05-01')).toBe('1\u00a0mei\u00a02026');
	});

	it('reads the day of a moment as written, whatever the time zone', () => {
		expect(korteDatum('2026-09-28T23:30:00Z')).toBe('28\u00a0sep.\u00a02026');
		expect(langeDatum('2026-01-01T00:00:00+02:00')).toBe('1\u00a0januari\u00a02026');
	});

	it('says today in Europe/Amsterdam, whatever the time zone of the reader (T5)', () => {
		// 22:30 UTC on 21 October is half past midnight of the 22nd in the Netherlands.
		expect(vandaag(new Date('2026-10-21T22:30:00Z'))).toBe('2026-10-22');
		expect(vandaag(new Date('2026-10-21T21:30:00Z'))).toBe('2026-10-21');
		// Winter time: 23:30 UTC is half past midnight too.
		expect(vandaag(new Date('2026-12-31T23:30:00Z'))).toBe('2027-01-01');
	});

	it('has a short form without the year, and one with month and year', () => {
		expect(dagMaand('2026-09-28')).toBe('28\u00a0sep.');
		expect(maandJaar('2026-09-28')).toBe('sep.\u00a02026');
	});

	it('writes the month in full in a sentence', () => {
		expect(langeDatum('2019-12-20')).toBe('20\u00a0december\u00a02019');
	});

	it('heads a day with its weekday', () => {
		expect(weekdag('2026-09-29')).toBe('Dinsdag 29\u00a0september\u00a02026');
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

describe('holdDatesTogether', () => {
	it('holds a date in running text together and keeps every offset', () => {
		const tekst = 'Besluit van 12 maart 2020 en 3 mei, niet 5 keer';
		const vast = holdDatesTogether(tekst);
		expect(vast).toBe('Besluit van 12 maart 2020 en 3 mei, niet 5 keer');
		expect(vast.length).toBe(tekst.length);
	});
});

describe('splitDates', () => {
	it('cuts a text at its dates and loses nothing', () => {
		const text = 'Op 22 april 1998 en 3 mei, niet 5 keer';
		const parts = splitDates(text);
		expect(parts.map((d) => d.text).join('')).toBe(text);
		expect(parts.filter((d) => d.date).map((d) => d.text)).toEqual(['22 april 1998', '3 mei']);
	});
});

describe('maandagVan', () => {
	it('is the Monday of the week of a day', () => {
		expect(maandagVan('2024-04-25')).toBe('2024-04-22');
		expect(maandagVan('2024-04-22')).toBe('2024-04-22');
		expect(maandagVan('2024-04-28')).toBe('2024-04-22');
	});
});

describe('shortDatesIn', () => {
	it('writes the long dates of a text short', () => {
		expect(shortDatesIn('HR 20 december 2019 (Urgenda)')).toBe('HR 20 dec. 2019 (Urgenda)');
		expect(shortDatesIn('Conclusie P-G 13 maart 2019')).toBe('Conclusie P-G 13 mrt. 2019');
		expect(shortDatesIn('Rb. Den Haag 2 mei 2015')).toBe('Rb. Den Haag 2 mei 2015');
		expect(shortDatesIn('Boek 6 BW')).toBe('Boek 6 BW');
	});
});

import { describe, expect, it } from 'vitest';
import {
	alsDag,
	formatDay,
	readBound,
	maandenTerug,
	quickChoiceOf,
	fieldText,
	periodInWords
} from './periode';

const NU = '2026-10-09';

describe('periode', () => {
	it('goes back whole months, to the last day where the month is shorter', () => {
		expect(maandenTerug('2026-10-09', 1)).toBe('2026-09-09');
		expect(maandenTerug('2026-10-09', 12)).toBe('2025-10-09');
		expect(maandenTerug('2026-05-31', 3)).toBe('2026-02-28');
	});

	it('knows a snelkeuze again, and a period of its own', () => {
		expect(quickChoiceOf('', '', NU)).toBe('all');
		expect(quickChoiceOf('2021-10-09', '', NU)).toBe('five');
		expect(quickChoiceOf('2000-01-01', '', NU)).toBe('since-2000');
		expect(quickChoiceOf('2021-10-09', '2022-01-01', NU)).toBeNull();
		expect(quickChoiceOf('2020-01-01', '', NU)).toBeNull();
	});

	it('says a period in words', () => {
		expect(periodInWords('', '', NU)).toBe('Alle jaren');
		expect(periodInWords('2020-01-01', '', NU)).toBe('Sinds 2020');
		expect(periodInWords('', '1990-12-31', NU)).toBe('Tot 1990');
		expect(periodInWords('2010-01-01', '2020-12-31', NU)).toBe('2010 tot 2020');
		expect(periodInWords('2024-01-01', '2024-06-30', NU)).toBe('1 jan 2024 tot 30 jun 2024');
		expect(periodInWords('2025-10-09', '', NU)).toBe('Afgelopen jaar');
	});

	it('writes a date with a month of three letters and no full stop', () => {
		expect(formatDay('2024-03-01')).toBe('1 mrt 2024');
		expect(fieldText('2020-01-01', 'from')).toBe('2020');
		expect(fieldText('2020-12-31', 'from')).toBe('31 dec 2020');
		expect(fieldText('2020-12-31', 'to')).toBe('2020');
	});

	it('reads a year or a date, van from 1 January and tot to 31 December', () => {
		expect(readBound('', 'from')).toEqual({ day: '' });
		expect(readBound('2020', 'from')).toEqual({ day: '2020-01-01' });
		expect(readBound('2020', 'to')).toEqual({ day: '2020-12-31' });
		for (const t of [
			'1-3-2024',
			'1/3/2024',
			'01-03-2024',
			'2024-03-01',
			'1 mrt 2024',
			'1 maart 2024'
		])
			expect(readBound(t, 'from')).toEqual({ day: '2024-03-01' });
	});

	it('says why a date does not read', () => {
		expect(readBound('31-2-2024', 'from')).toEqual({
			error: '31 februari bestaat niet. Typ een jaar of een datum als 1-3-2024.'
		});
		expect(readBound('bla', 'to')).toEqual({ error: 'Typ een jaar of een datum als 1-3-2024.' });
		expect(readBound('1-13-2024', 'to')).toHaveProperty('error');
	});

	it('reads a day from the address, and nothing else', () => {
		expect(alsDag('2015-03-02')).toBe('2015-03-02');
		expect(alsDag('2015')).toBeNull();
		expect(alsDag('maart')).toBeNull();
	});
});

import { describe, expect, it } from 'vitest';
import {
	alsDag,
	formatDag,
	leesGrens,
	maandenTerug,
	snelkeuzeVan,
	veldTekst,
	woorden
} from './periode';

const NU = '2026-10-09';

describe('periode', () => {
	it('goes back whole months, to the last day where the month is shorter', () => {
		expect(maandenTerug('2026-10-09', 1)).toBe('2026-09-09');
		expect(maandenTerug('2026-10-09', 12)).toBe('2025-10-09');
		expect(maandenTerug('2026-05-31', 3)).toBe('2026-02-28');
	});

	it('knows a snelkeuze again, and a period of its own', () => {
		expect(snelkeuzeVan('', '', NU)).toBe('alles');
		expect(snelkeuzeVan('2021-10-09', '', NU)).toBe('vijf');
		expect(snelkeuzeVan('2000-01-01', '', NU)).toBe('sinds-2000');
		expect(snelkeuzeVan('2021-10-09', '2022-01-01', NU)).toBeNull();
		expect(snelkeuzeVan('2020-01-01', '', NU)).toBeNull();
	});

	it('says a period in words', () => {
		expect(woorden('', '', NU)).toBe('Alle jaren');
		expect(woorden('2020-01-01', '', NU)).toBe('Sinds 2020');
		expect(woorden('', '1990-12-31', NU)).toBe('Tot 1990');
		expect(woorden('2010-01-01', '2020-12-31', NU)).toBe('2010 tot 2020');
		expect(woorden('2024-01-01', '2024-06-30', NU)).toBe('1 jan 2024 tot 30 jun 2024');
		expect(woorden('2025-10-09', '', NU)).toBe('Afgelopen jaar');
	});

	it('writes a date with a month of three letters and no full stop', () => {
		expect(formatDag('2024-03-01')).toBe('1 mrt 2024');
		expect(veldTekst('2020-01-01', 'van')).toBe('2020');
		expect(veldTekst('2020-12-31', 'van')).toBe('31 dec 2020');
		expect(veldTekst('2020-12-31', 'tot')).toBe('2020');
	});

	it('reads a year or a date, van from 1 January and tot to 31 December', () => {
		expect(leesGrens('', 'van')).toEqual({ dag: '' });
		expect(leesGrens('2020', 'van')).toEqual({ dag: '2020-01-01' });
		expect(leesGrens('2020', 'tot')).toEqual({ dag: '2020-12-31' });
		for (const t of [
			'1-3-2024',
			'1/3/2024',
			'01-03-2024',
			'2024-03-01',
			'1 mrt 2024',
			'1 maart 2024'
		])
			expect(leesGrens(t, 'van')).toEqual({ dag: '2024-03-01' });
	});

	it('says why a date does not read', () => {
		expect(leesGrens('31-2-2024', 'van')).toEqual({
			fout: '31 februari bestaat niet. Typ een jaar of een datum als 1-3-2024.'
		});
		expect(leesGrens('bla', 'tot')).toEqual({ fout: 'Typ een jaar of een datum als 1-3-2024.' });
		expect(leesGrens('1-13-2024', 'tot')).toHaveProperty('fout');
	});

	it('reads a day from the address, and nothing else', () => {
		expect(alsDag('2015-03-02')).toBe('2015-03-02');
		expect(alsDag('2015')).toBeNull();
		expect(alsDag('maart')).toBeNull();
	});
});

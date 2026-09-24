import { describe, expect, it } from 'vitest';
import { careerOf, currentTitle, inYears, yearsOf } from './career';

const d66 = (from: string, to: string | null, role = 'Lid') => ({
	faction_id: 'factions/d66',
	faction_key: 'd66',
	name: 'Democraten 66',
	abbreviation: 'D66',
	aliases: [],
	from_date: from,
	to_date: to,
	role
});

// Jetten: seven faction periods in one run, fractievoorzitter three times; then
// stukken signed as minister-president and minister van Algemene Zaken.
const memberships = [
	d66('2017-03-23', '2018-10-08'),
	d66('2018-10-09', '2021-03-30', 'Fractievoorzitter'),
	d66('2021-03-31', '2021-05-25'),
	d66('2021-05-25', '2021-09-27', 'Fractievoorzitter'),
	d66('2021-09-28', '2022-01-10'),
	d66('2023-12-06', '2026-02-09', 'Fractievoorzitter')
];
const signatures = [
	{ function: 'minister-president', capacity: 'bewindspersoon', date: '2026-09-16' },
	{ function: 'minister-president', capacity: 'bewindspersoon', date: '2026-09-08' },
	{ function: 'minister van Algemene Zaken', capacity: 'bewindspersoon', date: '2026-09-15' },
	{ function: 'Tweede Kamerlid', capacity: 'kamerlid', date: '2020-01-01' }
];

describe('careerOf', () => {
	const career = careerOf(memberships, signatures);

	it('joins the seats of one fractie, and splits them where they lapse', () => {
		const seats = career.filter((e) => e.kind === 'seat');
		expect(seats.map((s) => [s.faction, s.from, s.to])).toEqual([
			['D66', '2023-12-06', '2026-02-09'],
			['D66', '2017-03-23', '2022-01-10']
		]);
		expect(seats[1].kind === 'seat' && seats[1].roles.map((r) => yearsOf(r.from, r.to))).toEqual([
			'2018–2021',
			'2021'
		]);
	});

	it('gives a function the years of the stukken signed in it, not as Kamerlid', () => {
		const functions = career.filter((e) => e.kind === 'function');
		expect(
			functions.map((f) => f.kind === 'function' && [f.function, f.from, f.to, f.count])
		).toEqual([
			['minister van Algemene Zaken', '2026-09-15', '2026-09-15', 1],
			['minister-president', '2026-09-08', '2026-09-16', 2]
		]);
	});

	it('names a person by what they are now', () => {
		expect(currentTitle(career, false)).toBe('Minister-president');
		expect(currentTitle(career, true)).toBe('Kamerlid');
		expect(currentTitle(careerOf(memberships, []), false)).toBe('Oud-Kamerlid');
	});

	it('tells whether an entry falls in the chosen years', () => {
		expect(inYears('2017-03-23', '2022-01-10', 2019, 2019)).toBe(true);
		expect(inYears('2026-09-08', '2026-09-16', 2019, 2021)).toBe(false);
		expect(inYears('2025-11-12', null, 2030, null)).toBe(true);
	});
});

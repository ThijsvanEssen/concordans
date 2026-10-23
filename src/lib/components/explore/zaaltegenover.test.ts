import { describe, expect, it } from 'vitest';
import { HALL_COLUMNS, HALL_ROWS, indelingMarkering, plaatsenOpVolgorde } from './zaaltegenover';

describe('plaatsenOpVolgorde: the Eerste Kamer on a day without its plan', () => {
	// kabinet-Schoof, 22 Feb 2026: no `hall` with a date (API 0.79.48).
	const fracties = [
		{ name: 'VVD', seats: 10 },
		{ name: 'GroenLinks-PvdA', seats: 14 },
		{ name: 'BBB', seats: 12 },
		{ name: 'overig', seats: 39 }
	];

	it('gives every one of the 75 seats a place, each in a block of four by ten', () => {
		const p = plaatsenOpVolgorde(fracties);
		expect(p).toHaveLength(75);
		expect(new Set(p.map((s) => `${s.block}:${s.row}:${s.column}`)).size).toBe(75);
		expect(
			p.every((s) => s.row >= 0 && s.row < HALL_ROWS && s.column >= 0 && s.column < HALL_COLUMNS)
		).toBe(true);
	});

	it('has two blocks of four places by ten rows', () => {
		expect([HALL_COLUMNS, HALL_ROWS]).toEqual([4, 10]);
	});

	it('keeps a fractie together, the largest first', () => {
		const p = plaatsenOpVolgorde(fracties);
		expect(p[0].name).toBe('overig');
		const namen = p.map((s) => s.name);
		expect(namen.filter((n, i) => n !== namen[i - 1])).toEqual([
			'overig',
			'GroenLinks-PvdA',
			'BBB',
			'VVD'
		]);
	});
});

describe('indelingMarkering: the caption of a hall drawn by fractie', () => {
	const plan = { seats: [{ block: 'left', row: 0, column: 0 }] };

	it('marks nothing where the Eerste Kamer has its plan', () => {
		expect(indelingMarkering({ chamber: 'EK', hall: plan, hall_read_on: '2026-10-09' })).toBeNull();
		expect(indelingMarkering({ chamber: 'EK', hall: plan })).toBeNull();
	});

	it('marks nothing for the Tweede Kamer', () => {
		expect(indelingMarkering({ chamber: 'TK', hall: null, hall_read_on: null })).toBeNull();
	});

	it('marks a day without the plan, before the API names the day it was read', () => {
		expect(indelingMarkering({ chamber: 'EK', hall: null })).toBe('Indeling per fractie');
		expect(indelingMarkering({ chamber: 'EK', hall: { seats: [] } })).toBe('Indeling per fractie');
	});

	it('names the day the plan is known from where the API gives it', () => {
		expect(indelingMarkering({ chamber: 'EK', hall: null, hall_read_on: '2026-10-09' })).toBe(
			'Indeling per fractie; zaal bekend vanaf 9\u00a0oktober\u00a02026'
		);
	});
});

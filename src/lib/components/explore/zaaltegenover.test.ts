import { describe, expect, it } from 'vitest';
import { plaatsenOpVolgorde } from './zaaltegenover';

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
		expect(p.every((s) => s.row >= 0 && s.row < 10 && s.column >= 0 && s.column < 4)).toBe(true);
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

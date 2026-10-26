import { describe, expect, it } from 'vitest';
import { inPeriode, jaarBij, stapJaar, staven } from './periode-verdeling';

const V = [
	{ jaar: 2000, aantal: 10 },
	{ jaar: 2002, aantal: 40 }
];

describe('the distribution of Periode', () => {
	it('draws a bar per year, empty years included, inside or outside the period', () => {
		const s = staven(V, 2001, 2002);
		expect(s).toHaveLength(3);
		expect(s.map((b) => b.binnen)).toEqual([false, true, true]);
		expect(s[1].hoog).toBe(0);
		expect(s[2].hoog).toBe(48);
		expect(staven([], 0, 0)).toEqual([]);
	});

	it('counts the years in the period', () => {
		expect(inPeriode(V, 2000, 2001)).toBe(10);
		expect(inPeriode(V, 2000, 2002)).toBe(50);
	});

	it('moves a handle by the keys of a slider', () => {
		expect(stapJaar('ArrowRight', 2010, 2000, 2020)).toBe(2011);
		expect(stapJaar('PageDown', 2005, 2000, 2020)).toBe(2000);
		expect(stapJaar('PageUp', 2015, 2000, 2020)).toBe(2020);
		expect(stapJaar('Home', 2010, 2000, 2020)).toBe(2000);
		expect(stapJaar('End', 2010, 2000, 2020)).toBe(2020);
		expect(stapJaar('a', 2010, 2000, 2020)).toBeNull();
	});

	it('takes the year at a place on the track', () => {
		expect(jaarBij(0.5, 2000, 2020)).toBe(2010);
		expect(jaarBij(2, 2000, 2020)).toBe(2020);
	});
});

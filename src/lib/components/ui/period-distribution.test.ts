import { describe, expect, it } from 'vitest';
import { inPeriod, yearAt, stepYear, bars } from './period-distribution';

const V = [
	{ year: 2000, count: 10 },
	{ year: 2002, count: 40 }
];

describe('the distribution of Periode', () => {
	it('draws a bar per year, empty years included, inside or outside the period', () => {
		const s = bars(V, 2001, 2002);
		expect(s).toHaveLength(3);
		expect(s.map((b) => b.inside)).toEqual([false, true, true]);
		expect(s[1].height).toBe(0);
		expect(s[2].height).toBe(48);
		expect(bars([], 0, 0)).toEqual([]);
	});

	it('counts the years in the period', () => {
		expect(inPeriod(V, 2000, 2001)).toBe(10);
		expect(inPeriod(V, 2000, 2002)).toBe(50);
	});

	it('moves a handle by the keys of a slider', () => {
		expect(stepYear('ArrowRight', 2010, 2000, 2020)).toBe(2011);
		expect(stepYear('PageDown', 2005, 2000, 2020)).toBe(2000);
		expect(stepYear('PageUp', 2015, 2000, 2020)).toBe(2020);
		expect(stepYear('Home', 2010, 2000, 2020)).toBe(2000);
		expect(stepYear('End', 2010, 2000, 2020)).toBe(2020);
		expect(stepYear('a', 2010, 2000, 2020)).toBeNull();
	});

	it('takes the year at a place on the track', () => {
		expect(yearAt(0.5, 2000, 2020)).toBe(2010);
		expect(yearAt(2, 2000, 2020)).toBe(2020);
	});
});

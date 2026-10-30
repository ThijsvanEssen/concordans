import { describe, expect, it } from 'vitest';
import { axisY, timeAxis } from './time-axis';

describe('timeAxis', () => {
	it('gives height only to a year in which something stands; a run of empty years is one bend', () => {
		const axis = timeAxis(['2008-05-01', '2009-02-01', '2014-03-01', '2025-03-01'], 100)!;
		expect(axis.segments.map((s) => [s.from, s.to, s.empty])).toEqual([
			[2008, 2009, false],
			[2009, 2010, false],
			[2010, 2014, true],
			[2014, 2015, false],
			[2015, 2025, true],
			[2025, 2026, false]
		]);
		expect(axis.segments.filter((s) => s.empty).map((s) => s.height)).toEqual([14, 14]);
		// A bend has no year.
		expect(axis.ticks.map((t) => t.label)).toEqual(['2008', '2009', '2014', '2025', '2026']);
	});

	it('marks months only on a short axis', () => {
		const short = timeAxis(['2025-03-01', '2026-10-01'], 0)!;
		expect(short.ticks.filter((t) => t.kind === 'month').map((t) => t.label)).toEqual([
			'apr.',
			'jul.',
			'okt.',
			'apr.',
			'jul.',
			'okt.'
		]);
		const long = timeAxis(
			['2008-01-01', '2012-01-01', '2016-01-01', '2020-01-01', '2025-01-01'],
			0
		)!;
		expect(long.ticks.some((t) => t.kind === 'month')).toBe(false);
	});

	it('places a later day lower, and has nothing without a day', () => {
		const axis = timeAxis(['2025-01-15', '2025-12-01', '2026-06-01'], 50)!;
		const ys = ['2025-01-15', '2025-06-01', '2025-12-01', '2026-06-01'].map((d) => axisY(axis, d)!);
		for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeGreaterThan(ys[i - 1]);
		expect(axisY(axis, null)).toBeNull();
		expect(timeAxis([null], 0)).toBeNull();
	});
});

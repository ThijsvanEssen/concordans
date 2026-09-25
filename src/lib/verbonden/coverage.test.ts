import { describe, expect, it } from 'vitest';
import type { Coverage } from '$lib/api/stats';
import { coverageFor } from './coverage';

const coverage = {
	total: 14476,
	first_date: '1916-02-14',
	last_date: '2026-09-23',
	stubs: 18642,
	tiers: [
		{ tier: 'hoge_raad', count: 3901, first_date: '1916-02-14', last_date: '2026-09-22' },
		{ tier: 'raad_van_state', count: 4423, first_date: '1984-02-24', last_date: '2026-09-23' },
		{ tier: 'parket', count: 1189, first_date: '1923-11-19', last_date: '2026-09-01' },
		{ tier: 'rechtbank', count: 1880, first_date: '1981-10-26', last_date: '2026-07-08' }
	],
	courts: [
		{
			source: 'rechtspraak',
			tier: 'raad_van_state',
			court_code: 'RVS',
			court: 'Raad van State',
			count: 4423,
			first_date: '1984-02-24',
			last_date: '2026-09-23'
		}
	]
} as unknown as Coverage;

describe('coverageFor', () => {
	it('counts every judgment without a rechter', () => {
		expect(coverageFor(coverage, null)).toMatchObject({ count: 14476, first: '1916-02-14' });
	});

	it('takes the Parket with the Hoge Raad, as the filter does', () => {
		expect(coverageFor(coverage, 'hr')).toEqual({
			count: 5090,
			first: '1916-02-14',
			last: '2026-09-22',
			of: 'uitspraken en conclusies van de Hoge Raad'
		});
	});

	it('reads the Raad van State from its tier, and names nothing it does not hold', () => {
		expect(coverageFor(coverage, 'rvs')).toEqual({
			count: 4423,
			first: '1984-02-24',
			last: '2026-09-23',
			of: 'uitspraken van de Raad van State'
		});
		expect(coverageFor(coverage, 'ehrm')).toBeNull();
		expect(coverageFor(coverage, 'rechtbank')?.last).toBe('2026-07-08');
	});
});

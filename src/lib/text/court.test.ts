import { describe, expect, it } from 'vitest';
import { courtName } from './court';
import { describe as describeBron } from '$lib/verbonden/rows';

describe('courtName (#62)', () => {
	it('names a court by its code, also one abolished in 2013', () => {
		expect(courtName('RBDHA')).toBe('Rechtbank Den Haag');
		expect(courtName('RBUTR')).toBe('Rechtbank Utrecht');
		expect(courtName('rbmaa')).toBe('Rechtbank Maastricht');
		expect(courtName('GHSGR')).toBe("Gerechtshof 's-Gravenhage");
	});
	it('keeps a name it is given, and nothing for nothing', () => {
		expect(courtName('Rechtbank Utrecht')).toBe('Rechtbank Utrecht');
		expect(courtName(null)).toBeNull();
	});
	it('gives a row of a judgment of an abolished court its name', () => {
		const row = describeBron('judgments', 'ecli_nl_rbutr_2008_bf2034', null, {
			ecli: 'ECLI:NL:RBUTR:2008:BF2034',
			court: 'RBUTR',
			date: '2008-09-24'
		});
		expect(row.title).toBe('Rechtbank Utrecht, 24 september 2008');
	});
});

import { describe, expect, it } from 'vitest';
import { citeDate, validityOf, type Validity } from './validity';
import { statusOf } from '$lib/text/validity';
import { vandaag } from '$lib/text/datum';

const v = (o: Partial<Validity>): Validity => ({
	state: 'in_force',
	date: null,
	as_of: null,
	successors: [],
	...o
});

describe('validityOf', () => {
	it('reads the object, null as unknown and an answer without it as undefined', () => {
		expect(validityOf({ validity: { state: 'expired', date: '2020-01-01' } })).toEqual({
			state: 'expired',
			date: '2020-01-01',
			as_of: null,
			successors: []
		});
		expect(validityOf({ validity: null })).toBeNull();
		expect(validityOf({})).toBeUndefined();
		expect(validityOf(null)).toBeUndefined();
		expect(validityOf({ validity: { state: 'later' } })).toBeUndefined();
	});
});

describe('citeDate', () => {
	it('is the last day of what expired, else undefined: a citation says today', () => {
		const day = (d?: Date) => d && vandaag(d);
		expect(citeDate(v({ as_of: '2026-10-21' }))).toBeUndefined();
		expect(day(citeDate(v({ state: 'expired', date: '2020-01-01', as_of: '2026-10-21' })))).toBe(
			'2019-12-31'
		);
		expect(citeDate(v({}))).toBeUndefined();
		expect(citeDate(undefined)).toBeUndefined();
	});
});

describe('statusOf', () => {
	it('says vervallen as a no, nog niet in werking not, and nothing for what holds', () => {
		expect(statusOf(v({ state: 'expired', date: '2020-01-01' }))).toEqual({
			text: 'Vervallen per 1\u00a0januari\u00a02020',
			negative: true
		});
		expect(statusOf(v({ state: 'expired' }))?.text).toBe('Vervallen');
		expect(statusOf(v({ state: 'not_in_force_yet', date: '2027-01-01' }))).toEqual({
			text: 'Nog niet in werking (per 1\u00a0januari\u00a02027)',
			negative: false
		});
		expect(statusOf(v({}))).toBeNull();
		expect(statusOf(null)).toBeNull();
	});
});

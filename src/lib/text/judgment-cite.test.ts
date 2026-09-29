import { describe, expect, it } from 'vitest';
import { courtCite, judgmentCite } from './judgment-cite';

describe('judgmentCite', () => {
	it('cites the Hoge Raad as lawyers do', () => {
		expect(judgmentCite('ECLI:NL:HR:2019:1278', '2019-07-19', 'Hoge Raad')).toEqual({
			short: 'HR 19 juli 2019',
			full: 'HR 19 juli 2019, ECLI:NL:HR:2019:1278'
		});
	});
	it('names a rechtbank and a hof by their place', () => {
		expect(judgmentCite('ECLI:NL:RBDHA:2026:24524', '2026-07-06', 'Rechtbank Den Haag').full).toBe(
			'Rb. Den Haag 6 juli 2026, ECLI:NL:RBDHA:2026:24524'
		);
		expect(
			judgmentCite('ECLI:NL:GHAMS:2026:2673', '2026-09-22', 'Gerechtshof Amsterdam').short
		).toBe('Hof Amsterdam 22 september 2026');
	});
	it('goes without a date it does not have', () => {
		expect(judgmentCite('ECLI:NL:HR:2019:1278', null).full).toBe('HR, ECLI:NL:HR:2019:1278');
	});
});

describe('courtCite', () => {
	it('knows the courts that are cited by their abbreviation', () => {
		expect(courtCite('ECLI:NL:PHR:2019:496')).toBe('Conclusie');
		expect(courtCite('ECLI:NL:RVS:2026:5670')).toBe('ABRvS');
		expect(courtCite('ECLI:NL:CRVB:2026:404')).toBe('CRvB');
		expect(courtCite('ECLI:NL:CBB:2024:927')).toBe('CBb');
		expect(courtCite('ECLI:CE:ECHR:2026:0908JUD000748123')).toBe('EHRM');
		expect(courtCite('ECLI:EU:C:2020:12')).toBe('HvJ EU');
	});
	it('falls back on the court without a place in its name', () => {
		expect(courtCite('ECLI:NL:RBMNE:2026:4501', null)).toBe('Rb.');
	});
});

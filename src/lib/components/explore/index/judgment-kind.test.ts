import { describe, expect, it } from 'vitest';
import { judgmentCaseNumber, judgmentCourt, judgmentKind, judgmentRowTitle } from './judgment-kind';

describe('judgmentKind', () => {
	it('takes the kind the API gives', () => {
		expect(judgmentKind('beschikking', 'hoge_raad')).toBe('Beschikking');
		expect(judgmentKind('prejudiciële beslissing', 'hoge_raad')).toBe('Prejudiciële beslissing');
	});

	it.each([
		['hoge_raad', 'Arrest'],
		['gerechtshof', 'Arrest'],
		['rechtbank', 'Vonnis'],
		['parket', 'Conclusie'],
		['raad_van_state', 'Uitspraak'],
		['centrale_raad_van_beroep', 'Uitspraak'],
		['college_van_beroep_bedrijfsleven', 'Uitspraak'],
		['tuchtcollege', 'Uitspraak'],
		[null, 'Uitspraak']
	] as const)('without a kind, %s gives a %s', (tier, kind) => {
		expect(judgmentKind(null, tier)).toBe(kind);
	});
});

describe('a judgment in the list', () => {
	const j = {
		key: 'k',
		ecli: 'ECLI:NL:RVS:2026:5682',
		display_name: 'Raad van State 2026-09-23 / 202406462/1/R2'
	};

	it('is named by its name, else its ECLI; the case number is context', () => {
		expect(judgmentRowTitle(j)).toBe('ECLI:NL:RVS:2026:5682');
		expect(judgmentRowTitle({ ...j, names: ['Urgenda'] })).toBe('Urgenda');
		expect(judgmentRowTitle({ key: 'k', display_name: j.display_name })).toBe('202406462/1/R2');
		expect(judgmentCaseNumber(j.display_name)).toBe('202406462/1/R2');
	});

	it('names the court in full', () => {
		expect(judgmentCourt(j.display_name, 'RVS')).toBe('Raad van State');
		expect(judgmentCourt('Rechtbank Zeeland-West-Brabant 2024-06-28 / BRE 23/123', 'RBZWB')).toBe(
			'Rechtbank Zeeland-West-Brabant'
		);
		expect(judgmentCourt(null, 'HR')).toBe('HR');
	});
});

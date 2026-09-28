import { describe, expect, it } from 'vitest';
import { judgmentKind, judgmentRowTitle } from './judgment-kind';

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

describe('judgmentRowTitle', () => {
	it('does not repeat the court and date the row already gives', () => {
		const j = { key: 'k', display_name: 'Raad van State 2026-09-23 / 202505108/1/A2' };
		expect(judgmentRowTitle(j)).toBe('202505108/1/A2');
		expect(judgmentRowTitle({ ...j, names: ['Urgenda'] })).toBe('Urgenda');
		expect(judgmentRowTitle({ key: 'k', ecli: 'ECLI:NL:HR:2019:1278' })).toBe(
			'ECLI:NL:HR:2019:1278'
		);
	});
});

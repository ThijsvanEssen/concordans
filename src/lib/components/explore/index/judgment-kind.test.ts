import { describe, expect, it } from 'vitest';
import { judgmentKind } from './judgment-kind';

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

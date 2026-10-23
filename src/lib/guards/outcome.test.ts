// The outcome of a vote has one wording and one order (E9 E): `Aangenomen`, `Verworpen`, and the
// way after it (`Aangenomen zonder stemming`), written by $lib/text/outcome.
import { describe, expect, it } from 'vitest';
import { regelOvertreders, type Uitzondering } from '$lib/test/bronnen';
import { outcomeWord } from '$lib/text/outcome';

describe('the outcome of a vote', () => {
	it('puts the way after the word', () => {
		expect(outcomeWord(true, 'zonder stemming')).toBe('Aangenomen zonder stemming');
		expect(outcomeWord(false)).toBe('Verworpen');
		expect(outcomeWord(true, 'als hamerstuk', true)).toBe('aangenomen als hamerstuk');
		expect(outcomeWord(null)).toBeNull();
	});

	it('is written from OUTCOME_LABELS, not typed in a component', () => {
		const bronwaarde: Uitzondering[] = [
			{
				pad: 'lib/components/parliamentary/procedure.ts',
				reden: 'the values the source gives, compared, not shown',
				regel: /result === '|zin === '/
			},
			{ pad: 'lib/text/outcome.ts', reden: 'the one place of the words' }
		];
		const woord = /['`"](Aangenomen|Verworpen)\b/;
		expect(
			regelOvertreders((l) => !/^\s*(\/\/|\*|\/\*)|<!--/.test(l) && woord.test(l), bronwaarde)
		).toEqual([]);
		expect(regelOvertreders((l) => /Zonder stemming aangenomen/.test(l))).toEqual([]);
	});
});

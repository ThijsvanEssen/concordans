// A date is written in one place (E9 A, B; E7 G2): a word before a date goes through a helper
// of $lib/text/datum, and a date is never typed out in a component.
import { describe, expect, it } from 'vitest';
import { regelOvertreders } from '$lib/test/bronnen';

const NIET_REGEL = /^\s*(\/\/|\*|\/\*|<!--)|<!--|-->|\/\*/;

describe('a date in words', () => {
	it('puts sinds, per, op, vanaf and tot before a date through sinceDate, asOfDate, onDate, fromDate and untilDate', () => {
		// "sinds ${langeDatum(x)}" fixes the long form in the word's place; one helper does it, and
		// no sentence has the short form ("op 15 okt. 2026" over "op 2 maart 2026").
		const woord = /\b(sinds|per|op|vanaf|tot( en met)?)\s+(\$?\{)(lange|korte)Datum\(/i;
		expect(regelOvertreders((l) => !NIET_REGEL.test(l) && woord.test(l))).toEqual([]);
	});

	it('does not type a date out in a component or a text', () => {
		const letterlijk =
			/\b\d{1,2}\s(?:jan|feb|mrt|apr|mei|jun|jul|aug|sep|okt|nov|dec)[a-z]*\.?\s\d{4}\b/;
		expect(
			regelOvertreders((l) => !NIET_REGEL.test(l) && letterlijk.test(l.replace(/\/\/.*$/, '')))
		).toEqual([]);
	});
});

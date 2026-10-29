// A date is written in one place (E9 A, B; E7 G2): a word before a date goes through a helper
// of $lib/text/datum, and a date is never typed out in a component.
import { describe, expect, it } from 'vitest';
import { BRONNEN, regelOvertreders } from '$lib/test/bronnen';

const NIET_REGEL = /^\s*(\/\/|\*|\/\*|<!--)|<!--|-->|\/\*/;

describe('a date in words', () => {
	it('puts sinds, per, op, vanaf and tot before a date through sinceDate, asOfDate, onDate, fromDate and untilDate', () => {
		// "sinds ${langeDatum(x)}" fixes the long form in the word's place; one helper does it, and
		// no sentence has the short form ("op 15 okt. 2026" over "op 2 maart 2026").
		const woord = /\b(sinds|per|op|vanaf|beslist|tot( en met)?)\s+(\$?\{)(lange|korte)Datum\(/i;
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

describe('a date as an element', () => {
	// A date is a `<time datetime>` (DateTime.svelte), in one place; the lines that show a day
	// take it from there.
	it('has <time> in DateTime alone', () => {
		const heeft = BRONNEN.filter(({ text }) => /<time[\s>]/.test(text)).map(({ path }) => path);
		expect(heeft).toEqual(['lib/components/ui/DateTime.svelte']);
	});

	it('draws the dates of a timeline, a day heading, a list row and a bundel through DateTime', () => {
		const via = [
			'lib/components/tijdlijn/Tijdlijn.svelte',
			'lib/components/ui/Sectie.svelte',
			'lib/map/BundleRow.svelte',
			'lib/components/explore/index/rows/JudgmentRows.svelte',
			'lib/components/explore/index/rows/CommitmentRows.svelte',
			'lib/components/explore/index/rows/DocumentRows.svelte',
			'lib/components/explore/index/rows/DossierRows.svelte',
			'lib/components/explore/index/rows/DecisionRows.svelte'
		];
		const zonder = via.filter(
			(p) => !BRONNEN.find((b) => b.path === p)?.text.includes('<DateTime')
		);
		expect(zonder).toEqual([]);
	});
});

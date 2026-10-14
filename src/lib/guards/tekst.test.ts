// Dates, figures and words are turned by one helper each, in $lib/text.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('dates, figures and words', () => {
	it('formats a date only in $lib/text/datum.ts', () => {
		const dateFormat = /toLocaleDateString|Intl\.DateTimeFormat|\btoLocaleTimeString\b/;
		const monthNames = /['"](januari|jan\.)['"]/;
		expect(
			overtreders((t) => dateFormat.test(t) || monthNames.test(t), [plek('lib/text/datum.ts')])
		).toEqual([]);
	});

	it('formats a figure only in $lib/text/getal.ts, and takes today from datum.ts', () => {
		expect(overtreders((t) => /\.toLocaleString\(/.test(t), [plek('lib/text/getal.ts')])).toEqual(
			[]
		);
		// The UTC day is yesterday between midnight and two; vandaag() is the reader's own day.
		expect(overtreders((t) => /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/.test(t))).toEqual([]);
	});

	it('names a date by korteDatum or langeDatum itself, and counts days only in datum.ts', () => {
		const datum = [plek('lib/text/datum.ts')];
		const alias =
			/const \w+ = (?:korteDatum|langeDatum);|const \w+ = \([^)]*\)[^=;]*=> (?:korteDatum|langeDatum)\(\w+\)(?: \|\| null)?;/;
		expect(overtreders((t) => alias.test(t))).toEqual([]);
		expect(overtreders((t) => /86_?400_?000|864e5/.test(t), datum)).toEqual([]);
		// A day as the URL writes it is checked by isDay.
		expect(overtreders((t) => t.includes(String.raw`/^\d{4}-\d{2}-\d{2}$/`), datum)).toEqual([]);
	});

	it('turns a text with the helpers of $lib/text/words.ts (code-eenvoud F45)', () => {
		// words.ts holds the first four itself.
		const words = [plek('lib/text/words.ts')];
		const rules: [string, RegExp, typeof words][] = [
			['a capital or a small first letter', /\.charAt\(0\)\.to(?:Upper|Lower)Case\(\)/, words],
			['a kind without its group', /\\s\*\\\(\.\*\\\)\\s\*\$/, words],
			[
				'a node prop as text',
				/typeof (\w+) === 'string' &&\s+\1\.trim\(\)\s+\?\s+\1\.trim\(\) : null/,
				words
			],
			['a pattern escaped', /'\\\\\$&'/, words],
			['"a, b en c"', /slice\(0, -1\)\.join\(', '\)\} en /, []],
			['a noun for a count', /=== 1 \? '/, []]
		];
		for (const [what, rule, uitzonderingen] of rules)
			expect(
				overtreders((t) => rule.test(t), uitzonderingen),
				what
			).toEqual([]);
	});

	it('fills no missing value with a sign: Waarde leaves it empty, Veld drops the row', () => {
		// "—" or "–" as a value reads as a fact ("unknown") where the data only lacks it.
		const sign = /['"`>][—–]['"`<]/;
		expect(overtreders((t) => sign.test(t))).toEqual([]);
	});

	it('separates with a comma, not a middle dot (Thijs, 2 October 2026)', () => {
		// "Motie, nr. 21", "Dossier, Kamerstuk 36799", and the browser tab: "Actueel, Concordans".
		expect(overtreders((t) => t.includes('·'))).toEqual([]);
	});
});

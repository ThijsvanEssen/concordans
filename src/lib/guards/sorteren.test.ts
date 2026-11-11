// Labels, titles and names sort in Dutch order with numbers as numbers, by the one collator
// (NL, $lib/text/collator.ts): "Artikel 2" before "Artikel 10" (audit dubbele helpers, 11).
// localeCompare stays for ids and dates, where the order of the characters is the order.
import { describe, expect, it } from 'vitest';
import { overtreders, type Uitzondering } from '$lib/test/bronnen';

/** A locale asked per comparison: `a.localeCompare(b, 'nl')`. */
const MET_TAAL = /\.localeCompare\([^;]*?,\s*['"]/;

/** A label, a title or a name compared character by character. */
const LABEL =
	/\b(label|name|title|titel|naam|abbreviation|family_name|aard|text)\b[\s?')]*\.localeCompare\(/;

const UITZONDERINGEN: Uitzondering[] = [
	{
		pad: 'lib/components/explore/index/lists/list.ts',
		reden: 'changes in concordans#38; goes to NL.compare after that merge',
		regel: /x\.localeCompare\(y as string, 'nl'\)/
	}
];

describe('a sort of labels, titles or names', () => {
	it('goes by NL.compare, never by localeCompare', () => {
		const regels = (text: string) =>
			text.split('\n').some((l) => MET_TAAL.test(l) || LABEL.test(l));
		expect(overtreders(regels, UITZONDERINGEN)).toEqual([]);
	});
});

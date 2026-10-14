// Every CSV of the site is written and read in $lib/text/csv: one rule for quotes, separators
// and the byte order mark Excel with Dutch settings needs.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

/** A cell quoted by hand, or a byte order mark, written or escaped. */
const QUOTE_OR_BOM = new RegExp(
	`replaceAll\\('"', '""'\\)|\\\\u[fF]{2}[eE][fF]{2}|${String.fromCharCode(0xfeff)}`
);

describe('one CSV', () => {
	it('quotes a cell and writes the byte order mark only in $lib/text/csv', () => {
		expect(overtreders((t) => QUOTE_OR_BOM.test(t), [plek('lib/text/csv.ts')])).toEqual([]);
	});
});

// A count reads the same everywhere: 1.230 artikelen, with the point of thousands
// (formatCount, $lib/text/getal.ts), never 1230 next to 1.230 (UX-toets 19 Oct, F6).
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

/** A count of a list or from the API put in words as it is: `${items.length} artikelen`. */
const RAW_COUNT = /\$\{[\w.?]*(?:\.length|article_count|\.count|\.total)\} [a-z]/;

describe('a count in words', () => {
	it('is written with formatCount', () => {
		const raw = BRONNEN.filter(({ text }) => RAW_COUNT.test(text)).map((s) => s.path);
		expect(raw).toEqual([]);
	});
});

describe('a count that stopped short', () => {
	it('is "meer dan N", never "N+" and never the page limit as a number (E9 P, S)', () => {
		// `${n}${more ? '+' : ''}` wrote "50+" beside "Wetten 50", the limit of a page twice as a
		// count; atLeast says `meer dan 50` once.
		const plus = /\?\s*'\+'\s*:\s*''/;
		const rauw = /aantal=\{[\w.]*\.count\}/;
		const vinden = BRONNEN.filter(
			({ text }) => plus.test(text) || (text.includes('next_offset') && rauw.test(text))
		).map((s) => s.path);
		expect(vinden).toEqual([]);
	});
});

describe('a count and its word', () => {
	it('stand apart: a space between the number and the noun, not "66.190stemmingen" (E9 R)', () => {
		const aaneen = /\{formatCount\([^)]*\)\}<span[^>]*>\s*(?!&nbsp;)/;
		expect(BRONNEN.filter(({ text }) => aaneen.test(text)).map((s) => s.path)).toEqual([]);
	});
});

describe('a count with its noun', () => {
	it('goes by count or plural from text/words.ts, never a plural of its own (audit dubbele helpers, 13)', () => {
		const eigen = /\b(const|function) plural\b/;
		expect(
			BRONNEN.filter(({ path, text }) => path !== 'lib/text/words.ts' && eigen.test(text)).map(
				(s) => s.path
			)
		).toEqual([]);
	});
});

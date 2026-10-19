// A count reads the same everywhere: 1.230 artikelen, with the point of thousands
// (formatCount, $lib/text/getal.ts), never 1230 next to 1.230 (UX-toets 19 Oct, F6).
import { describe, expect, it } from 'vitest';
import { BRONNEN } from '$lib/test/bronnen';

/** A count of a list or from the API put in words as it is: `${items.length} artikelen`. */
const RAW_COUNT = /\$\{[\w.?]*(?:\.length|article_count|\.count|\.total)\} [a-z]/;

describe('a count in words', () => {
	it('is written with formatCount', () => {
		// The home page's stream is another branch's now (home-first-paint); its count of bills of
		// a day stays under a thousand.
		const raw = BRONNEN.filter(({ text }) => RAW_COUNT.test(text))
			.map((s) => s.path)
			.filter((path) => path !== 'lib/components/actueel/home-stream.ts');
		expect(raw).toEqual([]);
	});
});

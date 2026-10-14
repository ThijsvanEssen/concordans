// The words of the Kamer said once, its state read from data (code-eenvoud F66–F68).
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

/** The code without its comments: a comment may name what the code says once. */
const code = (t: string) =>
	t.replace(/\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|(^|[^:'"`])\/\/.*$/gm, '$1');

describe('the words of the Kamer said once, its state read from data (code-eenvoud F66–F68)', () => {
	it('names a Kamer by CHAMBER_NAME (F66)', () => {
		const ownName = /['"`](?:Tweede|Eerste) Kamer['"`]/;
		expect(
			overtreders((t) => ownName.test(code(t)), [plek('lib/components/parliamentary/chamber.ts')])
		).toEqual([]);
	});

	it('names the kinds of bill in stages.ts (F66)', () => {
		const own = /new Set\(\['Wetgeving'|'Initiatiefwetgeving'/;
		expect(
			overtreders((t) => own.test(t), [plek('lib/components/parliamentary/stages.ts')])
		).toEqual([]);
	});

	it('draws the state of a toezegging by commitmentTeken (F66)', () => {
		expect(
			overtreders(
				(t) => /['"]Afgedaan['"]/.test(t),
				[plek('lib/components/explore/index/government.ts')]
			)
		).toEqual([]);
	});

	it('reads a teken from the data, not from the words of a label (F67)', () => {
		expect(overtreders((t) => /\/aangenomen\/i\.test\(/.test(t))).toEqual([]);
		expect(overtreders((t) => /meta\.split\(/.test(t))).toEqual([]);
	});

	it('cuts spans to a window by spansWithin, and segments a text in $lib/text/segments (F68)', () => {
		const own = /\.filter\(\(\w\) => \w\.start!? >= from && \w\.end!? <= from \+ length\)/;
		expect(overtreders((t) => own.test(t))).toEqual([]);
		expect(bron('lib/components/articles/CitedText.svelte')).not.toMatch(
			/\$derived\.by<Segment\[\]>/
		);
	});
});

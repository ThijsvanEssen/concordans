// One fold (code-eenvoud F64): FoldButton under a key kept in dicht.svelte.ts.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('one fold (code-eenvoud F64)', () => {
	it('folds a heading with FoldButton, under a key that is not its words (F64)', () => {
		// A heading's own button and the keys of a heading inside a section are said once.
		expect(overtreders((t) => /class="(?:kop-knop|wet-knop)"/.test(t))).toEqual([]);
		expect(
			overtreders((t) => /[`'"]sub:/.test(t), [plek('lib/components/ui/dicht.svelte.ts')])
		).toEqual([]);
		// What opens Amendementen from elsewhere and its section share one key, its anchor too.
		const sectie = bron('lib/components/parliamentary/AmendementenDienstregeling.svelte');
		expect(sectie).toContain('sleutel={FOLD.amendments}');
		expect(sectie).toContain('id={FOLD.amendments}');
		// The cards over the canvas are kept as every heading is, in dicht.svelte.ts.
		expect(overtreders((t) => /'concordans:(?:legenda|netwerkpaneel)'/.test(t))).toEqual([]);
	});
});

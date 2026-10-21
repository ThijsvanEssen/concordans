// A clickable block, the same everywhere (code-eenvoud F81): one action decides what a click
// on it is, past its controls and a text selection; one action reads words selected (O4).
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('a clickable block', () => {
	it('reads a text selection only in its own actions', () => {
		expect(
			overtreders(
				(t) => /getSelection\(/.test(t),
				[
					plek('lib/actions/klik.ts', 'blockClick'),
					plek('lib/actions/selection.ts', 'words selected in a text (O4)')
				]
			)
		).toEqual([]);
	});

	it('takes a click on a block through use:blockClick', () => {
		expect(
			overtreders(
				(t) => /\browClick\(/.test(t),
				[
					plek('lib/actions/klik.ts', 'blockClick'),
					plek('lib/components/tijdlijn/Tijdlijn.svelte', 'the timeline keeps its own rows')
				]
			)
		).toEqual([]);
	});
});

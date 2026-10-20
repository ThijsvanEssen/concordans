// One comparison (onderzoeksflow O1, besluit 20B): two tekstversies of one article and an old
// article against its successor read alike, the old text left and the new right, through one
// component. Gelijke pagina's, gelijke ervaring.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

const SHOWS = [
	'lib/components/articles/VersionCompare.svelte',
	'lib/components/articles/ArticleCompare.svelte'
];

describe('one comparison', () => {
	it('shows two texts side by side only through TextCompare', () => {
		expect(
			SHOWS.filter((p) => !bron(p).includes("import TextCompare from './TextCompare.svelte'"))
		).toEqual([]);
		// The rows of a comparison are drawn in one place, its marks in another.
		expect(
			overtreders(
				(t) => /class="row row--/.test(t),
				[plek('lib/components/articles/TextCompare.svelte', 'the one comparison')]
			)
		).toEqual([]);
		expect(
			overtreders(
				(t) => /<(ins|del)\b/.test(t),
				[plek('lib/components/articles/Marked.svelte', 'the marks of a comparison')]
			)
		).toEqual([]);
	});

	it('compares by one function of $lib/text/version-diff', () => {
		expect(
			overtreders(
				(t) => /\bdiffWords\(|\balignUnits\(/.test(t),
				[plek('lib/text/version-diff.ts', 'the comparison itself')]
			)
		).toEqual([]);
	});
});

// A link out of Concordans says so with one arrow: the CSS of a[rel~='external']
// (lib/styles/basis.css). Every link that opens elsewhere carries that rel; none draws the arrow itself.
import { describe, expect, it } from 'vitest';
import { bron, overtreders } from '$lib/test/bronnen';

describe('links naar buiten', () => {
	it('draws the arrow once, in the CSS', () => {
		expect(bron('lib/styles/basis.css')).toContain("a[rel~='external']::after");
	});

	it('draws it as text, not as the emoji of iOS (U+FE0E)', () => {
		expect(bron('lib/styles/basis.css')).toMatch(/content: '\\00a0\\2197\\FE0E';/);
	});

	it('marks every link that opens a new tab as external', () => {
		expect(
			overtreders((t) =>
				[...t.matchAll(/<(?:a|TekstLink)\b[^>]*target="_blank"[^>]*>/g)].some(
					(m) => !/rel="[^"]*\bexternal\b/.test(m[0])
				)
			)
		).toEqual([]);
	});

	it('writes no arrow in a component: the rel does', () => {
		expect(overtreders((t) => /↗\s*<\/(?:a|TekstLink)/.test(t))).toEqual([]);
	});
});

// A link out of Concordans says so with one arrow: the CSS of a[rel~='external']
// (lib/styles/basis.css). Every link that opens elsewhere carries that rel; none draws the arrow itself.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, type Uitzondering } from '$lib/test/bronnen';

const kaart: Uitzondering = {
	pad: 'lib/map/MapGroups.svelte',
	reden: 'Bron ↗ in the map, in A272'
};

describe('links naar buiten', () => {
	it('draws the arrow once, in the CSS', () => {
		expect(bron('lib/styles/basis.css')).toContain("a[rel~='external']::after");
	});

	it('marks every link that opens a new tab as external', () => {
		expect(
			overtreders(
				(t) =>
					[...t.matchAll(/<(?:a|TekstLink)\b[^>]*target="_blank"[^>]*>/g)].some(
						(m) => !/rel="[^"]*\bexternal\b/.test(m[0])
					),
				[kaart]
			)
		).toEqual([]);
	});

	it('writes no arrow in a component: the rel does', () => {
		expect(overtreders((t) => /↗\s*<\/(?:a|TekstLink)/.test(t), [kaart])).toEqual([]);
	});
});

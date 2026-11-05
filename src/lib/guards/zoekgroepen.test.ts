// The groups of a search stand in one order, in the typeahead and on /zoeken alike: both take
// `groupOrder` and `slots` from present.ts and keep no order or pick of their own (`orderGroups`
// is theirs alone, `SEARCH_KINDS` only the kinds), and no hit stands above the groups.
import { describe, expect, it } from 'vitest';
import { bron } from '$lib/test/bronnen';

const SURFACES = ['lib/search/session.svelte.ts', 'routes/(main)/zoeken/+page.svelte'];

describe('the groups of a search, typeahead and page', () => {
	it('stand in the order of groupOrder', () => {
		for (const pad of SURFACES) {
			const text = bron(pad);
			expect(text, pad).toMatch(/\bgroupOrder\(/);
			expect(text, pad).toMatch(/\bslots\(/);
		}
	});

	it('keep no order of their own', () => {
		for (const pad of SURFACES) {
			expect(bron(pad), pad).not.toMatch(/\borderGroups\(|Beste treffer/);
		}
	});
});

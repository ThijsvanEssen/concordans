// The groups of a search stand in one order and one Beste treffer, in the typeahead and on
// /zoeken alike: both take `groupOrder`, `bestEarly` and `slots` from present.ts and keep no
// order or pick of their own, and the Beste treffer stands once the lead lane is in (`leadIn`),
// not once every lane is in (`orderGroups` is theirs alone, `SEARCH_KINDS` only the kinds).
import { describe, expect, it } from 'vitest';
import { bron } from '$lib/test/bronnen';

const SURFACES = ['lib/search/session.svelte.ts', 'routes/(main)/zoeken/+page.svelte'];

describe('the groups of a search, typeahead and page', () => {
	it('stand in the order of groupOrder, under the Beste treffer of bestEarly', () => {
		for (const pad of SURFACES) {
			const text = bron(pad);
			expect(text, pad).toMatch(/\bgroupOrder\(/);
			expect(text, pad).toMatch(/\bbestEarly\(/);
			expect(text, pad).toMatch(/\bleadIn\b/);
			expect(text, pad).toMatch(/\bslots\(/);
		}
	});

	it('keep no order of their own', () => {
		for (const pad of SURFACES) {
			expect(bron(pad), pad).not.toMatch(/\borderGroups\(|\bbestHit\(|\bpickBest\(/);
		}
	});
});

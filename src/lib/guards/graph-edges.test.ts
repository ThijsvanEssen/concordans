// The graph store takes bronnen off the canvas in one place, and its lists of neighbours are
// built in one place: no second loop that forgets an edge or the trim order. Where a
// verbinding lands, one function decides.
import { describe, expect, it } from 'vitest';
import { overtreders, plek } from '$lib/test/bronnen';

describe('the graph and its edges', () => {
	it('takes nodes off the canvas only through removeNodes', () => {
		expect(
			overtreders((t) => /\bnodes\.delete\(/.test(t), [plek('lib/graph/store/context.ts')])
		).toEqual([]);
	});

	it('decides where a verbinding lands only in placeConnection (code-eenvoud F93)', () => {
		expect(
			overtreders(
				(t) => /\bisContainerMembership\(|\bisContainment\(/.test(t),
				[
					plek('lib/graph/store/placement.ts'),
					plek('lib/graph/container-membership.ts', 'where membership is defined')
				]
			)
		).toEqual([]);
	});

	it('starts a list in a map only through pushTo', () => {
		expect(overtreders((t) => /\.set\([^)]*,\s*\[\]\)\.get\(/.test(t))).toEqual([]);
	});
});

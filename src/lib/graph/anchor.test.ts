import { describe, expect, it } from 'vitest';
import { redundantAnchors, type AnchorInput } from './anchor';

// Art. 3:4 and 3:2 Awb chosen together: the Awb is the bron they share, drawn as an
// anchor with a PART_OF line from each, while both articles are already in its hull.
const AWB = 'instruments/bwbr0005537';
const A34 = 'articles/bwbr0005537_3_4';
const A32 = 'articles/bwbr0005537_3_2';

function input(edges: [string, string][], members = [AWB, A34, A32]): AnchorInput {
	const hull = { members: new Set(members) };
	return {
		anchors: [AWB],
		groupsOf: (id) => (hull.members.has(id) ? [hull] : []),
		neighboursOf: (id) => edges.flatMap(([a, b]) => (a === id ? [b] : b === id ? [a] : [])),
		drawnMember: (id) => id !== AWB
	};
}

describe('redundantAnchors', () => {
	it('leaves out the anchor of a hull that holds its bronnen: no point, no lines', () => {
		expect(
			redundantAnchors(
				input([
					[A34, AWB],
					[A32, AWB]
				])
			)
		).toEqual(new Set([AWB]));
	});

	it('keeps the anchor a bron outside the hull points at', () => {
		const dossier = 'dossiers/36621';
		expect(
			redundantAnchors(
				input(
					[
						[A34, AWB],
						[dossier, AWB]
					],
					[AWB, A34, A32]
				)
			).size
		).toBe(0);
	});

	it('keeps an anchor alone in its hull: it is all the hull has', () => {
		expect(redundantAnchors(input([], [AWB])).size).toBe(0);
	});
});

// The canvas of the network: one system of shapes (code-eenvoud F82), and the components that
// draw it hand the geometry to pure modules with tests of their own (F91).
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron } from '$lib/test/bronnen';

const COMPONENTS = BRONNEN.filter((s) => /^lib\/components\/graph\/\w+\.svelte$/.test(s.path));

describe('the canvas', () => {
	it('draws every bron as its vorm of vormen.ts', () => {
		// No shape per kind beside the vormen of vormen.ts.
		expect(bron('lib/components/graph/nodeSprites.ts')).not.toMatch(
			/KIND_SHAPE|spriteFor\(|fillFor|strokeFor/
		);
	});

	it('leaves the geometry of hulls, layout and cards to their modules', () => {
		// $lib/graph/hull.ts and the scene's layout, each with its tests.
		const geometry =
			/hullOutline\(|exitPoint\(|GOLDEN_ANGLE|passenSamen\(|\.addUndirectedEdgeWithKey\(/;
		expect(COMPONENTS.filter((s) => geometry.test(s.text)).map((s) => s.path)).toEqual([]);
	});

	it('asks the graph whether a node or an edge is there instead of catching', () => {
		expect(COMPONENTS.filter((s) => /\btry\s*\{/.test(s.text)).map((s) => s.path)).toEqual([]);
	});
});

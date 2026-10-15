// The canvas of the network: one system of shapes (code-eenvoud F82), and the components that
// draw it hand the geometry to pure modules with tests of their own (F91).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron } from '$lib/test/bronnen';

const COMPONENTS = BRONNEN.filter((s) => /^lib\/components\/graph\/\w+\.svelte$/.test(s.path));

describe('the canvas', () => {
	it('draws every bron as its vorm, with sigma’s image program alone', () => {
		const canvas = bron('lib/components/graph/GraphCanvas.svelte');
		expect(canvas).toMatch(/nodeProgramClasses: \{ image: NodeImageProgram \}/);
		expect(canvas).toMatch(/defaultNodeType: 'image'/);
		const pkg = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
		expect(Object.keys(pkg.dependencies)).not.toContain('@sigma/node-border');
		expect(Object.keys(pkg.dependencies)).not.toContain('@sigma/node-square');
		// No shape per kind beside the vormen of vormen.ts.
		expect(bron('lib/components/graph/nodeSprites.ts')).not.toMatch(
			/KIND_SHAPE|spriteFor\(|fillFor|strokeFor/
		);
	});

	it('leaves the geometry of hulls, layout and cards to their modules', () => {
		// hulls.ts, $lib/graph/layout.ts and $lib/selection/card-place.ts, each with its tests.
		const geometry =
			/hullOutline\(|exitPoint\(|GOLDEN_ANGLE|passenSamen\(|\.addUndirectedEdgeWithKey\(/;
		expect(COMPONENTS.filter((s) => geometry.test(s.text)).map((s) => s.path)).toEqual([]);
	});

	it('asks the graph whether a node or an edge is there instead of catching graphology', () => {
		expect(COMPONENTS.filter((s) => /\btry\s*\{/.test(s.text)).map((s) => s.path)).toEqual([]);
	});
});

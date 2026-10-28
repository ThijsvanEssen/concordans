// The canvas and the Netwerkschets draw a hull and a cluster by the same measures
// ($lib/graph/draw-spec): the canvas's CSS and the sketch read them, they are not typed twice.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { HULL } from '$lib/graph/draw-spec';

const source = (path: string) => readFileSync(`src/${path}`, 'utf8');

describe('the shared measures of canvas and sketch', () => {
	it('holds the canvas CSS of a hull to the spec', () => {
		const css = source('lib/components/graph/GraphCanvas.svelte');
		expect(css).toContain(`stroke-width: ${HULL.line};`);
		expect(css).toContain(`stroke-width: ${HULL.lineChosen};`);
		expect(css).toContain(`stroke-width: ${HULL.halo};`);
	});

	it('has the sketch and the canvas read the spec, not their own numbers', () => {
		expect(source('lib/verbonden/NetworkSketch.svelte')).toContain("from '$lib/graph/draw-spec'");
		expect(source('lib/components/graph/hulls.ts')).toContain("from '$lib/graph/draw-spec'");
		expect(source('lib/components/graph/nodeSprites.ts')).toContain('CLUSTER_FILL');
	});

	it('draws a hull of the sketch with the canvas kind colour and dash, nothing of its own', () => {
		const sketch = source('lib/verbonden/NetworkSketch.svelte');
		expect(sketch).toContain('hullColorFor(h.kind)');
		expect(sketch).toContain('hullDashFor(h.kind)');
		expect(sketch).not.toMatch(/stroke-dasharray="\d/);
	});
});

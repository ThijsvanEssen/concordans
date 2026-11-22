// The Netwerkschets draws a hull and a cluster by the measures of $lib/graph/draw-spec and the
// colours and dashes of nodeSprites: it has none of its own.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(`src/${path}`, 'utf8');

describe('the measures of the sketch', () => {
	it('reads the spec, not its own numbers', () => {
		expect(source('lib/verbonden/NetworkSketch.svelte')).toContain("from '$lib/graph/draw-spec'");
	});

	it('draws a hull with the kind colour and dash, nothing of its own', () => {
		const sketch = source('lib/verbonden/NetworkSketch.svelte');
		expect(sketch).toContain('hullColorFor(h.kind)');
		expect(sketch).toContain('hullDashFor(h.kind)');
		expect(sketch).not.toMatch(/stroke-dasharray="\d/);
	});
});

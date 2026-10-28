import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const chain = readFileSync('src/lib/network/ChainView.svelte', 'utf8');

// Besluit 39 (A306): in the keten the layer is the group. No omhulling and no pill of its own;
// a wet's articles stand under a small subkop; the lines are one stamboom, drawn in one place.
describe('Keten', () => {
	it('has no omhulling and no pill with a name', () => {
		expect(chain).not.toMatch(/hullDashFor|class="hull"|class="pil"|hullHeight/);
	});
	it('draws its lines through tree-lines.ts only, never as a straight or orthogonal path of its own', () => {
		expect(chain).toMatch(/treeLines\(/);
		expect(chain).not.toMatch(/curvedLine|clearBend/);
	});
	it('takes the order and colours of a person’s layers from person-layers.ts', () => {
		expect(chain).toMatch(/sectionColour/);
		expect(readFileSync('src/lib/network/lineage.ts', 'utf8')).toMatch(/PERSON_LAYERS/);
	});
	it('lets the keyboard go layer by layer, each layer’s Alle after its bronnen', () => {
		const svg = chain.slice(chain.indexOf('<svg'), chain.indexOf('</svg>'));
		expect(svg.indexOf('class="others"')).toBeGreaterThan(svg.lastIndexOf('class="node"'));
	});
	it('shows Alle on a phone as a framed button, a finger’s height', () => {
		expect(chain).toMatch(/class="btn alle"/);
		expect(chain).not.toMatch(/btn is-text alle/);
	});
	it('draws the sign of a row in the list as the drawing does, one KindGlyph', () => {
		expect(chain).toMatch(/<KindGlyph vorm=\{vormKey\(k\)\}/);
		expect(chain).not.toMatch(/<i class="mark"/);
	});
	it('leaves room under the list for the floating Weergave button', () => {
		expect(chain).toMatch(/calc\(var\(--s-8\) \+ var\(--s-4\)\)/);
	});
});

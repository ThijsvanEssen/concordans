import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const chain = readFileSync('src/lib/network/ChainView.svelte', 'utf8');

// Besluit 39 (A306): in the keten the layer is the group. No omhulling and no pill of its own;
// the articles a regeling rests on stand as a label on its line; the lines are one stamboom, drawn in one place.
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
		expect(svg.indexOf('class="others')).toBeGreaterThan(svg.lastIndexOf('class="node"'));
	});
	it('shows Alle on a phone as a framed button, a finger’s height', () => {
		expect(chain).toMatch(/class="btn alle"/);
		expect(chain).not.toMatch(/btn is-text alle/);
	});
	it('draws the sign of a row in the list as the drawing does, one KindGlyph', () => {
		expect(chain).toMatch(/<KindGlyph vorm=\{vormKey\(k\)\}/);
		expect(chain).not.toMatch(/<i class="mark"/);
	});
	it('has Weergave in the bar above its list on a phone, not floating over a row (B48)', () => {
		const view = readFileSync('src/lib/components/graph/GraphView.svelte', 'utf8');
		expect(view).toMatch(/\{#if midden\}\s*\{@render sheetButton\(\)\}/);
		expect(view).toMatch(/\{#if !midden\}\{@render sheetButton\(\)\}\{\/if\}/);
	});
	it('says the articles on a line through cite-label.ts only: the drawing and the glance read one label', () => {
		expect(chain).toMatch(/citeText\(/);
		expect(chain).not.toMatch(/art\. \$\{|' art\. '/);
		expect(chain).not.toMatch(/id === 'article'/);
		const chainTs = readFileSync('src/lib/network/chain.ts', 'utf8');
		expect(chainTs).toMatch(/citeOf\(/);
		expect(chainTs).not.toMatch(/id: 'article'/);
	});
	it('draws the label on a line as a link with a glance, never as dead text', () => {
		const svg = chain.slice(chain.indexOf('<svg'), chain.indexOf('</svg>'));
		expect(svg).toMatch(/<a\s+class="cite"\s+href=\{l\.citeHref/);
		expect(svg).toMatch(/onfocus=\{\(e\) => citeGlance\(/);
		expect(svg).not.toMatch(/<g class="cite">/);
	});
});

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
});

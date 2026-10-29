import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const canvas = readFileSync(new URL('./GraphCanvas.svelte', import.meta.url), 'utf8');
const view = readFileSync(new URL('./GraphView.svelte', import.meta.url), 'utf8');
const stip = readFileSync(new URL('../../proposals/ProposalDot.svelte', import.meta.url), 'utf8');

describe('the states of a bron on the canvas (Netwerkcanvas)', () => {
	it('carries Openstaand always: a small dot in the colour of Kamerstukken, outside the sign', () => {
		expect(canvas).toContain('data-openstaand');
		// The one dot (proposals/ProposalDot.svelte), also in Tonen and the card.
		expect(canvas).toMatch(/class="openstaand-stip"[\s\S]{0,160}<ProposalDot \/>/);
		expect(stip).toMatch(/\.stip \{[^}]*background: var\(--rubriek-kamerstukken\)/s);
		expect(canvas).not.toMatch(/mutatieActive|latestMutatieActive/);
		expect(canvas).not.toContain('Overlay');
	});

	it('has no heat: the citations per month are gone with their code', () => {
		for (const source of [canvas, view]) expect(source).not.toMatch(/heat/i);
	});

	it('draws a thread without an arrow and a line of a chosen bron in full', () => {
		expect(canvas).toMatch(/draadType/);
		expect(canvas).toMatch(/touchesChosen\(src, tgt\)/);
	});
});

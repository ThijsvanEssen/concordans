// The werkplek in three strips (besluit 39): the panel Netwerk and the legend at the left, the
// card of a bron at the right; over the canvas only the zoom and a cluster's card, in the
// controls and the colours of the rest of the site.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, regels } from '$lib/test/bronnen';

describe('the network and its cards', () => {
	it('draws the panel Netwerk and a cluster with CanvasKaart: one frame, one width', () => {
		// Thijs, 10 Oct: "Deze mogen even breed zijn en hetzelfde soort component zijn". The
		// folded Netwerk took its content's width (`width: auto`). Width and right edge are
		// --paneel-breed and --paneel-rand, CanvasKaart's.
		const kaart = /^\.(netwerk|legenda|cluster-kaart)$/;
		expect(
			overtreders((t) =>
				regels(t).some(
					(r) =>
						kaart.test(r.selector.trim()) &&
						(/(?<![-\w])width:\s*\d/.test(r.body) || /(?<![-\w])right:\s*var\(--s-/.test(r.body))
				)
			)
		).toEqual([]);
		const graph = bron('lib/components/graph/GraphView.svelte');
		const netwerk = bron('lib/selection/NetwerkPanel.svelte');
		expect(graph).toMatch(/<CanvasKaart[^>]*class="cluster-kaart"/);
		expect(netwerk).toMatch(/<CanvasKaart[^>]*class="netwerk"/);
		const eigenKader = (t: string) =>
			regels(t).some(
				(r) =>
					/\.(netwerk|legenda|cluster-kaart)(?![-\w])/.test(r.selector) &&
					/(?<![-\w])(border|background|box-shadow):|(?<![-\w])width:\s*(?!\s|auto)/.test(r.body)
			);
		expect(
			[
				['lib/components/graph/GraphView.svelte', graph],
				['lib/selection/NetwerkPanel.svelte', netwerk]
			]
				.filter(([, t]) => eigenKader(t))
				.map(([p]) => p)
		).toEqual([]);
	});

	it('keeps red out of the network: its colours are --netwerk-* tokens (Thijs, 10 Oct)', () => {
		// Red in the network would only say no; the kinds, the focus and a chosen verbinding
		// take the tokens.
		expect(
			BRONNEN.filter(
				(s) =>
					/^lib\/(components\/graph|netwerk|graph)\//.test(s.path) &&
					/--accent|\baccent\b|accentSoft|#8c2f28/i.test(s.text)
			).map((s) => s.path)
		).toEqual([]);
	});

	it('gives the cards the controls of the rest of the site, one filled button: Lees', () => {
		// A menu is TekstMenu, a filter a FilterOptie or a Keuze: no menu of their own
		// (<details>). The one filled button of the werkplek is Lees on the card of a bron.
		expect(
			BRONNEN.filter(
				(s) =>
					/^lib\/(components\/graph|netwerk)\//.test(s.path) &&
					(/<details\b/.test(s.text) ||
						(/class="btn is-primary"/.test(s.text) &&
							s.path !== 'lib/components/graph/CanvasHoverCard.svelte'))
			).map((s) => s.path)
		).toEqual([]);
		expect(bron('lib/components/graph/CanvasHoverCard.svelte')).toMatch(
			/class="btn is-primary"[\s\S]*?>Lees</
		);
	});

	it('lets a Tab reach the strip at the left before the canvas, the card after it', () => {
		const t = bron('lib/components/graph/GraphView.svelte');
		const opmaak = t.slice(t.indexOf('<div class="graph-view">'));
		const plaats = (c: string) => opmaak.indexOf(c);
		expect(plaats('{@render canvasOverlay?.()}')).toBeGreaterThan(-1);
		expect(plaats('{@render canvasOverlay?.()}')).toBeLessThan(plaats('legenda-inhoud"'));
		expect(plaats('legenda-inhoud"')).toBeLessThan(plaats('<CanvasNodeList'));
		expect(plaats('class="graph-canvas-wrap"')).toBeLessThan(plaats('<CanvasHoverCard'));
		// Nothing floats over the canvas but the zoom and a cluster's card: no Legenda card.
		expect(t).not.toMatch(/class="canvas-overlay"|class="legenda"/);
		expect(plaats('<CanvasNodeList')).toBeLessThan(plaats('class="graph-canvas-wrap"'));
		// The list of bronnen is visible where it has the focus: the canvas takes its outline.
		expect(t).toMatch(/\.buhne:has\(\.canvas-node-list :focus-visible\) \.graph-canvas-wrap/);
	});

	it('keeps the contents narrow beside the text, never the network’s width (A190)', () => {
		const t = bron('routes/explore/+page.svelte');
		expect(t).not.toMatch(/--nav-w-auto:\s*calc\([^;]*var\(--graph-w-auto\)/);
		for (const [, w] of t.matchAll(/--nav-w-auto:\s*(\d+)px/g))
			expect(Number(w)).toBeLessThanOrEqual(240);
	});

	it('reads the role of a collection on the canvas from COLLECTION_ROLE (F65)', () => {
		const own = [
			/filter\(\(e\) => e\.relation !== 'VERSION_OF'\)/,
			/instrument: 'Wet',\s*faction: 'Fractie'/,
			/cabinets: 'committee'/,
			/c !== 'cases'|collection === 'cases'\) return null/
		];
		expect(overtreders((t) => own.some((r) => r.test(t)))).toEqual([]);
	});
});

describe('/explore and the werkplek of a bron', () => {
	// Thijs, 23 Oct: "nieuwe functies zijn leidend", "Reuse componenten!": /explore is the same
	// werkplek, with the same components, the same panel and no branch of its own.
	const page = bron('routes/explore/+page.svelte');
	const markup = page.slice(page.indexOf('</script>'));
	it('render one werkplek: one canvas, one panel Netwerk, one Keten, one Verband', () => {
		for (const tag of ['<GraphViewC', '<NetwerkPanel', '<ChainView', '<SharedView'])
			expect(markup.split(tag).length - 1, tag).toBe(1);
	});
	it('have no variant of a werkplek component for an empty canvas or for /explore', () => {
		expect(bron('lib/selection/NetwerkPanel.svelte')).not.toMatch(/\bstart\b\s*[=?:]/);
		expect(markup).not.toMatch(/pathname\s*[!=]==?\s*'\/explore'/);
	});
});

describe('Verband and the API', () => {
	// 23 Oct, 19:50: some 50 pairs asked at once emptied the API's pool of 8.
	const page = bron('routes/explore/+page.svelte');
	it('asks the shared bronnen of its pairs two at a time, for the ends it draws only', () => {
		expect(page).toMatch(/inPool\([\s\S]{0,400}getShared\([\s\S]{0,200}\{ parallel: 2 \}/);
		expect(page).toMatch(/const SHARED_ENDS = 6;/);
		expect(page).not.toMatch(/Promise\.all\([^)]*getShared/);
	});
});

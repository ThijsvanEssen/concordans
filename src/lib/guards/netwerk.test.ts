// The cards over the network stand at one width on one right edge (Thijs, 10 Oct), in the
// controls and the colours of the rest of the site.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, regels } from '$lib/test/bronnen';

describe('the network and its cards', () => {
	it('draws every card over the network with CanvasKaart: one frame, one width', () => {
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
		const netwerk = bron('lib/netwerk/NetwerkPanel.svelte');
		expect(graph).toMatch(/<CanvasKaart[^>]*klasse="legenda"/);
		expect(graph).toMatch(/<CanvasKaart[^>]*klasse="cluster-kaart"/);
		expect(netwerk).toMatch(/<CanvasKaart[^>]*klasse="netwerk"/);
		const eigenKader = (t: string) =>
			regels(t).some(
				(r) =>
					/\.(netwerk|legenda|cluster-kaart)(?![-\w])/.test(r.selector) &&
					!/netwerk--start/.test(r.selector) &&
					/(?<![-\w])(border|background|box-shadow):|(?<![-\w])width:\s*(?!\s|auto)/.test(r.body)
			);
		expect(
			[
				['lib/components/graph/GraphView.svelte', graph],
				['lib/netwerk/NetwerkPanel.svelte', netwerk]
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

	it('gives the cards over the network the controls of the rest of the site', () => {
		// A menu is TekstMenu, an action in a card is text (btn is-text, TekstLink), a filter a
		// FilterOptie or a Keuze: no menu of their own (<details>), no filled button.
		expect(
			BRONNEN.filter(
				(s) =>
					/^lib\/(components\/graph|netwerk)\//.test(s.path) &&
					/<details\b|class="btn is-primary"/.test(s.text)
			).map((s) => s.path)
		).toEqual([]);
	});

	it('lets a Tab reach the cards over the network before the canvas (keyboard audit)', () => {
		const t = bron('lib/components/graph/GraphView.svelte');
		const opmaak = t.slice(t.indexOf('<div class="graph-view">'));
		const plaats = (c: string) => opmaak.indexOf(c);
		expect(plaats('class="canvas-overlay"')).toBeGreaterThan(-1);
		expect(plaats('class="canvas-overlay"')).toBeLessThan(plaats('class="graph-canvas-wrap"'));
		expect(plaats('class="legenda"')).toBeLessThan(plaats('<CanvasNodeList'));
		expect(plaats('<CanvasNodeList')).toBeLessThan(plaats('class="graph-canvas-wrap"'));
		// The list of bronnen is visible where it has the focus: the canvas takes its outline.
		expect(t).toMatch(/\.buhne:has\(\.canvas-node-list :focus-visible\) \.graph-canvas-wrap/);
	});

	it('gives the contents the network’s width from 1440, so every reader title starts in one column', () => {
		expect(bron('routes/explore/+page.svelte')).toMatch(
			/--nav-w-auto:\s*calc\([^;]*var\(--graph-w-auto\)/
		);
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

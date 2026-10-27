// The keyboard: a mark on every focus, a skip link to the list, one main.
import { describe, expect, it } from 'vitest';
import {
	BRONNEN,
	bron,
	overtreders,
	plek,
	regels,
	vondsten,
	type Uitzondering
} from '$lib/test/bronnen';

/** An exception for one rule of a style block, by its selector as written. */
const selector = (pad: string, sel: string, reden: string): Uitzondering => ({
	pad,
	reden,
	regel: new RegExp(`^${sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`)
});

describe('the keyboard', () => {
	it('lets no focus pass without a mark: every outline taken away is named (audit 3)', () => {
		// The ink ring stands on every focus (lib/styles/basis.css, :focus-visible). A rule that takes the
		// outline away gives the focus another mark that is as plain, and says so here.
		const eigen: Uitzondering[] = [
			selector(
				'lib/search/Search.svelte',
				'input',
				'its field carries the ring (.field:focus-within)'
			),
			selector(
				'lib/components/graph/GraphView.svelte',
				'.graph-canvas-wrap:focus',
				'a click on the canvas; :focus-visible has the ring'
			),
			selector(
				'lib/components/ui/TekstMenu.svelte',
				':global(.tekstmenu__item:hover:not(:disabled)), :global(.tekstmenu__item:focus-visible), :global(.tekstmenu__item:focus-within)',
				'an item of an open menu: the wash of the row, as every menu'
			),
			selector(
				'lib/components/explore/Hemicycle.svelte',
				'a',
				'a seat of the hall: its sector in ink'
			),
			selector(
				'lib/components/explore/readers/KamerZetels.svelte',
				'.doel',
				'a seat: its stroke in ink'
			),
			selector(
				'lib/onderwerpen/Kruiswoord.svelte',
				'.cel.vol:hover, .cel.vol:focus-visible',
				'a cell of the grid: an inset line in ink'
			),
			selector(
				'lib/onderwerpen/Kruiswoord.svelte',
				'.knop:hover, .knop:focus-visible',
				'a total of the grid: an inset line in ink, as a cell'
			),
			selector(
				'lib/verbonden/NetworkSketch.svelte',
				'.single:focus:not(:focus-visible), .cluster:focus:not(:focus-visible)',
				'a bron of the drawing clicked: its frame marks it; :focus-visible keeps the ring'
			),
			selector(
				'lib/network/SharedView.svelte',
				'.node:focus:not(:focus-visible)',
				'a shared bron clicked: its frame marks it; :focus-visible keeps the ring'
			),
			selector(
				'lib/network/LinkChains.svelte',
				'.node:focus:not(:focus-visible)',
				'a tussenbron clicked: its frame marks it; :focus-visible keeps the ring'
			),
			selector(
				'lib/network/ChainView.svelte',
				'.node:focus:not(:focus-visible)',
				'a bron of the keten clicked: its frame marks it; :focus-visible keeps the ring'
			),
			selector(
				'lib/styles/basis.css',
				"[tabindex='-1']:focus:not(:focus-visible)",
				'a list reached by its skip link (focus by a click or a script): :focus-visible keeps the ring'
			)
		];
		const zonder = BRONNEN.flatMap(({ path, text }) =>
			regels(text)
				.filter((r) => /outline:\s*(none|0)\b/.test(r.body))
				.map((r) => ({ pad: path, wat: r.selector.replace(/\s+/g, ' ') }))
		);
		expect(vondsten(zonder, eigen)).toEqual([]);
	});

	it('gives a page with a list a second skip link, through AppShell, and one main', () => {
		const shell = bron('lib/components/layout/AppShell.svelte');
		expect(shell).toMatch(/class="skip-link">Naar de lijst<\/a>/);
		for (const pad of [
			'routes/(main)/actueel/+page.svelte',
			'lib/components/explore/IndexView.svelte'
		])
			expect(bron(pad)).toMatch(/use:lijstDoel/);
		// A bron's panes beside its text, past the text's own tab stops (UX-toets 10 Oct, #22).
		expect(shell).toMatch(/\$paneelSprongen as s/);
		const explore = bron('routes/explore/+page.svelte');
		expect(explore).toMatch(/label: 'Naar Verbonden'/);
		// One main on a page: AppShell's.
		const zonderUitleg = (t: string) =>
			t.replace(/<!--[\s\S]*?-->/g, '').replace(/^\s*\/\/.*$/gm, '');
		expect(
			overtreders(
				(t) => /<main\b/.test(zonderUitleg(t)),
				[plek('lib/components/layout/AppShell.svelte')]
			)
		).toEqual([]);
	});
});

// The navigation is filled once (besluit 36): the bar of a wide screen and the tab bar of a
// phone read the same lists of sources and of Mijn, and the Netwerk button is one component
// whose address is made in one place.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('the navigation', () => {
	it('fills the bar and the tab bar from one list of sources and one of Mijn', () => {
		expect(bron('lib/components/layout/TopBar.svelte')).toContain('{#each SOURCES as');
		expect(bron('lib/components/layout/TabBar.svelte')).toContain('{#each SOURCES as');
		expect(bron('lib/components/layout/TabBar.svelte')).toContain('{#each MINE as');
		expect(bron('lib/components/layout/MineMenu.svelte')).toContain('{#each MINE as');
		// A kind of source is named in lib/nav/sources.ts only.
		expect(
			overtreders((t) => />(Wetten|Uitspraken|Kamerstukken|Parlement|Regering)<\/a/.test(t))
		).toEqual([]);
	});

	it('draws one Netwerk button, in the bar, and makes its address in one place', () => {
		expect(
			overtreders((t) => /<NetworkButton\b/.test(t), [plek('lib/components/layout/TopBar.svelte')])
		).toEqual([]);
		expect(
			overtreders(
				(t) => /\bnetworkHref\(/.test(t),
				[plek('lib/nav/network.ts'), plek('lib/components/layout/NetworkButton.svelte')]
			)
		).toEqual([]);
		expect(bron('lib/components/layout/NetworkButton.svelte')).toContain("'Netwerk'");
	});

	it('draws one tab bar, in the shell, and no Samenhang in the menus', () => {
		expect(
			overtreders((t) => /<TabBar\b/.test(t), [plek('lib/components/layout/AppShell.svelte')])
		).toEqual([]);
		for (const pad of ['TopBar', 'TabBar', 'MineMenu', 'NetworkButton'])
			expect(bron(`lib/components/layout/${pad}.svelte`)).not.toMatch(/Samenhang|Bronnen</);
	});
});

// Controls in five forms (docs/bediening.md, Thijs, 10 Oct 2026).
import { describe, expect, it } from 'vitest';
import { bron, isControl, overtreders, plek, regels, type Uitzondering } from '$lib/test/bronnen';

describe('controls in five forms (docs/bediening.md, Thijs, 10 Oct 2026)', () => {
	it('chooses one of many with TekstMenu, not a native select', () => {
		expect(overtreders((t) => /<select\b/.test(t))).toEqual([]);
	});

	it('shows a choice in the control itself, without chips', () => {
		const chips: Uitzondering[] = [
			{
				pad: 'lib/selection/NetwerkPanel.svelte',
				reden: 'the chosen bronnen: content, not a filter'
			}
		];
		expect(overtreders((t) => /class="[^"]*\bchip\b/.test(t), chips)).toEqual([]);
	});

	it('leads on from a list with AlleN, not a "meer" of its own', () => {
		// A class token named more or meer: `group__more`, `load-more-btn`, `chip--meer`.
		const meer = (t: string) =>
			[...t.matchAll(/class="([^"]*)"/g)].some((m) =>
				m[1].split(/\s+/).some((c) => /(^|[_-])(more|meer)($|[_-])/.test(c))
			);
		expect(overtreders(meer)).toEqual([]);
	});

	it('frames a button only as the Knop (.btn, is-groot) or the IconButton', () => {
		// A frame in the control's face, or a frame and a pointer, is a button (a field aside);
		// its one form is in lib/styles/basis.css and IconButton.
		const knop = (r: { selector: string; body: string }) =>
			/border:\s*1px solid/.test(r.body) &&
			/var\(--font-ui\)|cursor:\s*pointer/.test(r.body) &&
			!/(input|textarea|select|kbd)\b[^,]*$/.test(r.selector);
		const eigen: Uitzondering[] = [
			{ pad: 'lib/styles/basis.css', reden: 'the Knop itself' },
			{ pad: 'lib/components/ui/IconButton.svelte', reden: 'the one icon button' },
			{
				pad: 'lib/components/layout/TopBar.svelte',
				reden: 'the search in the bar looks as the field it opens'
			},
			{
				pad: 'lib/selection/NetwerkPanel.svelte',
				reden: 'the example in an empty netwerk is a card, not a button'
			}
		];
		expect(overtreders((t) => regels(t).some(knop), eigen)).toEqual([]);
	});

	it('draws an item of a menu with tekstmenu__item', () => {
		// An item's hover is TekstMenu's: a menu of its own adds a class for its layout only.
		const item = (r: { selector: string; body: string }) =>
			/menu-?item|__item\b|-item\b/.test(r.selector) &&
			/background:\s*var\(--paper-2\)/.test(r.body);
		expect(
			overtreders(
				(t) => regels(t).some(item),
				[plek('lib/components/ui/TekstMenu.svelte', 'the one item')]
			)
		).toEqual([]);
	});

	it('styles Verfijnen once, in lib/styles/basis.css', () => {
		expect(
			overtreders(
				(t) =>
					regels(t).some(
						(r) =>
							/\.verfijnen-knop\b/.test(r.selector) && /font-family|text-decoration/.test(r.body)
					),
				[plek('lib/styles/basis.css')]
			)
		).toEqual([]);
	});

	it('sizes a control at the height of a page or of a panel', () => {
		// 32 px on a page (--veld-h), 24 px in a panel or a group (--veld-h-klein), 44 px for a
		// finger on a touch screen (--veld-h-raak).
		const hoog = (body: string) =>
			[...body.matchAll(/(?<![-\w])height:\s*([^;]+);/g)].some(
				(m) => !/^(var\(--veld-h(-klein|-raak)?\)|auto|100%)$/.test(m[1].trim())
			);
		expect(
			overtreders((t) => regels(t).some((r) => isControl(r.selector) && hoog(r.body)))
		).toEqual([]);
	});

	it('draws a ticked box with Vinkje: no tick glyph, no native checkbox', () => {
		expect(overtreders((t) => /✓|type="checkbox"/.test(t))).toEqual([]);
	});

	it('chooses a Kamer with a Keuze, never with boxes (docs/bediening.md)', () => {
		expect(
			overtreders(
				(t) =>
					/kind: 'list',[^}]{0,300}Tweede Kamer/.test(t) ||
					/\[\{ c: 'TK', label: 'Tweede Kamer' \}[^\n]*\n[^\n]*<FilterOptie/.test(t)
			)
		).toEqual([]);
	});

	it('draws every option of a filter with FilterOptie', () => {
		expect(overtreders((t) => /class="(box|opt|check__box)"/.test(t))).toEqual([]);
	});

	it('gives the actions of a row one look: two fixed places, a glyph without a frame', () => {
		// Thijs, 10 Oct: "toch wat raar met de verschillen in hoe ze weergegeven worden".
		const t = bron('lib/components/ui/RijActies.svelte');
		expect(t).not.toMatch(/IconButton/);
		expect(t.match(/<span class="plek"[\s>]/g)).toHaveLength(2);
		expect(regels(t).some((r) => /(?<![-\w])border:\s*(?!\s|0)/.test(r.body))).toBe(false);
		// Where a verbinding comes from is words in the row's meta line, not a box over the
		// next row ("Herkend in de tekst" was "out of place").
		const rij = bron('lib/verbonden/VerbondenRow.svelte');
		expect(rij).not.toMatch(/row__herkomst/);
		expect(rij).toMatch(/row__part--herkomst/);
	});

	it('keeps the choice of bronnen in the filter, not in the head of Verbonden', () => {
		// Thijs, 11 Oct: the groups below already are the kinds chosen; the menu Bronnen in the
		// choose-line went. The presets and the kinds stay reachable in the filter sheet.
		const verbonden = bron('lib/verbonden/Verbonden.svelte');
		expect(verbonden).not.toMatch(/label="Bronnen"/);
		expect(verbonden).not.toMatch(/\bPRESETS\b/);
		expect(verbonden).toMatch(/onclick=\{onOpenFilter\}>Filter</);
		const sheet = bron('lib/verbonden/FilterSheet.svelte');
		expect(sheet).toMatch(/#each PRESETS as p/);
		expect(sheet).toMatch(/#each FILTER_GROUPS as k/);
	});
});

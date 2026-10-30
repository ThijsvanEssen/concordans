// Controls in five forms (docs/bediening.md, Thijs, 10 Oct 2026).
import { describe, expect, it } from 'vitest';
import {
	BRONNEN,
	bron,
	isControl,
	overtreders,
	plek,
	regels,
	vondsten,
	type Uitzondering
} from '$lib/test/bronnen';

describe('controls in five forms (docs/bediening.md, Thijs, 10 Oct 2026)', () => {
	it('chooses one of many with TekstMenu, not a native select', () => {
		expect(overtreders((t) => /<select\b/.test(t))).toEqual([]);
	});

	it('shows a choice in the control itself, without chips', () => {
		const chips: Uitzondering[] = [
			{
				pad: 'lib/components/explore/index/FilterBar.svelte',
				reden: 'the filters chosen by the count of a list, each taking it off (besluit 40)'
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

	it('frames a button only as the Knop (.btn) or the IconButton', () => {
		// A frame in the control's face, or a frame and a pointer, is a button (a field aside);
		// its one form is in lib/styles/basis.css and IconButton.
		const knop = (r: { selector: string; body: string }) =>
			/border:\s*1px solid/.test(r.body) &&
			/var\(--font-ui\)|cursor:\s*pointer/.test(r.body) &&
			!/(input|textarea|select|kbd)\b[^,]*$/.test(r.selector);
		const eigen: Uitzondering[] = [
			{ pad: 'lib/styles/basis.css', reden: 'the Knop itself' },
			{ pad: 'lib/components/ui/IconButton.svelte', reden: 'the one icon button' },
			{ pad: 'lib/components/ui/Tekstveld.svelte', reden: 'the one text field' },
			{
				pad: 'lib/components/layout/TopBar.svelte',
				reden: 'the search in the bar looks as the field it opens'
			}
		];
		expect(overtreders((t) => regels(t).some(knop), eigen)).toEqual([]);
	});

	it('draws a text field as the Tekstveld, with the 16 px of a phone', () => {
		// A text input or a textarea is the field's one form (ui/Tekstveld.svelte). The files below
		// still draw their own; the list only gets shorter (P2, A250, A254, A255).
		const veld = (t: string) =>
			[...t.replace(/<!--[\s\S]*?-->/g, '').matchAll(/<(input|textarea)\b[^>]*>/g)].some(
				([tag]) => !/type="(checkbox|radio|file|range|hidden)"/.test(tag)
			);
		const nog = (pad: string, reden: string): Uitzondering => ({ pad, reden });
		expect(
			overtreders(
				(t) => t.includes('<script') && veld(t.replace(/<script[\s\S]*?<\/script>/g, '')),
				[
					plek('lib/components/ui/Tekstveld.svelte', 'the one text field'),
					nog('lib/search/Search.svelte', 'the search overlay (P2)'),
					nog('lib/components/ui/Periode.svelte', 'the dates of Periode (A250)')
				]
			)
		).toEqual([]);
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

	it('has no Verfijnen: the filters of a phone are FilterBar alone, with Toon (besluit 30, X4)', () => {
		expect(overtreders((t) => /verfijnen-knop|<Verfijnen|ui\/Verfijnen/.test(t))).toEqual([]);
		expect(bron('lib/components/explore/index/FilterBar.svelte')).toMatch(
			/onclick=\{\(\) => close\(true\)\}>\{show\}/
		);
	});

	it("sizes a control at one height, or a finger's", () => {
		// 32 px (--veld-h) for every control, a finger's 44 px on a touch screen (--veld-h-raak),
		// and --tik-h (24) for a tap target that is no button with words (the next test).
		const hoog = (body: string) =>
			[...body.matchAll(/(?<![-\w])height:\s*([^;]+);/g)].some(
				(m) => !/^(var\(--(veld-h|veld-h-raak|tik-h)\)|auto|100%)$/.test(m[1].trim())
			);
		expect(
			overtreders((t) => regels(t).some((r) => isControl(r.selector) && hoog(r.body)))
		).toEqual([]);
	});

	it('has three forms of a Knop and no smaller size (besluit 33, A163)', () => {
		// Filled (.btn.is-primary): the one action of a screen. Framed (.btn): an action or a
		// menu, and the frame of a segment. Bare (.btn.is-text): a link beside the text. All at
		// --veld-h with --t-ui; the small size (--veld-h-klein, 24 px, 12 px letters) is gone.
		const modifiers = BRONNEN.flatMap(({ path, text }) =>
			[...text.matchAll(/class(?::|=)"?[^"\n]*?\bbtn\b([^"\n]*)"/g)].flatMap((m) =>
				m[1]
					.split(/\s+/)
					.filter((c) => /^is-/.test(c) && !/^is-(primary|text)$/.test(c))
					.map((c) => ({ pad: path, wat: c }))
			)
		);
		expect(vondsten(modifiers)).toEqual([]);
		expect(overtreders((t) => /--veld-h-klein|--t-ui-micro|\bis-groot\b/.test(t))).toEqual([]);
		const tik = BRONNEN.flatMap(({ path, text }) =>
			regels(text)
				.filter(
					(r) =>
						isControl(r.selector) &&
						/(?<![-\w])(min-)?(height|width):\s*var\(--tik-h\)/.test(r.body)
				)
				.map((r) => ({ pad: path, wat: r.selector }))
		);
		// A tap target of 24 px is an icon, a glyph, a cell or a bare text link, never a button
		// with words in a frame.
		const tikken: Uitzondering[] = [
			{ pad: 'lib/styles/basis.css', reden: 'the bare Knop (is-text) is a text link' },
			{ pad: 'lib/onderwerpen/Kruiswoord.svelte', reden: 'a total is a cell of a table' }
		];
		expect(vondsten(tik, tikken)).toEqual([]);
		// Ink fills the one action (.btn.is-primary in basis.css), not a control of another form.
		const vlak = BRONNEN.flatMap(({ path, text }) =>
			regels(text)
				.filter(
					(r) =>
						/background:\s*var\(--ink\)/.test(r.body) &&
						isControl(r.selector) &&
						!/^\.btn\.is-primary/.test(r.selector)
				)
				.map((r) => ({ pad: path, wat: r.selector }))
		);
		const vlakken: Uitzondering[] = [
			{ pad: 'lib/onderwerpen/Kruiswoord.svelte', reden: 'a chosen total in a table' }
		];
		expect(vondsten(vlak, vlakken)).toEqual([]);
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

	it('keeps the choice of bronnen in the filter of the table, not in the head of Verbonden', () => {
		// Thijs, 11 Oct: the groups below already are the kinds chosen; the menu Bronnen in the
		// choose-line went. The presets and the kinds stay reachable in the filter sheet.
		const verbonden = bron('lib/verbonden/Verbonden.svelte');
		expect(verbonden).not.toMatch(/label="Bronnen"/);
		expect(verbonden).not.toMatch(/\bPRESETS\b/);
		expect(verbonden).not.toMatch(/>Filter</);
		const sheet = bron('lib/verbonden/FilterSheet.svelte');
		expect(sheet).toMatch(/presetsToChoose\.map/);
		expect(sheet).toMatch(/#each sourcesToChoose as k/);
	});
});

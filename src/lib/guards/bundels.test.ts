// The bundels (decision 19 and 20A/20E, ~/Development/product-kompas/bundels-ux-voorstel.md):
// one name, one address, an overview that is a list and a bundel's own page that is the
// place to work, a shared bundel read as that page.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

describe('the name and the address of the bundels (decision 19)', () => {
	it('says Bundels, never Gemarkeerd; the address of before only where it moves', () => {
		expect(overtreders((t) => /\bGemarkeerd\b/.test(t))).toEqual([]);
		expect(overtreders((t) => /\/gemarkeerd\b/.test(t), [plek('lib/map/page.ts')])).toEqual([]);
	});

	it('names the menu item Bundels, without a count', () => {
		const bar = bron('lib/components/layout/TopBar.svelte');
		expect(bar.match(/>Bundels</g)).toHaveLength(2);
		expect(bar).not.toContain('nav-tel');
	});

	it('links to a bundel’s page and the overview through one place ($lib/map/page.ts)', () => {
		expect(overtreders((t) => /["'`]\/bundels\b/.test(t), [plek('lib/map/page.ts')])).toEqual([]);
	});
});

describe('a bundel’s own page, the place to work (bundels-ux 2b)', () => {
	const view = () => bron('lib/map/MapView.svelte');
	const groups = () => bron('lib/map/MapGroups.svelte');

	it('heads the bundel with Netwerk, Kopieer link and one menu Meer', () => {
		const v = view();
		expect(v).toMatch(/<TekstMenu\b[^>]*tekst="Meer"/);
		for (const label of [
			'Kopieer citaten',
			'Download CSV',
			'Download bestand',
			'>PDF<',
			'>Hernoem<',
			'>Bewaar hierin<',
			'>Verwijder bundel<',
			'>Leegmaken<'
		])
			expect(v, label).toContain(label);
		// Gone: the six links beside a second menu, and the words of before.
		for (const gone of [
			'tekst="Bundel"',
			"'Citaten'",
			'>CSV<',
			'Bewaar als bestand',
			'Afdrukken',
			'Open als pagina',
			'Wis de bundel',
			'Actieve bundel',
			'Wijzig aantekening',
			'Aantekening bij de bundel'
		])
			expect(v, gone).not.toContain(gone);
	});

	it('asks the research question in a field with a placeholder, not from a menu', () => {
		expect(view()).toMatch(/<Aantekening[^>]*placeholder="Onderzoeksvraag of aantekening"/);
	});

	it('keeps one working line: the place for the view, the order and Alles uitklappen', () => {
		const v = view();
		const line = /<div class="werkregel">([\s\S]*?)<\/div>/.exec(v)?.[1] ?? '';
		expect(line).toContain('Lijst | Oud en nieuw');
		expect(line).toContain('Per wet of dossier');
		expect(line).toContain('Alles uitklappen');
		// No meta line with counts and a date.
		expect(v).not.toMatch(/class="meta"|gewijzigd\s*\{|plural\(/);
	});

	it('draws a group’s head without a count or a caret, its ways on in a ⋯', () => {
		const g = groups();
		expect(g).not.toMatch(/class="aantal"|<Caret\b/);
		expect(g).toContain('Regelingen gebaseerd op');
	});

	it('gives every row one ⋯ (RijActies, shared with Bladeren) in place of four buttons', () => {
		const g = groups();
		expect(g).toMatch(/<RijActies\b[^>]*>\s*\{#snippet menu\(/);
		expect(g).not.toMatch(/<IconButton\b|>↑<|>↓<|>×<|class="knoppen"/);
		for (const label of ['>Omhoog<', '>Omlaag<', 'Haal uit ']) expect(g, label).toContain(label);
		// The way to the reader in the opened row, not in every row at rest.
		const aside = /\{#snippet aside\(\)\}([\s\S]*?)\{\/snippet\}/.exec(g)?.[1] ?? '';
		expect(aside).not.toMatch(/In de lezer|Bron ↗/);
		expect(bron('lib/components/ui/RijActies.svelte')).toMatch(/menu\?: Snippet/);
	});

	it('cites a row on one line and its judgments under Rechtspraak, an r.o. under its judgment', () => {
		const g = groups();
		expect(g).toContain('rowTitle(');
		expect(g).toContain('judgmentRows(');
		expect(g).toMatch(/JUDGMENTS_GROUP/);
	});
});

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
		// One list of Mijn feeds the menu of the bar and the sheet of a phone (lib/nav/mine.ts).
		expect(bron('lib/nav/mine.ts')).toContain("label: 'Bundels'");
		for (const pad of ['TopBar', 'MineMenu', 'TabBar']) {
			const bar = bron(`lib/components/layout/${pad}.svelte`);
			expect(bar).not.toMatch(/>Bundels</);
			expect(bar).not.toContain('nav-tel');
		}
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
			'>Verwijder bundel<',
			'>Wissen<'
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

	it('cites a row on one line, a place under its bron: an r.o. under its judgment, an alinea under its Kamerstuk', () => {
		// The judgments under Rechtspraak (groepen); every group's places by one placeRows.
		const g = groups();
		expect(g).toContain('rowTitle(');
		expect(g).toMatch(/\{#each placeRows\(g\.items\) as r/);
		expect(bron('lib/map/BundleRow.svelte')).toContain('placeRows(');
	});
});

describe('the overview, a list that opens in place (bundels-ux 2a, decision 20A)', () => {
	const overview = () => bron('routes/(main)/bundels/+page.svelte');

	it('heads the page as the other menu pages, with Nieuwe bundel and one menu Meer', () => {
		const o = overview();
		expect(o).toMatch(/class="blad__kop"[\s\S]*?class="blad__titel">Bundels</);
		expect(o).toContain('Nieuwe bundel');
		expect(o).toMatch(/<TekstMenu\b[^>]*tekst="Meer"/);
		for (const label of ['Bestand openen', 'Alle bundels downloaden']) expect(o).toContain(label);
		// Gone: every bundel in full, the facet column, the words of before.
		for (const gone of [
			'<MapView {m}',
			'class="opzij"',
			'Open een bestand',
			'Bewaar alles als bestand',
			'Actieve bundel'
		])
			expect(o, gone).not.toContain(gone);
	});

	it('lists each bundel as a row of Bladeren that opens in place, its name a link to its page', () => {
		const row = bron('lib/map/BundleRow.svelte');
		expect(row).toContain('<IndexRow');
		expect(row).toContain('bundlePageHref(');
		expect(row).toContain('Open bundel');
		expect(overview()).toMatch(/kaart\.listed/);
	});

	it('keeps no hidden bundel where Bewaar keeps (decision 20A, UX-toets A14 #2 and #3)', () => {
		// Bewaar keeps in Losse markeringen; its menu ticks every bundel that holds the bron.
		expect(overtreders((t) => /\bkaart\.(?:actief|kies|bewaarIn)\b/.test(t))).toEqual([]);
		const list = bron('lib/map/BundleChecklist.svelte');
		expect(list).toMatch(/<Picto naam="tick"/);
		expect(list).toContain('kaart.toggleIn(');
		expect(list).toContain('placeholder="Naam"');
		// Nothing out of every bundel in one click: Bewaard, a row's bookmark and a place's menu
		// open the bundels with their ticks (UX-toets A14, the coordinator's choice 1).
		expect(overtreders((t) => /\bkaart\.wissel\(/.test(t))).toEqual([]);
		for (const path of [
			'lib/map/Bewaar.svelte',
			'lib/components/ui/RijActies.svelte',
			'lib/components/articles/PlaatsMenu.svelte'
		])
			expect(bron(path), path).toContain('<BundleChecklist');
		expect(bron('lib/map/BundleRow.svelte')).not.toContain('Bewaren gaat hierheen');
		expect(bron('lib/map/MapView.svelte')).not.toContain('Bewaar hierin');
	});

	it('asks a new bundel’s name in place, and says Sluiten for a broken link as for a file', () => {
		const o = overview();
		expect(o).toContain('placeholder="Naam"');
		expect(o).not.toMatch(/Link onvolledig of beschadigd<\/span>\s*<TekstLink[^>]*>Niet bewaren/);
		expect(o.match(/>Sluiten</g)).toHaveLength(2);
	});

	it('shows a bundel from a file as a row, marked, with Bewaar and its ⋯', () => {
		const o = overview();
		expect(o).toMatch(/<BundleRow\b[^>]*mark="uit bestand"/);
		for (const label of ['Niet openen', 'Vervang ', 'Voeg toe aan ', 'Bewaar als nieuwe bundel'])
			expect(o).toContain(label);
		// One of this browser's bundels again (its id): Vervang is the choice in sight (A14 #5).
		expect(o).toMatch(/\{#if sameId\(f\) && target\}\s*<button[\s\S]*?>Vervang<\/button/);
	});
});

describe('a shared link, read as a bundel’s page (bundels-ux 2c, decision 20A)', () => {
	it('opens the bundel’s page read only, with Bewaar, Voeg toe aan … and Niet bewaren', () => {
		expect(bron('routes/(main)/bundels/+page.svelte')).toMatch(
			/<MapView\b[^>]*(\{shared\}|shared=)/
		);
		const v = bron('lib/map/MapView.svelte');
		expect(v).toMatch(/>Bewaar<\/button/);
		for (const label of ['Voeg toe aan …', 'Niet bewaren']) expect(v).toContain(label);
	});

	it('prints a bundel as a PDF through the print view, A4 (decision 20E)', () => {
		expect(bron('lib/map/MapView.svelte')).toMatch(/window\.print\(\)\)\}>PDF</);
		expect(bron('lib/map/MapView.svelte')).toMatch(/@page \{\s*size: A4/);
	});
});

describe('a reader keeping in a bundel (UX-toets A21 #1, #2)', () => {
	it('takes ?bundel= out of the address on arriving, and no link carries it', () => {
		// A navigation, so page.url follows: a shallow replaceState leaves page.url, and every
		// link made of it carried ?bundel= (UX-toets A27 #2).
		expect(bron('routes/+layout.svelte')).toMatch(
			/kaart\.keepIn\(keepIn\);\s*goto\(withoutBundle\(naar\), \{\s*replaceState: true/
		);
		expect(bron('routes/+layout.svelte')).not.toMatch(/\breplaceState\(/);
		expect(bron('lib/util/address.ts')).toContain('BUNDLE_PARAM');
		expect(bron('lib/bron/landing.ts')).toContain('withoutBundle(url)');
	});
});

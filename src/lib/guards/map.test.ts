// A place in a map: kept, cited and annotated alike from a row, a reader and the map itself.
import { describe, expect, it } from 'vitest';
import { BRONNEN, bron, overtreders, plek } from '$lib/test/bronnen';

describe('the map', () => {
	it('keeps a bron for the map through bewaarItem, its group from the bron ($lib/map/map.ts)', () => {
		// A stuk kept from a row and from its reader is one group (F13): no item built by hand.
		const metDeHand = (t: string) =>
			/\bat: ''/.test(t) || /\{[^{}]*\bkort\b[^{}]*\bgroep:[^{}]*\}/.test(t);
		expect(overtreders(metDeHand, [plek('lib/map/map.ts')])).toEqual([]);
	});

	it('puts In de lezer in one place in every row, on Gemarkeerd and the bundel’s page (F4)', () => {
		// First in the row's ways on, in the DOM as on screen (Tab follows it); the buttons after
		// it keep their width, so they do not move it. A tap target of 24 px at least.
		const groups = bron('lib/map/MapGroups.svelte');
		const aside = /\{#snippet aside\(\)\}([\s\S]*?)\{\/snippet\}/.exec(groups)![1];
		expect(aside.indexOf('naar-lezer')).toBeLessThan(aside.indexOf('class="knoppen"'));
		expect(groups).not.toMatch(/order: -1/);
		expect(groups).toMatch(/:global\(\.naar-lezer\) \{[^}]*min-height: var\(--s-5\)/);
	});

	it('cites a kept vote as a vote, from its reader, a row of Bronnen and Verbonden (#54)', () => {
		const kept = BRONNEN.filter(({ text }) => /\bvoteCitation\(/.test(text)).map((s) => s.path);
		expect(kept).toEqual(
			expect.arrayContaining([
				'lib/components/explore/readers/DecisionReader.svelte',
				'lib/components/explore/index/rows/DecisionRows.svelte',
				'lib/map/rij.ts'
			])
		);
	});

	it('offers a place in a map the reader’s own menu, from the reader’s citation (Thijs, 12 Oct)', () => {
		const lezer = bron('lib/components/explore/readers/ArticleReader.svelte');
		const kaart = bron('lib/map/MapInhoud.svelte');
		const uitspraak = bron('lib/components/explore/readers/JudgmentReader.svelte');
		// An article: one citation (articleCitation), the law's names recorded alike, and
		// ArticleText given the same citation props as in the reader.
		// The reader records the law's names where it loads the article (readers/article.ts).
		const laden = bron('lib/components/explore/readers/article.ts');
		for (const [t, names] of [
			[lezer, laden],
			[kaart, kaart]
		]) {
			expect(t).toContain('articleCitation(');
			expect(names).toContain('recordArticleLaw(');
			const tekst = /<ArticleText\b[\s\S]*?\/>/.exec(t)![0];
			expect(tekst).toMatch(/\{citation\}/);
			expect(tekst).toMatch(
				/bewaar=\{[^}]*citation\s*\?\s*\{\s*id: [\w.]+, groep: citation\.citationTitle, wet: [\w.]+ \}/
			);
		}
		// An overweging: one citation and one Bewaar (citeOverwegingen), in the reader's menu; a
		// map's item shows it with the one Overweging, with its menu (bewaar).
		const overweging = bron('lib/bron/Overweging.svelte');
		expect(kaart).toMatch(/<Overweging[\s\S]*?bewaar=\{\{ id: item\.id/);
		for (const t of [uitspraak, overweging]) {
			expect(t).toMatch(/\b(overwegingCitaat|citeOverwegingen)\(/);
			expect(t).toContain('<PlaatsMenu');
			expect(t).toMatch(/cite=\{citeItems\(forms, forms\.link\)\}/);
		}
		// A place in an article is read with the article's parts (placeCitation), so a
		// definition without a letter is named by its term alike in the reader, its head's
		// Bewaar and a map; no page reads the anchor alone.
		const tekst = bron('lib/components/articles/ArticleText.svelte');
		for (const t of [tekst, lezer]) expect(t).toContain('placeCitation(');
		expect(overtreders((t) => /\bpartOfAnchor\(/.test(t), [plek('lib/text/cite.ts')])).toEqual([]);
	});

	it('shows a note of the reader in one form, an item’s, a group’s and the map’s (Thijs, 12 Oct)', () => {
		// Aantekening sets the reader's own words apart from the law: the page draws no note
		// of its own, no italic and no field beside it.
		const groups = bron('lib/map/MapGroups.svelte');
		const view = bron('lib/map/MapView.svelte');
		const pagina = bron('routes/(main)/bundels/+page.svelte');
		for (const [t, tekst] of [
			[groups, 'tekst={i.notitie}'],
			[groups, 'tekst={note}'],
			[view, 'tekst={m.notitie}'],
			[pagina, 'tekst={g.notitie}']
		])
			expect(t).toContain(tekst);
		for (const t of [groups, view, pagina])
			expect(t).not.toMatch(
				/<textarea\b|class="[^"]*\b(?:map-)?notitie(?:-veld)?(?=["\s])|font-style:\s*italic/
			);
		expect(bron('lib/map/Aantekening.svelte')).not.toMatch(/font-style:\s*italic|var\(--accent/);
		// The network's card shows the same notes in the same form, read only (Thijs, 12 Oct).
		const kaart = bron('lib/components/graph/CanvasHoverCard.svelte');
		expect(kaart).toMatch(/\{#each notities as n\b[^}]*\}\s*<Aantekening\b[^>]*tekst=\{n\.tekst\}/);
		expect(kaart).not.toMatch(/<Aantekening\b[^>]*onBewaar/);
		expect(kaart).not.toMatch(/class="[^"]*\bnotitie\b|\.notitie\b|\{n\.tekst\}<\/|\.waar\s*\{/);
		// Every note of the reader renders through Aantekening: no markup prints one itself.
		for (const s of BRONNEN.filter((s) => s.path.endsWith('.svelte')))
			expect(s.text, s.path).not.toMatch(/>\s*\{[\w.?]*\b(?:notitie|n\.tekst)\}/);
	});

	it('names where a map’s way on goes: here, or in the reader (Thijs, 12 Oct)', () => {
		const inhoud = bron('lib/map/MapInhoud.svelte');
		expect(inhoud).toContain("'Heel artikel hier'");
		expect(inhoud).toContain("'Heel artikel in de lezer'");
		expect(inhoud).not.toMatch(/>\s*Heel artikel\s*</);
		// The row's own way to the reader, in sight and not on hover: outside .knoppen.
		const aside = /\{#snippet aside\(\)\}([\s\S]*?)\{\/snippet\}/.exec(
			bron('lib/map/MapGroups.svelte')
		)![1];
		const knoppen = /<span class="knoppen">[\s\S]*?<\/span>/.exec(aside)![0];
		expect(aside).toContain('>In de lezer</TekstLink');
		expect(knoppen).not.toContain('naar-lezer');
	});

	it('shows a bundel alike on Gemarkeerd and on its own page: one MapView, one MapGroups', () => {
		const overview = bron('routes/(main)/bundels/+page.svelte');
		const own = bron('routes/(main)/bundels/[id]/+page.svelte');
		expect(overview).toMatch(/<MapView \{m\}/);
		expect(own).toMatch(/<MapView m=\{shown\} standalone/);
		// What a bundel holds is drawn in one place: no page draws its rows or groups itself.
		for (const t of [overview, own]) expect(t).not.toMatch(/<IndexRow\b|groepen\(/);
		expect(bron('lib/map/MapView.svelte')).toContain('<MapGroups');
	});

	it('opens a bundel on its own page by a control that says so', () => {
		const view = bron('lib/map/MapView.svelte');
		expect(view).toMatch(/href=\{bundlePageHref\(m\)\}>Open als pagina</);
	});

	it("keeps the line of what is new on a bundel's page before it comes: nothing moves (F1)", () => {
		const view = bron('lib/map/MapView.svelte');
		// The line stands as soon as the visit before is known, its words come in it later.
		expect(view).toMatch(/\{#if fresh\}<p class="nieuw-regel">\s*\{#if fresh\.any\}<NewMark/);
		expect(view.match(/<p class="meta">([\s\S]*?)<\/p>/)?.[1]).not.toContain('NewMark');
		expect(view).toMatch(/\.nieuw-regel \{[^}]*height: /);
	});
});

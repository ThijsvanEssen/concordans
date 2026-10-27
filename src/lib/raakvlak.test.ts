// A finger's target (UX-toets 14 Oct, #60): the small text controls carry the shared target of
// lib/styles/basis.css (.raakvlak, at least 24 px high on a touch screen), and a place's number its own.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { overtreders } from '$lib/test/bronnen';

const read = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8');

describe('the touch target', () => {
	it('is on every TekstLink, link or button', () => {
		const tekstLink = read('lib/components/ui/TekstLink.svelte');
		const classes = [...tekstLink.matchAll(/class="tekstlink([^"]*)"/g)].map((m) => m[1]);
		expect(classes).toHaveLength(2);
		for (const c of classes) expect(c).toContain('raakvlak');
	});

	it('is 44 px high around a text link on a touch screen (UX-toets A21 #3)', () => {
		const basis = read('lib/styles/basis.css');
		const coarse = basis.slice(basis.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(
			/\.raakvlak::after,[^{]*\{[^}]*inset: min\(calc\(-1 \* var\(--s-2\)\), calc\(50% - \(var\(--s-6\) \+ var\(--s-3\)\) \/ 2\)\)/
		);
		// Bewaar's caret is 44 px wide itself, so its target never reaches over Bewaar.
		expect(read('lib/map/Bewaar.svelte')).toMatch(
			/tekstmenu__knop\) \{\s*min-width: var\(--veld-h-raak\)/
		);
	});

	it("is around a place's number, before it, on a touch screen", () => {
		const basis = read('lib/styles/basis.css');
		const coarse = basis.slice(basis.indexOf('@media (pointer: coarse)'));
		expect(coarse).toContain('.plaats-marker::before');
	});

	it('is 44 px visible on a Knop in all three forms, a Keuze and an IconButton, on a touch screen', () => {
		const basis = read('lib/styles/basis.css');
		const coarse = basis.slice(basis.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(
			/\.btn,\s*\.btn\.is-text \{\s*height: var\(--veld-h-raak\);\s*font-size: var\(--t-ui-raak\)/
		);
		expect(coarse).not.toMatch(/\.btn::after/);
		for (const f of ['Keuze', 'IconButton', 'IconButtonPaar']) {
			const src = read(`lib/components/ui/${f}.svelte`);
			expect(src).not.toContain('raakvlak-knop');
			expect(src.slice(src.indexOf('@media (pointer: coarse)'))).toContain('var(--veld-h-raak)');
		}
	});

	it('is 44 px around a menu’s button, on a touch screen (A14 #11)', () => {
		const basis = read('lib/styles/basis.css');
		const coarse = basis.slice(basis.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(
			/\.tekstmenu__knop::after,\s*\.raakvlak-knop::after \{[^}]*inset: min\(0px, calc\(50% - \(var\(--s-6\) \+ var\(--s-3\)\) \/ 2\)\)/
		);
	});

	it("is 44 px around a row's ⋯ and its Bewaar on a touch screen (the bundels, Actueel)", () => {
		const acties = read('lib/components/ui/RijActies.svelte');
		const coarse = acties.slice(acties.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(/\.plek \{[^}]*width: calc\(var\(--s-6\) \+ var\(--s-3\)\)/);
		expect(read('lib/map/MapGroups.svelte')).not.toMatch(/class="notitie-knop/);
	});

	it('is 44 px high on every row and heading of a table of contents, on a touch screen', () => {
		const kolom = read('lib/components/explore/NavKolom.svelte');
		const coarse = kolom.slice(kolom.indexOf('@media (pointer: coarse)'));
		expect(kolom).toContain('@media (pointer: coarse)');
		expect(coarse).toMatch(/\.nav-kolom__rij\)[^{]*\{[^}]*min-height: var\(--veld-h-raak\)/);
		const nav = read('lib/components/explore/LezenNav.svelte');
		const navCoarse = nav.slice(nav.indexOf('@media (pointer: coarse)'));
		expect(nav).toContain('@media (pointer: coarse)');
		expect(navCoarse).toMatch(/\.group__head[^{]*\{[^}]*min-height: var\(--veld-h-raak\)/);
	});

	it("fills a heading's row with its link, and gives the sheet's close button 44 px (F5, UX-toets T9)", () => {
		const nav = read('lib/components/explore/LezenNav.svelte');
		const navCoarse = nav.slice(nav.indexOf('@media (pointer: coarse)'));
		expect(navCoarse).toMatch(/\.group__head \{[^}]*padding-block: 0/);
		// The sheet's close button is the IconButton, which is 44 px on a touch screen.
		expect(read('routes/explore/TocSheet.svelte')).toContain('<IconButton label="Sluiten"');
		const icon = read('lib/components/ui/IconButton.svelte');
		expect(icon.slice(icon.indexOf('@media (pointer: coarse)'))).toMatch(
			/width: var\(--veld-h-raak\);\s*height: var\(--veld-h-raak\)/
		);
	});

	it("is a row of 44 px for a menu's item and a line of Behoort bij, on a touch screen", () => {
		const menu = read('lib/components/ui/TekstMenu.svelte');
		const menuCoarse = menu.slice(menu.indexOf('@media (pointer: coarse)'));
		expect(menuCoarse).toMatch(
			/\.tekstmenu__item\) \{\s*padding-block: calc\(\(var\(--veld-h-raak\) - 1lh\) \/ 2\)/
		);
		const band = read('lib/bron/BelongsTo.svelte');
		const bandCoarse = band.slice(band.indexOf('@media (pointer: coarse)'));
		expect(bandCoarse).toMatch(
			/\.lagen,\s*\.groepen \{\s*row-gap: calc\(var\(--veld-h-raak\) - 1lh\)/
		);
		for (const a of band.matchAll(/<a\b[^>]*>/g)) expect(a[0]).toContain('raakvlak');
	});

	it('is 44 px below 768 too, without a touch screen (a window zoomed to 200%)', () => {
		expect(
			overtreders((t) => /@media \(pointer: coarse\)(?!, \(max-width: 768px\))/.test(t))
		).toEqual([]);
	});

	it('is 44 px around the bar’s Netwerk and Zoeken, and a heading’s Citeer in a judgment', () => {
		const bar = read('lib/components/layout/TopBar.svelte');
		expect(bar).toContain('class="search-trigger raakvlak-knop"');
		expect(read('lib/components/layout/NetworkButton.svelte')).toContain(
			'class="btn netwerk-knop raakvlak-knop"'
		);
		// The tab bar of a phone is 64 px high and its items fill it.
		expect(read('lib/styles/tokens.css')).toMatch(
			/--tabbar-h: calc\(var\(--balk-h\) \+ var\(--safe-bottom\)\)/
		);
		// ... above the home bar of an installed app, with the viewport covering the screen.
		expect(read('lib/components/layout/TabBar.svelte')).toContain('var(--safe-bottom)');
		expect(read('lib/styles/tokens.css')).toContain('env(safe-area-inset-bottom');
		expect(read('app.html')).toContain('viewport-fit=cover');
		expect(read('lib/components/explore/readers/JudgmentReader.svelte')).toContain(
			'buttonClass="btn is-text reader-heading__link raakvlak-knop"'
		);
	});

	it('closes what opens beside the article with a 44 px button below 768 (B32)', () => {
		const explore = read('routes/explore/+page.svelte');
		expect(explore).toMatch(
			/@media \(max-width: 768px\) \{\s*\.reader__close \{\s*min-width: var\(--veld-h-raak\);\s*min-height: var\(--veld-h-raak\)/
		);
	});
});

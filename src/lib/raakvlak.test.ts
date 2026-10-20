// A finger's target (UX-toets 14 Oct, #60): the small text controls carry the shared target of
// lib/styles/basis.css (.raakvlak, at least 24 px high on a touch screen), and a place's number its own.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(join(process.cwd(), 'src', path), 'utf8');

describe('the touch target', () => {
	it('is on every TekstLink, link or button', () => {
		const tekstLink = read('lib/components/ui/TekstLink.svelte');
		const classes = [...tekstLink.matchAll(/class="tekstlink([^"]*)"/g)].map((m) => m[1]);
		expect(classes).toHaveLength(2);
		for (const c of classes) expect(c).toContain('raakvlak');
	});

	it("is around a place's number, before it, on a touch screen", () => {
		const basis = read('lib/styles/basis.css');
		const coarse = basis.slice(basis.indexOf('@media (pointer: coarse)'));
		expect(coarse).toContain('.plaats-marker::before');
	});

	it("is 44 px around a row's ⋯ on a touch screen (the bundels)", () => {
		const acties = read('lib/components/ui/RijActies.svelte');
		const coarse = acties.slice(acties.indexOf('@media (pointer: coarse)'));
		expect(coarse).toMatch(/\.plek--menu \{[^}]*width: calc\(var\(--s-6\) \+ var\(--s-3\)\)/);
		expect(read('lib/map/MapGroups.svelte')).not.toMatch(/class="notitie-knop/);
	});

	it('is at least 32 px high on every row and heading of a table of contents, on a touch screen', () => {
		const kolom = read('lib/components/explore/NavKolom.svelte');
		const coarse = kolom.slice(kolom.indexOf('@media (pointer: coarse)'));
		expect(kolom).toContain('@media (pointer: coarse)');
		expect(coarse).toMatch(/\.nav-kolom__rij\)[^{]*\{[^}]*min-height: var\(--s-6\)/);
		const nav = read('lib/components/explore/LezenNav.svelte');
		const navCoarse = nav.slice(nav.indexOf('@media (pointer: coarse)'));
		expect(nav).toContain('@media (pointer: coarse)');
		expect(navCoarse).toMatch(/\.group__head[^{]*\{[^}]*min-height: var\(--s-6\)/);
	});

	it("fills a heading's row with its link, and gives the sheet's close button 32 px (F5)", () => {
		const nav = read('lib/components/explore/LezenNav.svelte');
		const navCoarse = nav.slice(nav.indexOf('@media (pointer: coarse)'));
		expect(navCoarse).toMatch(/\.group__head \{[^}]*padding-block: 0/);
		const sheet = read('routes/explore/TocSheet.svelte');
		const sheetCoarse = sheet.slice(sheet.indexOf('@media (pointer: coarse)'));
		expect(sheet).toContain('@media (pointer: coarse)');
		expect(sheetCoarse).toMatch(
			/\.close \{[^}]*min-height: var\(--s-6\)[^}]*min-width: var\(--s-6\)/
		);
	});
});

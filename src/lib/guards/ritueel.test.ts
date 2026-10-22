// Bewaar, Volg and Kopieer confirm one way (decision 33, A164): the button changes, a status
// line says where it went, the navigation shows a sign, a screen reader hears it. The ritual
// lives in bevestig.svelte.ts; the places that keep, follow or copy call it, and nothing
// speaks a copy on its own.
import { describe, expect, it } from 'vitest';
import { bron, overtreders, plek } from '$lib/test/bronnen';

const RITUEEL = 'lib/bevestig/bevestig.svelte.ts';
/** A function's body, from its signature to the next top-level or member of the same depth. */
function body(text: string, signature: RegExp): string {
	const m = signature.exec(text);
	if (!m) throw new Error(`${signature} niet gevonden`);
	return text.slice(m.index, m.index + 900);
}

describe('the ritual of Bewaar, Volg and Kopieer', () => {
	it('is the only place that keeps the status line', () => {
		expect(overtreders((t) => /export function announce\(/.test(t), [plek(RITUEEL)])).toEqual([]);
	});

	it('copies to the clipboard in copy.svelte.ts alone, which announces through the ritual', () => {
		expect(
			overtreders((t) => /navigator\.clipboard/.test(t), [plek('lib/components/ui/copy.svelte.ts')])
		).toEqual([]);
		expect(bron('lib/components/ui/copy.svelte.ts')).toMatch(/announce\(/);
	});

	it('has no live region of its own for a copy', () => {
		expect(overtreders((t) => /copier\.announcement|deelMelding/.test(t))).toEqual([]);
	});

	it('names what it copied, in every copy: Gekopieerd: art. 6:162 BW (T5)', () => {
		// `copier.copy(text, key, wat)`: three arguments, the third what the status line says.
		const zonderNaam = (t: string) => {
			let from = 0;
			for (;;) {
				const at = t.indexOf('copier.copy(', from);
				if (at < 0) return false;
				let depth = 0;
				let commas = 0;
				let i = at + 'copier.copy'.length;
				for (; i < t.length; i++) {
					const c = t[i];
					if ('([{'.includes(c)) depth++;
					else if (')]}'.includes(c)) {
						depth--;
						if (depth === 0) break;
					} else if (c === ',' && depth === 1) commas++;
				}
				if (commas < 2) return true;
				from = i;
			}
		};
		expect(overtreders(zonderNaam)).toEqual([]);
		expect(bron('lib/components/ui/copy.svelte.ts')).toMatch(/`Gekopieerd: \$\{wat\}`/);
	});

	it('shows the line for every confirmation, in the middle, over no column', () => {
		const t = bron('lib/components/ui/Bevestiging.svelte');
		expect(t).toMatch(/class:bevestiging=\{!!nu\}/);
		expect(t).toMatch(/class:sr-only=\{!nu\}/);
		// Not at the left edge, where the table of contents is.
		expect(t).toMatch(/margin-inline: auto/);
		expect(t).not.toMatch(/\n\t\tleft: /);
	});

	it('keeps in a bundel through Bewaar, the checklist or a new bundel, each saying so', () => {
		const kaart = bron('lib/map/map.svelte.ts');
		expect(body(kaart, /\n\tadd\(i: MapItem/)).toMatch(/keptIn\(/);
		expect(body(kaart, /\n\ttoggleIn\(/)).toMatch(/removedFrom\(/);
		expect(body(kaart, /\n\tnieuw\(/)).toMatch(/keptIn\(/);
	});

	it('follows through volg, volgWet and followDossier, each saying so', () => {
		const t = bron('lib/onderwerpen/onderwerpen.ts');
		for (const sig of [
			/export function volg\(/,
			/export function volgWet\(/,
			/export function followDossier\(/
		])
			expect(body(t, sig), String(sig)).toMatch(/followedAt\(\)/);
	});

	it('draws the status line once, in the root layout, and the sign in the navigation', () => {
		expect(bron('routes/+layout.svelte')).toMatch(/<Bevestiging\s*\/>/);
		expect(
			overtreders((t) => /<Bevestiging\s*\/>/.test(t), [plek('routes/+layout.svelte')])
		).toEqual([]);
		// At Mijn: in the menu of the bar and on the tab of a phone.
		for (const pad of ['MineMenu', 'TabBar']) {
			expect(bron(`lib/components/layout/${pad}.svelte`)).toMatch(/sign\.has\('bundels'\)/);
			expect(bron(`lib/components/layout/${pad}.svelte`)).toMatch(/sign\.has\('gevolgd'\)/);
		}
	});
});

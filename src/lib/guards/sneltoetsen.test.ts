// The keys of Concordans (Thijs, 29 Oct: "Met alt", WCAG 2.1.4): one register, the docs and the
// window on Ctrl / drawn from it, every key of the page a combination, and a letter alone only
// where the focus is in the list it belongs to.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import Toetsen from '$lib/keys/Toetsen.svelte';
import { CONTEXTS, MUIS, TOETSEN, isCombo, toetsVanEvent } from '$lib/keys/register';
import { BRONNEN, bron, overtreders, plek } from '$lib/test/bronnen';

const geboden = TOETSEN.filter((t) => t.soort !== 'gereserveerd');
const pressed = (o: Partial<KeyboardEvent> & { code: string }) =>
	({
		key: '',
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		...o
	}) as KeyboardEvent;

describe('the register of the keys', () => {
	it('names each key once, in a context that docs knows', () => {
		const ids = TOETSEN.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const t of TOETSEN) expect(CONTEXTS.map((c) => c.id)).toContain(t.context);
	});

	it('binds no letter alone on the page: a key of the page is Alt or Ctrl/⌘ with a key', () => {
		for (const t of TOETSEN.filter((x) => x.soort !== 'focus'))
			for (const c of t.keys) expect(c.alt || c.mod, `${t.id} ${c.teken}`).toBe(true);
	});

	it('gives no two keys of the page the same combination, and leaves Alt W reserved', () => {
		const seen = new Set<string>();
		for (const t of TOETSEN.filter((x) => x.soort !== 'focus'))
			for (const c of t.keys) {
				const k = `${c.mod ? 'mod' : ''}${c.alt ? 'alt' : ''}${c.code}`;
				expect(seen.has(k), `${t.id} ${k}`).toBe(false);
				seen.add(k);
			}
		const w = TOETSEN.find((t) => t.id === 'paneel-wissel')!;
		expect(w.soort).toBe('gereserveerd');
		expect(w.keys[0]).toMatchObject({ code: 'KeyW', alt: true });
	});

	it('matches on the physical key: Alt L is KeyL whatever character the platform makes of it', () => {
		const wissel = TOETSEN.find((t) => t.id === 'wissel')!;
		expect(isCombo(pressed({ code: 'KeyL', key: '¬', altKey: true }), wissel.keys[0])).toBe(true);
		expect(toetsVanEvent(pressed({ code: 'KeyL', key: 'l' }))).toBeNull();
		// AltGr on Windows is Ctrl+Alt: a character, not a key of ours.
		expect(
			toetsVanEvent(pressed({ code: 'BracketLeft', key: '[', altKey: true, ctrlKey: true }))
		).toBeNull();
		expect(toetsVanEvent(pressed({ code: 'KeyK', key: 'k', ctrlKey: true }))?.toets.id).toBe(
			'zoeken'
		);
		expect(toetsVanEvent(pressed({ code: 'KeyK', key: 'k', metaKey: true }))?.toets.id).toBe(
			'zoeken'
		);
	});

	it('is answered for every key of the page by a component', () => {
		const alles = BRONNEN.map((b) => b.text).join('\n');
		for (const t of TOETSEN.filter((x) => x.soort === 'pagina'))
			expect(alles, t.handler).toMatch(new RegExp(`answer\\('${t.handler}'`));
	});

	it('draws docs and the window from it: each key once, the reserved one not at all', () => {
		const html = render(Toetsen, { props: {} }).body;
		for (const t of geboden) {
			expect(html.match(new RegExp(`data-toets="${t.id}"`, 'g')), t.id).toHaveLength(1);
			expect(html, t.id).toContain(t.omschrijving);
		}
		expect(html).not.toContain('data-toets="paneel-wissel"');
		expect(html).toContain(MUIS.omschrijving);
		expect(html.match(/<kbd/g)!.length).toBeGreaterThan(geboden.length);
	});

	it('has the docs page and the window draw nothing of their own', () => {
		expect(bron('routes/(main)/docs/sneltoetsen/+page.svelte')).toMatch(/<Toetsen \/>/);
		expect(bron('routes/(main)/docs/sneltoetsen/+page.svelte')).not.toMatch(/<KeyRow|<kbd/);
		expect(bron('lib/keys/Hulp.svelte')).toMatch(/<Toetsen /);
	});

	it('compares no event key with a letter, a digit or a sign outside the lists that hold the focus', () => {
		const teken = (t: string) =>
			/\.key(\.toLowerCase\(\))? ===? '[a-zA-Z0-9?/[\]]'|\.key !== '[a-zA-Z0-9?/[\]]'/.test(t);
		expect(
			overtreders(teken, [
				plek('lib/components/graph/CanvasNodeList.svelte', 'N in the list (register: netwerk-n)')
			])
		).toEqual([]);
	});
});

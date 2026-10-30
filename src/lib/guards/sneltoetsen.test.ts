// The keys of Concordans (Thijs, 29 Oct: "Met alt", WCAG 2.1.4): one register, the docs and the
// window on Ctrl / drawn from it, every key of the page a combination, and a letterKey alone only
// where the focus is in the list it belongs to.
import { describe, expect, it } from 'vitest';
import { render } from 'svelte/server';
import ShortcutList from '$lib/keys/ShortcutList.svelte';
import { COMMANDS, CONTEXTS, MOUSE, SHORTCUTS, isCombo, shortcutOfEvent } from '$lib/keys/register';
import { BRONNEN, bron, overtreders, plek } from '$lib/test/bronnen';

const geboden = SHORTCUTS.filter((t) => t.kind !== 'reserved');
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
		const ids = SHORTCUTS.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
		for (const t of SHORTCUTS) expect(CONTEXTS.map((c) => c.id)).toContain(t.context);
	});

	it('binds no letterKey alone on the page: a key of the page is Alt or Ctrl/⌘ with a key', () => {
		for (const t of SHORTCUTS.filter((x) => x.kind !== 'focus'))
			for (const c of t.keys) expect(c.alt || c.mod, `${t.id} ${c.cap}`).toBe(true);
	});

	it('gives no two keys of the page the same combination; Alt W goes to the Zijpaneel', () => {
		const seen = new Set<string>();
		for (const t of SHORTCUTS.filter((x) => x.kind !== 'focus'))
			for (const c of t.keys) {
				const k = `${c.mod ? 'mod' : ''}${c.alt ? 'alt' : ''}${c.code}`;
				expect(seen.has(k), `${t.id} ${k}`).toBe(false);
				seen.add(k);
			}
		const w = SHORTCUTS.find((t) => t.id === 'panel-toggle')!;
		expect(w).toMatchObject({ kind: 'page', context: 'paneel' });
		expect(w.keys[0]).toMatchObject({ code: 'KeyW', alt: true });
	});

	it('matches on the physical key: Alt L is KeyL whatever character the platform makes of it', () => {
		const wissel = SHORTCUTS.find((t) => t.id === 'toggle-view')!;
		expect(isCombo(pressed({ code: 'KeyL', key: '¬', altKey: true }), wissel.keys[0])).toBe(true);
		expect(shortcutOfEvent(pressed({ code: 'KeyL', key: 'l' }))).toBeNull();
		// AltGr on Windows is Ctrl+Alt: a character, not a key of ours.
		expect(
			shortcutOfEvent(pressed({ code: 'BracketLeft', key: '[', altKey: true, ctrlKey: true }))
		).toBeNull();
		expect(shortcutOfEvent(pressed({ code: 'KeyK', key: 'k', ctrlKey: true }))?.shortcut.id).toBe(
			'search'
		);
		expect(shortcutOfEvent(pressed({ code: 'KeyK', key: 'k', metaKey: true }))?.shortcut.id).toBe(
			'search'
		);
	});

	it('is answered for every key of the page by a component', () => {
		const alles = BRONNEN.map((b) => b.text).join('\n');
		for (const t of SHORTCUTS.filter((x) => x.kind === 'page'))
			expect(alles, t.handler).toMatch(new RegExp(`answer\\('${t.handler}'`));
	});

	it('draws docs and the window from it: each key once', () => {
		const html = render(ShortcutList, { props: {} }).body;
		for (const t of geboden) {
			expect(html.match(new RegExp(`data-shortcut="${t.id}"`, 'g')), t.id).toHaveLength(1);
			expect(html, t.id).toContain(t.description);
		}
		expect(html).toContain(MOUSE.description);
		expect(html.match(/<kbd/g)!.length).toBeGreaterThan(geboden.length);
	});

	it('has the docs page and the window draw nothing of their own', () => {
		expect(bron('routes/(main)/docs/sneltoetsen/+page.svelte')).toMatch(/<ShortcutList \/>/);
		expect(bron('routes/(main)/docs/sneltoetsen/+page.svelte')).not.toMatch(/<KeyRow|<kbd/);
		expect(bron('lib/keys/HelpDialog.svelte')).toMatch(/<ShortcutList /);
	});

	it('compares no event key with a letterKey, a digit or a sign outside the lists that hold the focus', () => {
		const cap = (t: string) =>
			/\.key(\.toLowerCase\(\))? ===? '[a-zA-Z0-9?/[\]]'|\.key !== '[a-zA-Z0-9?/[\]]'/.test(t);
		expect(
			overtreders(cap, [
				plek('lib/components/graph/CanvasNodeList.svelte', 'N in the list (register: netwerk-n)')
			])
		).toEqual([]);
	});
});

describe('the words of ⌘K', () => {
	const words = COMMANDS.flatMap((c) => [...c.words, ...(c.short ?? [])]);

	it('names each command and each word once', () => {
		expect(new Set(COMMANDS.map((c) => c.id)).size).toBe(COMMANDS.length);
		expect(new Set(words).size).toBe(words.length);
	});

	it('makes no word a prefix of another: a prefix of three letters calls one command', () => {
		const full = COMMANDS.flatMap((c) => c.words);
		for (const a of full)
			for (const b of full) if (a !== b) expect(b.startsWith(a), `${a} ${b}`).toBe(false);
	});

	it('gives every command a context, a flow of the report, and only a key that exists', () => {
		for (const c of COMMANDS) {
			expect(CONTEXTS.map((x) => x.id)).toContain(c.context);
			expect(c.flow, c.id).toMatch(/^F\d+$/);
			if (c.key)
				expect(
					SHORTCUTS.map((s) => s.id),
					c.id
				).toContain(c.key);
		}
	});
});

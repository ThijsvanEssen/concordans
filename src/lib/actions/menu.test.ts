import { tick } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { menu, nextIndex } from './menu';

describe('nextIndex', () => {
	it('moves down and up round the items, and to the first and last', () => {
		expect(nextIndex('ArrowDown', -1, 3)).toBe(0);
		expect(nextIndex('ArrowDown', 0, 3)).toBe(1);
		expect(nextIndex('ArrowDown', 2, 3)).toBe(0);
		expect(nextIndex('ArrowUp', 0, 3)).toBe(2);
		expect(nextIndex('ArrowUp', -1, 3)).toBe(2);
		expect(nextIndex('ArrowUp', 2, 3)).toBe(1);
		expect(nextIndex('Home', 2, 3)).toBe(0);
		expect(nextIndex('End', 0, 3)).toBe(2);
	});
	it('leaves other keys, and a menu without items', () => {
		expect(nextIndex('a', 0, 3)).toBeNull();
		expect(nextIndex('ArrowDown', -1, 0)).toBeNull();
	});
});

// A place's menu (PlaatsMenu): the list is the element, its marker stands outside it.
class FakeNode {
	listeners: Record<string, (e: unknown) => void> = {};
	constructor(
		public within: FakeNode[] = [],
		public role = ''
	) {}
	contains = (n: unknown): boolean =>
		n === this || this.within.some((c) => c === n || c.contains(n));
	focus = () => (doc.activeElement = this);
	matches = (s: string) => s.includes('menuitemradio') && this.role === 'menuitemradio-checked';
	addEventListener = (t: string, f: (e: unknown) => void) => (this.listeners[t] = f);
	removeEventListener = vi.fn();
	querySelector = () => null;
	querySelectorAll = () => this.within;
	getAttribute = () => null;
}
const doc: { activeElement: unknown; click?: (e: unknown) => void } = { activeElement: null };

describe('menu, for a place whose marker stands outside its list', () => {
	beforeEach(() => {
		vi.stubGlobal('Node', FakeNode);
		vi.stubGlobal('document', {
			get activeElement() {
				return doc.activeElement;
			},
			addEventListener: (_: string, f: (e: unknown) => void) => (doc.click = f),
			removeEventListener: vi.fn()
		});
	});
	afterEach(() => vi.unstubAllGlobals());

	const key = (k: string) => ({ key: k, preventDefault: vi.fn(), stopPropagation: vi.fn() });

	it('focuses the first item, moves with the keys, and gives the focus back on Escape', async () => {
		const items = [new FakeNode(), new FakeNode([], 'menuitemcheckbox'), new FakeNode()];
		const list = new FakeNode(items);
		const marker = new FakeNode();
		const close = vi.fn();
		menu(list as unknown as HTMLElement, {
			open: true,
			close,
			trigger: marker as unknown as HTMLElement
		});
		await tick();
		await tick();
		expect(doc.activeElement).toBe(items[0]);
		list.listeners.keydown(key('End'));
		expect(doc.activeElement).toBe(items[2]);
		list.listeners.keydown(key('ArrowDown'));
		expect(doc.activeElement).toBe(items[0]);
		list.listeners.keydown(key('ArrowUp'));
		expect(doc.activeElement).toBe(items[2]);
		list.listeners.keydown(key('Escape'));
		expect(close).toHaveBeenCalledOnce();
		expect(doc.activeElement).toBe(marker);
	});

	it('closes on a click outside, not on one on its marker', () => {
		const list = new FakeNode([new FakeNode()]);
		const marker = new FakeNode();
		const close = vi.fn();
		menu(list as unknown as HTMLElement, {
			open: true,
			close,
			trigger: marker as unknown as HTMLElement
		});
		doc.click!({ target: marker });
		doc.click!({ target: list.within[0] });
		expect(close).not.toHaveBeenCalled();
		doc.click!({ target: new FakeNode() });
		expect(close).toHaveBeenCalledOnce();
	});
});

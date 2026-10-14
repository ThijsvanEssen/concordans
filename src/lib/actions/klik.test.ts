import { afterEach, describe, expect, it, vi } from 'vitest';
import { blockClick, gewoneKlik, rowClick, terPlekke } from './klik';

const mouse = (init: Partial<MouseEvent> = {}) =>
	({
		button: 0,
		metaKey: false,
		ctrlKey: false,
		shiftKey: false,
		altKey: false,
		preventDefault: vi.fn(),
		stopPropagation: vi.fn(),
		...init
	}) as unknown as MouseEvent;

describe('klik', () => {
	it('opens in place on a plain click, and the link goes nowhere', () => {
		const open = vi.fn();
		const e = mouse();
		terPlekke(e, open);
		expect(open).toHaveBeenCalledOnce();
		expect(e.preventDefault).toHaveBeenCalled();
	});

	it('leaves cmd-, ctrl-, shift- and middle clicks to the link', () => {
		for (const e of [
			mouse({ metaKey: true }),
			mouse({ ctrlKey: true }),
			mouse({ shiftKey: true }),
			mouse({ button: 1 })
		]) {
			const open = vi.fn();
			terPlekke(e, open);
			expect(open).not.toHaveBeenCalled();
			expect(e.preventDefault).not.toHaveBeenCalled();
			expect(gewoneKlik(e)).toBe(false);
		}
	});
});

/** An element of a fake page: what it is, and the element it stands in. */
class FakeElement {
	constructor(
		readonly what: string,
		readonly parent: FakeElement | null = null
	) {}
	listeners: ((e: MouseEvent) => void)[] = [];
	addEventListener = (_: string, fn: (e: MouseEvent) => void) => this.listeners.push(fn);
	removeEventListener = (_: string, fn: (e: MouseEvent) => void) =>
		(this.listeners = this.listeners.filter((l) => l !== fn));
	/** `[role="button"]` and a tag name, the selectors this test needs. */
	closest(selector: string): FakeElement | null {
		const matches = selector.split(',').some((s) => s.trim() === this.what);
		return matches ? this : (this.parent?.closest(selector) ?? null);
	}
	contains(other: FakeElement | null): boolean {
		return !!other && (other === this || this.contains(other.parent));
	}
}

/** A click on `target`, bubbling up through every element with a listener. */
function click(target: FakeElement) {
	const e = { target, currentTarget: null as FakeElement | null };
	for (let el: FakeElement | null = target; el; el = el.parent) {
		e.currentTarget = el;
		for (const l of el.listeners) l(e as unknown as MouseEvent);
	}
}

describe('blockClick', () => {
	const selected = (text: string) =>
		vi.stubGlobal('window', { getSelection: () => ({ toString: () => text }) });
	afterEach(() => vi.unstubAllGlobals());

	function block() {
		vi.stubGlobal('Element', FakeElement);
		selected('');
		const node = new FakeElement('div');
		const open = vi.fn();
		const action = blockClick(node as unknown as HTMLElement, open);
		return { node, open, action };
	}

	it('opens on a click on the block or the text in it', () => {
		const { node, open } = block();
		click(node);
		click(new FakeElement('span', node));
		expect(open).toHaveBeenCalledTimes(2);
	});

	it('leaves a click on a control in it to that control', () => {
		const { node, open } = block();
		for (const control of ['a', 'button', 'summary', 'input', '[role="button"]'])
			click(new FakeElement('span', new FakeElement(control, node)));
		expect(open).not.toHaveBeenCalled();
	});

	it('opens a block that is itself in a control', () => {
		vi.stubGlobal('Element', FakeElement);
		selected('');
		const node = new FakeElement('div', new FakeElement('summary'));
		const open = vi.fn();
		blockClick(node as unknown as HTMLElement, open);
		click(new FakeElement('span', node));
		expect(open).toHaveBeenCalledOnce();
	});

	it('selects, and does not open, when the click ends a text selection', () => {
		const { node, open } = block();
		selected('de overweging');
		click(new FakeElement('span', node));
		expect(open).not.toHaveBeenCalled();
	});

	it('opens only the innermost block', () => {
		const { node, open } = block();
		const inner = new FakeElement('div', node);
		const openInner = vi.fn();
		blockClick(inner as unknown as HTMLElement, openInner);
		click(new FakeElement('span', inner));
		expect(openInner).toHaveBeenCalledOnce();
		expect(open).not.toHaveBeenCalled();
	});

	it('is no block without a handler, and stops when it goes', () => {
		const { node, open, action } = block();
		action.update(null);
		click(node);
		action.update(open);
		action.destroy();
		click(node);
		expect(open).not.toHaveBeenCalled();
	});
});

describe('rowClick', () => {
	const selected = (text: string) =>
		vi.stubGlobal('window', { getSelection: () => ({ toString: () => text }) });
	const on = (target: FakeElement, row: FakeElement) =>
		({ target, currentTarget: row }) as unknown as MouseEvent;
	afterEach(() => vi.unstubAllGlobals());

	it('opens the row on a click on the row itself', () => {
		vi.stubGlobal('Element', FakeElement);
		selected('');
		const row = new FakeElement('div');
		const open = vi.fn();
		rowClick(on(new FakeElement('span', row), row), open);
		expect(open).toHaveBeenCalledOnce();
	});

	it('leaves a click on a link or button in the row to that control', () => {
		vi.stubGlobal('Element', FakeElement);
		selected('');
		const row = new FakeElement('div');
		const open = vi.fn();
		rowClick(on(new FakeElement('a', row), row), open);
		expect(open).not.toHaveBeenCalled();
	});
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { gewoneKlik, rowClick, terPlekke } from './klik';

const click = (init: Partial<MouseEvent> = {}) =>
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
		const e = click();
		terPlekke(e, open);
		expect(open).toHaveBeenCalledOnce();
		expect(e.preventDefault).toHaveBeenCalled();
	});

	it('leaves cmd-, ctrl-, shift- and middle clicks to the link', () => {
		for (const e of [
			click({ metaKey: true }),
			click({ ctrlKey: true }),
			click({ shiftKey: true }),
			click({ button: 1 })
		]) {
			const open = vi.fn();
			terPlekke(e, open);
			expect(open).not.toHaveBeenCalled();
			expect(e.preventDefault).not.toHaveBeenCalled();
			expect(gewoneKlik(e)).toBe(false);
		}
	});
});

describe('rowClick', () => {
	class FakeElement {
		constructor(private control: boolean) {}
		closest = () => (this.control ? this : null);
	}
	const selected = (text: string) =>
		vi.stubGlobal('window', { getSelection: () => ({ toString: () => text }) });
	const on = (target: unknown) => ({ target, currentTarget: {} }) as unknown as MouseEvent;
	afterEach(() => vi.unstubAllGlobals());

	it('opens the row on a click on the row itself', () => {
		vi.stubGlobal('Element', FakeElement);
		selected('');
		const open = vi.fn();
		rowClick(on(new FakeElement(false)), open);
		expect(open).toHaveBeenCalledOnce();
	});

	it('leaves a click on a link or button in the row to that control', () => {
		vi.stubGlobal('Element', FakeElement);
		selected('');
		const open = vi.fn();
		rowClick(on(new FakeElement(true)), open);
		expect(open).not.toHaveBeenCalled();
	});

	it('selects, and does not open, when the click ends a text selection', () => {
		vi.stubGlobal('Element', FakeElement);
		selected('Motie van het lid');
		const open = vi.fn();
		rowClick(on(new FakeElement(false)), open);
		expect(open).not.toHaveBeenCalled();
	});
});

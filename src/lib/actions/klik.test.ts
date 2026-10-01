import { describe, expect, it, vi } from 'vitest';
import { gewoneKlik, terPlekke } from './klik';

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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { rijen, stap } from './rijen';

describe('rijen', () => {
	it('starts at the first row with J and the last with K', () => {
		expect(stap(-1, 5, 1)).toBe(0);
		expect(stap(-1, 5, -1)).toBe(4);
	});

	it('steps one row and stays inside the list', () => {
		expect(stap(2, 5, 1)).toBe(3);
		expect(stap(4, 5, 1)).toBe(4);
		expect(stap(0, 5, -1)).toBe(0);
		expect(stap(-1, 0, 1)).toBe(-1);
	});
});

describe('J and K while typing', () => {
	afterEach(() => vi.unstubAllGlobals());

	it('leave a J typed in a field to the field', () => {
		let listener: ((e: KeyboardEvent) => void) | null = null;
		vi.stubGlobal('window', {
			addEventListener: (_: string, fn: (e: KeyboardEvent) => void) => (listener = fn),
			removeEventListener: () => {}
		});
		const row = {
			contains: () => false,
			focus: vi.fn(),
			scrollIntoView: vi.fn(),
			offsetParent: {},
			getClientRects: () => [{}]
		};
		const node = {
			querySelectorAll: () => [row],
			contains: () => false,
			offsetParent: {},
			getClientRects: () => [{}]
		} as unknown as HTMLElement;
		vi.stubGlobal('document', { activeElement: null });
		const action = rijen(node, 'a');
		const field = { closest: (s: string) => (s.includes('input') ? {} : null) };
		const press = (target: unknown) => {
			const e = {
				key: 'j',
				target,
				metaKey: false,
				ctrlKey: false,
				altKey: false,
				shiftKey: false,
				defaultPrevented: false,
				preventDefault: vi.fn()
			};
			listener!(e as unknown as KeyboardEvent);
			return e;
		};
		expect(press(field).preventDefault).not.toHaveBeenCalled();
		expect(row.focus).not.toHaveBeenCalled();
		expect(press({ closest: () => null }).preventDefault).toHaveBeenCalled();
		expect(row.focus).toHaveBeenCalled();
		action.destroy();
	});
});

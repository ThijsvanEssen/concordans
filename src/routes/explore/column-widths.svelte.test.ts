import { afterEach, describe, expect, it, vi } from 'vitest';
import { ColumnWidths } from './column-widths.svelte';

/** A pointer event on a handle outside the page: the column is measured from what was kept. */
const pointer = (clientX: number) =>
	({
		clientX,
		pointerId: 1,
		preventDefault() {},
		currentTarget: { closest: () => null },
		target: { setPointerCapture() {} }
	}) as unknown as PointerEvent;

afterEach(() => vi.unstubAllGlobals());

describe('ColumnWidths', () => {
	it('grows Verbonden as its handle moves left, and keeps the width when the drag ends', () => {
		const setItem = vi.fn();
		vi.stubGlobal('localStorage', { getItem: () => '{"panelW":400}', setItem });
		const widths = new ColumnWidths();
		widths.load();
		expect(widths.css('panel')).toBe('400px');
		expect(widths.css('graph')).toBeUndefined();
		widths.start(pointer(500), 'panel');
		widths.move(pointer(450));
		expect(widths.css('panel')).toBe('450px');
		widths.end();
		expect(widths.drag).toBeNull();
		expect(JSON.parse(setItem.mock.calls[0][1])).toEqual({ panelW: 450 });
	});

	it('grows the network as its handle moves right, within its bounds', () => {
		vi.stubGlobal('localStorage', { getItem: () => '{"graphW":1300}', setItem() {} });
		const widths = new ColumnWidths();
		widths.load();
		widths.start(pointer(100), 'graph');
		widths.move(pointer(400));
		expect(widths.css('graph')).toBe('1400px');
	});

	it('works without storage', () => {
		vi.stubGlobal('localStorage', {
			getItem() {
				throw new Error('blocked');
			},
			setItem() {
				throw new Error('blocked');
			}
		});
		const widths = new ColumnWidths();
		widths.load();
		widths.start(pointer(0), 'graph');
		widths.move(pointer(2000));
		widths.end();
		expect(widths.css('graph')).toBe('1400px');
	});
});

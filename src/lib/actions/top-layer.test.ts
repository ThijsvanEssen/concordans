import { afterEach, describe, expect, it, vi } from 'vitest';
import { clickOutside, EDGE, GAP, MIN_ROOM, outOfView, placement, topOf } from './top-layer';

const view = { width: 1440, height: 900 };
const anchor = (top: number, left = 100, width = 60, height = 20) => ({
	top,
	bottom: top + height,
	left,
	right: left + width
});

describe('placement', () => {
	it('puts a box below its anchor, at its left edge, with the room down to the window', () => {
		const a = anchor(100);
		const p = placement(a, { width: 200, height: 300 }, view);
		expect(p).toEqual({ up: false, room: 900 - 120 - GAP - EDGE, left: 100 });
		expect(topOf(a, p.up, 300)).toBe(120 + GAP);
	});

	it('puts it above where it does not fit below and there is more room above', () => {
		const a = anchor(700);
		const p = placement(a, { width: 200, height: 400 }, view);
		expect(p.up).toBe(true);
		expect(p.room).toBe(700 - GAP - EDGE);
		expect(topOf(a, p.up, 400)).toBe(700 - GAP - 400);
	});

	it('stays below where above is no better, its height capped at the room', () => {
		const p = placement(anchor(400), { width: 200, height: 800 }, view);
		expect(p.up).toBe(false);
		expect(p.room).toBe(900 - 420 - GAP - EDGE);
	});

	it('gives a box the least room however little the window leaves', () => {
		const small = { width: 375, height: 200 };
		expect(placement(anchor(90), { width: 200, height: 300 }, small).room).toBe(MIN_ROOM);
	});

	it('hangs from the right edge when asked, and never past a side of the window', () => {
		expect(placement(anchor(100, 300), { width: 200, height: 50 }, view, 'right').left).toBe(160);
		expect(placement(anchor(100, 1400), { width: 200, height: 50 }, view).left).toBe(
			1440 - 200 - EDGE
		);
		expect(placement(anchor(100, 20), { width: 200, height: 50 }, view, 'right').left).toBe(EDGE);
	});
});

describe('outOfView', () => {
	// The Verbonden column of art. 6:162 BW at 1440×700: its top at 136 under the TopBar (#96).
	const column = { top: 136, bottom: 700, left: 900, right: 1440 };
	const shown = { top: 0, bottom: 700, left: 0, right: 1440 };

	it('keeps a box while its anchor shows in every box that clips it', () => {
		expect(outOfView(anchor(300, 1200), [column, shown])).toBe(false);
		// Half of it under the column's edge still shows it.
		expect(outOfView(anchor(130, 1200), [column, shown])).toBe(false);
	});

	it('closes it once its anchor scrolls out of the visible part of its column (#96)', () => {
		expect(outOfView(anchor(2, 1200), [column, shown])).toBe(true);
		expect(outOfView(anchor(695, 1200), [column, shown])).toBe(true);
		expect(outOfView(anchor(300, 1200), [{ ...column, right: 1100 }])).toBe(true);
	});
});

describe('clickOutside', () => {
	class FakeNode {
		constructor(private within: FakeNode[] = []) {}
		contains = (n: unknown) => n === this || this.within.includes(n as FakeNode);
	}
	afterEach(() => vi.unstubAllGlobals());

	it('calls on a click outside, in the capture phase, and not on one inside', () => {
		vi.stubGlobal('Node', FakeNode);
		const listeners: [string, (e: Event) => void, unknown][] = [];
		vi.stubGlobal('document', {
			addEventListener: (t: string, f: (e: Event) => void, c: unknown) => listeners.push([t, f, c]),
			removeEventListener: vi.fn()
		});
		const item = new FakeNode();
		const box = new FakeNode([item]);
		const anchorNode = new FakeNode();
		const outside = vi.fn();
		const stop = clickOutside(
			() => [box as unknown as Node, anchorNode as unknown as Node],
			outside
		);
		const [type, watch, capture] = listeners[0];
		expect([type, capture]).toEqual(['click', true]);
		const click = (target: unknown) =>
			({ target, stopPropagation: vi.fn(), preventDefault: vi.fn() }) as unknown as Event;
		const within = click(item);
		watch(within);
		watch(click(anchorNode));
		expect(outside).not.toHaveBeenCalled();
		expect(within.preventDefault).not.toHaveBeenCalled();
		// The tap that closes the box opens nothing under it (#98).
		const elsewhere = click(new FakeNode());
		watch(elsewhere);
		expect(outside).toHaveBeenCalledOnce();
		expect(elsewhere.stopPropagation).toHaveBeenCalled();
		expect(elsewhere.preventDefault).toHaveBeenCalled();
		stop();
		expect(document.removeEventListener).toHaveBeenCalledWith('click', watch, true);
	});
});

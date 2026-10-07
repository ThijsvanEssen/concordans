import { describe, expect, it } from 'vitest';
import { labelX, plaatsLabel } from './label-place';

describe('labelX', () => {
	it('puts a name right of its bron where it fits', () => {
		expect(labelX(100, 8, 80, 320)).toBe(111);
	});

	it('puts it left where the right would run past the edge', () => {
		expect(labelX(280, 8, 80, 320)).toBe(189);
	});

	it('keeps it whole on the canvas where neither side has room', () => {
		// A name of 200 px beside a bron at 120 in a column of 320 px.
		expect(labelX(120, 8, 200, 320)).toBe(118);
		// Wider than the canvas: from its left edge.
		expect(labelX(120, 8, 400, 320)).toBe(2);
	});
});

describe('plaatsLabel', () => {
	it('puts a name right of its bron while that place is free', () => {
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, [])).toEqual({ x: 111, y: 92 });
	});

	it('moves it left, above or below where another name stands', () => {
		const right = { x: 111, y: 92, w: 80, h: 16 };
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, [right])).toEqual({ x: 9, y: 92 });
		const left = { x: 9, y: 92, w: 80, h: 16 };
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, [right, left])).toEqual({ x: 60, y: 73 });
	});

	it('leaves it out where every place is taken, except for the focus', () => {
		const all = [{ x: 0, y: 0, w: 400, h: 400 }];
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, all)).toBeNull();
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, all, true)).toEqual({ x: 111, y: 92 });
	});
});

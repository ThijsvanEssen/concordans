import { describe, expect, it } from 'vitest';
import {
	hoverPlaats,
	LABEL_MAX,
	labelX,
	lijnLabelPlaats,
	overlaps,
	plaatsLabel,
	planLabels,
	type LabelKandidaat,
	type Rect
} from './label-place';

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

describe('plaatsLabel at the foot of the canvas', () => {
	it('puts a name of the lowest bron beside it, never below the canvas (N8)', () => {
		// Right and left taken: below would run past the foot of a canvas of 120 px.
		const right = { x: 111, y: 92, w: 80, h: 16 };
		const left = { x: 9, y: 92, w: 80, h: 16 };
		const above = { x: 60, y: 73, w: 80, h: 16 };
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, [right, left, above], false, 120)).toBeNull();
		expect(plaatsLabel(100, 100, 8, 80, 16, 400, [right, left, above], false, 200)).toEqual({
			x: 60,
			y: 111
		});
	});
});

describe('planLabels', () => {
	const room = { width: 1000, height: 1000 };
	const glyph = (k: LabelKandidaat): Rect => ({
		x: k.x - k.size,
		y: k.y - k.size,
		w: 2 * k.size,
		h: 2 * k.size
	});
	/** A dense canvas: 150 bronnen in a grid 40 px apart (BH2815 and its uitspraken). */
	const dicht = Array.from(
		{ length: 150 },
		(_, i): LabelKandidaat => ({
			id: `j${i}`,
			x: 40 + (i % 15) * 40,
			y: 40 + Math.floor(i / 15) * 40,
			size: 5,
			w: 150,
			h: 17,
			rang: 0
		})
	);

	it('places no name over another, over a bron or over a hull’s name', () => {
		const vast = [{ x: 300, y: 100, w: 120, h: 22 }];
		const plan = planLabels(dicht, room, vast, dicht.map(glyph));
		const placed = [...plan.values()];
		expect(placed.length).toBeGreaterThan(0);
		for (const [i, a] of placed.entries()) {
			for (const b of placed.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
			for (const g of dicht.map(glyph)) expect(overlaps(a, g)).toBe(false);
			expect(overlaps(a, vast[0])).toBe(false);
		}
	});

	it('names at most sixty in a frame, the higher ranks first (N4)', () => {
		const ruim = Array.from(
			{ length: 100 },
			(_, i): LabelKandidaat => ({
				id: `b${i}`,
				x: 50 + (i % 5) * 200,
				y: 20 + Math.floor(i / 5) * 48,
				size: 4,
				w: 60,
				h: 17,
				rang: i === 99 ? 4 : 0
			})
		);
		const plan = planLabels(ruim, { width: 1100, height: 1000 }, [], []);
		expect(plan.size).toBe(LABEL_MAX);
		// A chosen bron at the end of the list is named before the others.
		expect(plan.has('b99')).toBe(true);
	});

	it('always names the focus, wherever the others stand', () => {
		const focus: LabelKandidaat = {
			id: 'f',
			x: 300,
			y: 300,
			size: 8,
			w: 90,
			h: 17,
			rang: 0,
			altijd: true
		};
		const vol = [{ x: 0, y: 0, w: 1000, h: 1000 }];
		expect(planLabels([...dicht, focus], room, vol, []).get('f')).toEqual({
			x: 311,
			y: 291.5,
			w: 90,
			h: 17
		});
	});
});

describe('hoverPlaats', () => {
	it('stands right of the bron where it fits, left where a card covers the right', () => {
		expect(hoverPlaats(100, 50, 5, 80, 16, 400)).toEqual({ x: 108, y: 42 });
		const kaart = { x: 200, y: 0, w: 200, h: 300 };
		expect(hoverPlaats(150, 50, 5, 80, 16, 400, kaart)).toEqual({ x: 62, y: 42 });
	});

	it('stays inside the canvas where neither side has room', () => {
		const p = hoverPlaats(30, 50, 5, 380, 16, 400);
		expect(p.x).toBeGreaterThanOrEqual(2);
		expect(p.x + 380).toBeLessThanOrEqual(398);
	});
});

describe('lijnLabelPlaats', () => {
	it('centres the name on the middle of the line, level, inside the canvas', () => {
		expect(lijnLabelPlaats(0, 0, 200, 100, 60, 14, 400)).toEqual({ x: 70, y: 43 });
		expect(lijnLabelPlaats(380, 0, 400, 0, 60, 14, 400).x).toBe(338);
	});
});

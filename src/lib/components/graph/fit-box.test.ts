import { describe, expect, it } from 'vitest';
import { fitBox, insetsOf, NAME_BELOW } from './fit-box';

const rect = (left: number, top: number, width: number, height: number) =>
	({
		x: left,
		y: top,
		left,
		top,
		width,
		height,
		right: left + width,
		bottom: top + height
	}) as DOMRectReadOnly;

/** Where graph `y` stands on a canvas of `height` px that frames `box` (graph y points up). */
const screenY = (y: number, box: { y: [number, number] }, height: number, padding: number) =>
	padding + ((box.y[1] - y) / (box.y[1] - box.y[0])) * (height - 2 * padding);

describe('fitBox', () => {
	const dims = { width: 400, height: 800 };
	const none = { top: 0, right: 0, bottom: 0, left: 0 };

	it('frames the bronnen alone without anything to keep free', () => {
		expect(fitBox({ x: 0, y: 0 }, { x: 100, y: 100 }, dims, 20, none)).toEqual({
			x: [0, 100],
			y: [0, 100]
		});
	});

	it('keeps the foot free: the lowest bron stands its name above the lower edge (N8)', () => {
		const box = fitBox({ x: 0, y: 0 }, { x: 100, y: 100 }, dims, 20, {
			...none,
			bottom: NAME_BELOW
		});
		// The lowest bron (y 0) stands NAME_BELOW px above the padding at the foot.
		expect(screenY(0, box, 800, 20)).toBeCloseTo(800 - 20 - NAME_BELOW);
		// The highest stays at the top.
		expect(screenY(100, box, 800, 20)).toBeCloseTo(20);
	});

	it('keeps room above for a hull’s name and at the side for the zoom', () => {
		const box = fitBox({ x: 0, y: 0 }, { x: 100, y: 100 }, dims, 20, {
			top: 30,
			right: 40,
			bottom: 0,
			left: 0
		});
		expect(box.y[0]).toBe(0);
		expect(box.y[1]).toBeGreaterThan(100);
		expect(box.x[0]).toBe(0);
		expect(box.x[1]).toBeGreaterThan(100);
	});

	it('does not grow an axis too short to keep its sides free', () => {
		const box = fitBox({ x: 0, y: 0 }, { x: 100, y: 100 }, { width: 400, height: 100 }, 20, {
			...none,
			top: 30,
			bottom: 30
		});
		expect(box.y).toEqual([0, 100]);
	});
});

describe('inzetVan', () => {
	const canvas = rect(300, 60, 780, 779);

	it('keeps the side of the zoom free, a column at the lower right', () => {
		expect(insetsOf(canvas, [rect(1044, 747, 24, 80)])).toEqual({
			top: 0,
			right: 36,
			bottom: 0,
			left: 0
		});
	});

	it('keeps the foot free for a strip over the lower edge (a tijdstrook over the canvas)', () => {
		expect(insetsOf(canvas, [rect(300, 778, 780, 61)]).bottom).toBe(61);
	});

	it('leaves what is not over the canvas or not shown', () => {
		// The tijdstrook under the canvas, and the zoom on a phone (display: none).
		expect(insetsOf(canvas, [rect(300, 839, 780, 61), rect(0, 0, 0, 0)])).toEqual({
			top: 0,
			right: 0,
			bottom: 0,
			left: 0
		});
	});
});

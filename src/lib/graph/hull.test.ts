import { describe, expect, it } from 'vitest';
import { exitPoint, hullOutline, pointInPolygon, type Point } from './hull';

const around = (outline: Point[], polygon: Point[]) => ({ outline, polygon });

describe('hullOutline: a disc, the members plus 16', () => {
	it.each([
		['one point', [{ x: 10, y: 20 }], { x: 10, y: 20, r: 16 }],
		[
			'two points',
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 }
			],
			{ x: 50, y: 0, r: 66 }
		],
		[
			'a sharp triangle and a point inside it',
			[
				{ x: 0, y: 0 },
				{ x: 200, y: 20 },
				{ x: 60, y: 150 },
				{ x: 70, y: 50 }
			],
			{ x: 100, y: 75, r: Math.hypot(100, 75) + 16 }
		]
	])(
		'is centred on the middle of %s, as wide as the farthest plus the margin',
		(_, points, want) => {
			const { outline, polygon, path } = hullOutline(points, 16);
			expect(path).toMatch(/^M .* Z$/);
			for (const q of polygon)
				expect(Math.hypot(q.x - want.x, q.y - want.y)).toBeCloseTo(want.r, 6);
			for (const p of points) expect(Math.hypot(p.x - want.x, p.y - want.y)).toBeLessThan(want.r);
			expect(around(outline, polygon).outline).toEqual([{ x: want.x, y: want.y - want.r }]);
		}
	);

	it('keeps every point at least the margin inside the disc', () => {
		const points = [
			{ x: 0, y: 40 },
			{ x: 50, y: 10 },
			{ x: 90, y: 60 }
		];
		const { polygon } = hullOutline(points, 16);
		const r = Math.hypot(polygon[0].x - polygon[12].x, polygon[0].y - polygon[12].y) / 2;
		const cx = (polygon[0].x + polygon[12].x) / 2;
		const cy = (polygon[0].y + polygon[12].y) / 2;
		for (const p of points)
			expect(r - Math.hypot(p.x - cx, p.y - cy)).toBeGreaterThanOrEqual(16 - 1e-6);
	});

	it('has no path for no points', () => {
		expect(hullOutline([], 16)).toEqual({ outline: [], polygon: [], path: '' });
	});

	it('cuts a line between hulls at the outline it leaves', () => {
		const { polygon } = hullOutline([{ x: 0, y: 0 }], 16);
		const exit = exitPoint({ x: 0, y: 0 }, { x: 100, y: 0 }, polygon);
		expect(exit.x).toBeCloseTo(16, 6);
		expect(exit.y).toBeCloseTo(0, 6);
	});
});

describe('pointInPolygon', () => {
	const square = [
		{ x: 0, y: 0 },
		{ x: 10, y: 0 },
		{ x: 10, y: 10 },
		{ x: 0, y: 10 }
	];
	it('finds a point inside and not one outside', () => {
		expect(pointInPolygon({ x: 5, y: 5 }, square)).toBe(true);
		expect(pointInPolygon({ x: 15, y: 5 }, square)).toBe(false);
		expect(pointInPolygon({ x: 5, y: -1 }, [])).toBe(false);
	});
});

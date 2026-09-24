import { describe, expect, it } from 'vitest';
import { hullOutline, type Point } from './hull';

const nearest = (p: Point, points: Point[]) =>
	Math.min(...points.map((q) => Math.hypot(p.x - q.x, p.y - q.y)));

describe('hullOutline', () => {
	it.each([
		[
			'two points',
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 0 }
			]
		],
		[
			'a sharp triangle and a point inside it',
			[
				{ x: 0, y: 0 },
				{ x: 200, y: 20 },
				{ x: 60, y: 150 },
				{ x: 70, y: 50 }
			]
		]
	])('keeps every point %s the margin inside the outline', (_, points) => {
		const { outline, path } = hullOutline(points, 16);
		expect(path).toMatch(/^M .* Z$/);
		// Every point the outline passes through is exactly the margin from the nearest point:
		// no corner is cut, and nothing bulges further out than it has to.
		for (const p of outline.filter((_, i) => i % 3 !== 2)) {
			expect(nearest(p, points)).toBeCloseTo(16, 6);
		}
	});

	it('anchors the top of the outline the margin above the highest point', () => {
		const { outline } = hullOutline(
			[
				{ x: 0, y: 40 },
				{ x: 50, y: 10 },
				{ x: 90, y: 60 }
			],
			16
		);
		expect(Math.min(...outline.map((p) => p.y))).toBeCloseTo(-6, 6);
	});
});

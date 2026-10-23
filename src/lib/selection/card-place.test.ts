import { describe, expect, it } from 'vitest';
import { clusterCardAt, placeCard } from './card-place';

const canvas = { width: 1024, height: 291 };
const card = { w: 280, h: 150 };
const netwerk = { x: 732, y: 12, w: 280, h: 84 };
const zoom = { x: 984, y: 140, w: 28, h: 92 };

describe('placeCard', () => {
	it('stands right of the pointer where nothing floats there', () => {
		expect(placeCard({ x: 200, y: 100 }, card, canvas, [netwerk, zoom])).toEqual({
			x: 216,
			y: 84
		});
	});

	it('does not cover the panel Netwerk (art. 6:162 at 1280)', () => {
		const at = placeCard({ x: 600, y: 60 }, card, canvas, [netwerk, zoom]);
		const box = { ...at, ...card };
		for (const o of [netwerk, zoom])
			expect(
				box.x + box.w <= o.x || o.x + o.w <= box.x || box.y + box.h <= o.y || o.y + o.h <= box.y
			).toBe(true);
	});

	it('stays within the canvas', () => {
		const at = placeCard({ x: 1000, y: 280 }, card, canvas, []);
		expect(at.x + card.w).toBeLessThanOrEqual(canvas.width - 8);
		expect(at.y + card.h).toBeLessThanOrEqual(canvas.height - 8);
	});
});

describe('clusterCardAt', () => {
	it('stands right of the pointer, or against the right edge', () => {
		expect(clusterCardAt({ x: 100, y: 100 }, 1000)).toEqual({ x: 116, y: 84 });
		expect(clusterCardAt({ x: 900, y: 10 }, 1000)).toEqual({ x: 712, y: 8 });
	});
});

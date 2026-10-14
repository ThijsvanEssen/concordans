import { describe, expect, it } from 'vitest';
import { cardBeside, clusterCardAt, foldStep, legendPlace, placeCard } from './card-place';

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

describe('cardBeside', () => {
	const canvas = { width: 1000, height: 600 };
	it('stands right of the bron, a little above it', () => {
		expect(cardBeside({ x: 100, y: 200 }, canvas)).toEqual({ x: 120, y: 160 });
	});
	it('stands left of a bron near the right edge', () => {
		expect(cardBeside({ x: 900, y: 200 }, canvas)).toEqual({ x: 520, y: 160 });
	});
	it('keeps its foot in the canvas and its head under the top', () => {
		expect(cardBeside({ x: 100, y: 590 }, canvas).y).toBe(600 - 240 - 8);
		expect(cardBeside({ x: 100, y: 10 }, canvas).y).toBe(8);
	});
	it('is as wide as a narrow network allows', () => {
		expect(cardBeside({ x: 150, y: 100 }, { width: 320, height: 600 })).toEqual({ x: 8, y: 60 });
	});
});

describe('clusterCardAt', () => {
	it('stands right of the pointer, or against the right edge', () => {
		expect(clusterCardAt({ x: 100, y: 100 }, 1000)).toEqual({ x: 116, y: 84 });
		expect(clusterCardAt({ x: 900, y: 10 }, 1000)).toEqual({ x: 712, y: 8 });
	});
});

describe('legendPlace', () => {
	const card = { width: 280, edge: 12 };
	it('stands under the panel Netwerk, on its right edge', () => {
		const panel = { top: 12, left: 708, width: 280, height: 120 };
		expect(legendPlace({ width: 1000, height: 600 }, panel, card)).toEqual({
			top: 140,
			right: 12,
			width: 280,
			max: 448
		});
	});
	it('stands in the corner without the panel', () => {
		expect(legendPlace({ width: 1000, height: 600 }, null, card)).toEqual({
			top: 12,
			right: 12,
			width: 280,
			max: 576
		});
	});
	it('keeps the cards’ width beside a folded panel, inside a narrow canvas', () => {
		const folded = { top: 12, left: 900, width: 88, height: 40 };
		expect(legendPlace({ width: 1000, height: 600 }, folded, card).width).toBe(280);
		expect(legendPlace({ width: 250, height: 600 }, null, card).width).toBe(226);
	});
});

describe('foldStep', () => {
	const base = {
		height: 500,
		panel: { open: true, height: 300 },
		legend: { open: true, height: 300 },
		folded: null,
		lastOpened: null,
		openHeights: {}
	} as const;
	it('folds the card not opened last where both do not fit', () => {
		expect(foldStep(base)).toEqual({ fold: 'legenda' });
		expect(foldStep({ ...base, lastOpened: 'legenda' })).toEqual({ fold: 'netwerk' });
	});
	it('leaves both open where they fit', () => {
		expect(foldStep({ ...base, height: 700 })).toBeNull();
	});
	it('opens a folded card again only with room to spare', () => {
		const folded = {
			...base,
			legend: { open: false, height: 40 },
			folded: 'legenda',
			openHeights: { legenda: 300 }
		} as const;
		expect(foldStep({ ...folded, height: 640 })).toBeNull();
		expect(foldStep({ ...folded, height: 680 })).toBe('unfold');
	});
});

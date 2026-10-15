import { describe, expect, it } from 'vitest';
import { clampWidth, parseWidths } from './column-widths.svelte';

describe('the column widths', () => {
	it('reads what an earlier visit kept, and nothing from an unreadable entry', () => {
		expect(parseWidths('{"navW":300,"panelW":420}')).toEqual({ nav: 300, panel: 420 });
		expect(parseWidths('{"graphW":0,"panelW":"wide"}')).toEqual({});
		expect(parseWidths('{')).toEqual({});
		expect(parseWidths(null)).toEqual({});
	});

	it('holds a dragged column between its bounds', () => {
		expect(clampWidth('nav', 100)).toBe(140);
		expect(clampWidth('nav', 600)).toBe(480);
		expect(clampWidth('panel', 200)).toBe(240);
		expect(clampWidth('panel', 900)).toBe(560);
		expect(clampWidth('graph', 150)).toBe(200);
		expect(clampWidth('graph', 2000)).toBe(1400);
		expect(clampWidth('graph', 700)).toBe(700);
	});
});

import { describe, expect, it } from 'vitest';
import { LINE_CONTRAST, contrast, floorStrength, lineStrength, mixed } from './line-strength';
import { FALLBACK } from '$lib/components/graph/nodeSprites';

const paper = FALLBACK.paper;
const colours = [FALLBACK.moss, FALLBACK.rubriekWetten, FALLBACK.slate, FALLBACK.plum, FALLBACK.ink3];

describe('the strength of a line at rest', () => {
	it('keeps every line of a chosen bron at 3:1 against the paper, however many there are', () => {
		for (const colour of colours)
			for (const n of [1, 9, 50, 200, 5000]) {
				const drawn = mixed(colour, paper, lineStrength(colour, paper, n));
				expect(contrast(drawn, paper), `${colour} of ${n}`).toBeGreaterThanOrEqual(
					LINE_CONTRAST - 0.05
				);
			}
	});

	it('draws a fan of up to nine in full and a larger one paler, down to the floor', () => {
		expect(lineStrength(FALLBACK.rubriekWetten, paper, 9)).toBe(1);
		expect(lineStrength(FALLBACK.rubriekWetten, paper, 100)).toBeLessThan(1);
		expect(lineStrength(FALLBACK.rubriekWetten, paper, 1e6)).toBeCloseTo(
			floorStrength(FALLBACK.rubriekWetten, paper),
			5
		);
	});

	it('draws a hovered bron’s own lines in full', () => {
		expect(mixed(FALLBACK.moss, paper, 1)).toBe(FALLBACK.moss);
	});
});

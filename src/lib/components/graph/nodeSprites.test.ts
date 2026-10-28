import { describe, expect, it } from 'vitest';
import { VORMEN, type Vorm } from '$lib/bron/vormen';
import { EDGE_AT_45, badgeAxisOffset, focusRing, openStroke } from './nodeSprites';

describe('the badge on the edge of a vorm', () => {
	it('knows the edge of every vorm, inside its 16-box', () => {
		for (const vorm of Object.keys(VORMEN) as Vorm[]) {
			expect(EDGE_AT_45[vorm], vorm).toBeGreaterThan(0);
			expect(EDGE_AT_45[vorm], vorm).toBeLessThanOrEqual(8);
		}
	});

	it('puts the badge of a wet on the corner of its square (2 to 14 in the 16-box)', () => {
		// The 16-box fills 24 of the sprite's 32 units; half the sprite is the radius.
		expect(badgeAxisOffset('regel')).toBeCloseTo((6 * 1.5) / 16);
	});

	it('puts the badge of a judgment on its circle (radius 6.5)', () => {
		expect(badgeAxisOffset('uitspraak')).toBeCloseTo(((6.5 / Math.SQRT2) * 1.5) / 16, 2);
	});
});

describe('the open sign (A317, C10)', () => {
	it('draws a repealed or outside bron with a thin edge, a live article with a full one', () => {
		expect(openStroke(true, 'lijn')).toBe(1.3);
		expect(openStroke(false, 'lijn')).toBe(2);
		expect(openStroke(true, 'vul')).toBe(1.3);
	});
});

describe('the ring of the focus (A317, B5)', () => {
	it('stands outside the edge of an open sign, which a full sign would hide it under', () => {
		// The ring is centred on the edge; the sign covers its inner half and, drawn as a line, its
		// own 2 px: what shows is wider than a hair, and the halo of paper wider still.
		const open = focusRing('lijn');
		expect((open.ink - 2) / 2).toBeGreaterThanOrEqual(1.5);
		expect(open.halo).toBeGreaterThan(open.ink);
		expect(focusRing('vul').ink / 2).toBeGreaterThanOrEqual(1.5);
	});
});

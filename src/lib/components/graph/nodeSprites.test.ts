import { describe, expect, it } from 'vitest';
import { VORM_VOLGORDE } from '$lib/bron/vormen';
import { EDGE_AT_45, badgeAxisOffset } from './nodeSprites';

describe('the badge on the edge of a vorm', () => {
	it('knows the edge of every vorm, inside its 16-box', () => {
		for (const vorm of VORM_VOLGORDE) {
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

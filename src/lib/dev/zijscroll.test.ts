import { describe, expect, it } from 'vitest';
import { teHoog } from './zijscroll';

/** A document of a page, its height and the screen's, with or without the explore columns. */
const doc = (scrollHeight: number, clientHeight: number, kolommen: boolean) =>
	({
		querySelector: () => (kolommen ? {} : null),
		documentElement: { scrollHeight, clientHeight }
	}) as unknown as Document;

describe('a page that scrolls in its own columns', () => {
	it('is no taller than the screen (UX-toets 10 Oct, #35: 827 px on 812)', () => {
		expect(teHoog(doc(827, 812, true))).toBe(15);
		expect(teHoog(doc(812, 812, true))).toBe(0);
		// One pixel of rounding is no scroll.
		expect(teHoog(doc(813, 812, true))).toBe(0);
		// A page that scrolls as a whole (Actueel) may be as tall as it is.
		expect(teHoog(doc(4000, 812, false))).toBe(0);
	});
});

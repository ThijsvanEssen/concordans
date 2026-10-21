import { describe, expect, it } from 'vitest';
import { hiddenSides } from './side-scroll';
import { BRONNEN } from '$lib/test/bronnen';

describe('a box that pans sideways (sideScroll)', () => {
	const box = (scrollLeft: number, scrollWidth = 400, clientWidth = 300) => ({
		scrollLeft,
		scrollWidth,
		clientWidth
	});

	it('says which side hides more', () => {
		expect(hiddenSides(box(0))).toEqual({ left: false, right: true });
		expect(hiddenSides(box(50))).toEqual({ left: true, right: true });
		expect(hiddenSides(box(100))).toEqual({ left: true, right: false });
		expect(hiddenSides(box(0, 300))).toEqual({ left: false, right: false });
	});

	it('is measured in one place, its edge faded in one stylesheet', () => {
		const files = (rule: RegExp) =>
			BRONNEN.filter(({ text }) => rule.test(text)).map((b) => b.path);
		expect(files(/scrollLeft \+ clientWidth/)).toEqual(['lib/actions/side-scroll.ts']);
		expect(files(/data-more-right\]/)).toEqual(['lib/styles/basis.css']);
	});
});

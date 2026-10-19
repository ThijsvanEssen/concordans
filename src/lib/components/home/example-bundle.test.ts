import { describe, expect, it } from 'vitest';
import { sharedOfFragment } from '$lib/map/share';
import { EXAMPLE_BUNDLE, EXAMPLE_BUNDLE_HREF, EXAMPLE_LINES } from './example-bundle';

describe('the Bundel of the start page', () => {
	// Not the compressed string itself: deflate output differs between zlib builds (CI against a Mac).
	it('opens whole: every item reads back', async () => {
		const shared = await sharedOfFragment(new URL(EXAMPLE_BUNDLE_HREF, 'https://x.nl').hash);
		expect(shared).toMatchObject({
			naam: EXAMPLE_BUNDLE.naam,
			notitie: EXAMPLE_BUNDLE.notitie,
			items: EXAMPLE_BUNDLE.items,
			skipped: 0
		});
	});

	it('links each line to its readable address, not to /explore?focus= (a 301)', () => {
		expect(EXAMPLE_LINES.map((l) => l.href)).toEqual([
			'/wetten/BWBR0005290/artikel/7:658#lid-1',
			'/wetten/BWBR0005290/artikel/7:611',
			'/uitspraken/ECLI:NL:HR:2005:AU3313'
		]);
	});
});

import { describe, expect, it } from 'vitest';
import { shareFragment, sharedOfFragment } from '$lib/map/share';
import { EXAMPLE_BUNDLE, EXAMPLE_BUNDLE_HREF } from './example-bundle';

describe('the Bundel of the start page', () => {
	it('links the bundel itself, as Kopieer link gives it', async () => {
		expect(EXAMPLE_BUNDLE_HREF).toBe(`/gemarkeerd${await shareFragment(EXAMPLE_BUNDLE)}`);
	});

	it('opens whole: every item reads back', async () => {
		const shared = await sharedOfFragment(new URL(EXAMPLE_BUNDLE_HREF, 'https://x.nl').hash);
		expect(shared).toMatchObject({
			naam: EXAMPLE_BUNDLE.naam,
			notitie: EXAMPLE_BUNDLE.notitie,
			items: EXAMPLE_BUNDLE.items,
			skipped: 0
		});
	});
});

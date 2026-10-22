// Nothing under the filters of Actueel moves when their counts come in (UX-toets T5): the
// lists of Ingediend door and Coalitie keep their room while the facets are on their way.
import { expect, test } from '../support/test';

test('Actueel: the filters keep their place while the counts come in', async ({ page, touch }) => {
	test.skip(touch, 'the filters of a phone wait behind Verfijnen');
	let release!: () => void;
	const held = new Promise<void>((done) => (release = done));
	// The facets answer last, as they do on a cold start.
	await page.route(/\/api\/feed\?.*facets=true/, async (route) => {
		await held;
		await route.fallback();
	});
	await page.goto('/actueel');
	const heading = (name: string) => page.getByRole('heading', { level: 2, name, exact: true });
	await expect(heading('Stemde')).toBeVisible();
	const at = async (name: string) => (await heading(name).boundingBox())!.y;
	const before = { Stemde: await at('Stemde'), Ministerie: await at('Ministerie') };

	release();
	await expect(heading('Coalitie')).toBeVisible();
	await expect(
		page.getByRole('region', { name: 'Ingediend door' }).getByRole('button').first()
	).toContainText(/\d/);
	// A line of an option is 24 px: less than one of them.
	expect(Math.abs((await at('Stemde')) - before.Stemde)).toBeLessThan(8);
	// Coalitie came in beside its room, so what is under it moves by nothing either.
	expect(Math.abs((await at('Ministerie')) - before.Ministerie)).toBeLessThan(8);
});

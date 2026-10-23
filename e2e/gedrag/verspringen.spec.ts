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

// On a phone Verbonden stands under the text: nothing shifts while an article or a judgment comes
// in (besluit 31), the layout shift of the whole load at most 0.05.
const READERS = [
	{ what: 'an article', path: '/wetten/BWBR0005289/artikel/6:162' },
	{ what: 'a judgment', path: '/uitspraken/ECLI:NL:HR:2019:2006' }
];

for (const r of READERS) {
	test(`${r.what} comes in on a phone without a shift`, async ({ page, touch }) => {
		test.skip(!touch, 'Verbonden stands under the text on a phone');
		// The text comes a moment after the rest, as on a slow line: Verbonden must not stand
		// where it comes.
		await page.route(/\/api\/(articles|judgments)\//, async (route) => {
			await new Promise((done) => setTimeout(done, 1200));
			await route.fallback();
		});
		await page.addInitScript(() => {
			const w = window as unknown as { __cls: number };
			w.__cls = 0;
			new PerformanceObserver((list) => {
				for (const e of list.getEntries() as (PerformanceEntry & {
					value: number;
					hadRecentInput: boolean;
				})[])
					if (!e.hadRecentInput) w.__cls += e.value;
			}).observe({ type: 'layout-shift', buffered: true });
		});
		await page.goto(r.path);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await expect(page.getByRole('heading', { level: 2, name: 'Verbonden' })).toBeAttached();
		await page.waitForTimeout(1500);
		const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
		expect(cls).toBeLessThanOrEqual(0.05);
	});
}

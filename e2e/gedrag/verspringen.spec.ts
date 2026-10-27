// Nothing under the filters of Actueel moves when their counts come in (UX-toets T5): the bar
// of filters keeps its buttons and the head line its height while the facets are on their way.
import { expect, test } from '../support/test';

test('Actueel: the filters keep their place while the counts come in', async ({ page, touch }) => {
	test.skip(touch, 'the filters of a phone wait behind Filter');
	let release!: () => void;
	const held = new Promise<void>((done) => (release = done));
	// The facets answer last, as they do on a cold start.
	await page.route(/\/api\/feed\?.*facets=true/, async (route) => {
		await held;
		await route.fallback();
	});
	await page.goto('/actueel');
	const meer = page.getByRole('button', { name: /^Meer(:|$)/ });
	const head = page.locator('.filterbar .head');
	await expect(meer).toBeVisible();
	const at = async () => ({
		meer: (await meer.boundingBox())!.x,
		under: (await head.boundingBox())!.y + (await head.boundingBox())!.height
	});
	const before = await at();

	release();
	await expect(head).toContainText(/\d/);
	const after = await at();
	expect(after.meer).toBe(before.meer);
	expect(Math.abs(after.under - before.under)).toBeLessThan(2);
});

// On a phone Verbonden stands under the text: nothing shifts while an article or a judgment comes
// in (besluit 31), the layout shift of the whole load at most 0.05.
const READERS = [
	{ what: 'an article', path: '/wetten/BWBR0005289/artikel/6:162' },
	{ what: 'a judgment', path: '/uitspraken/ECLI:NL:HR:2019:2006' }
];

for (const r of READERS) {
	test(`${r.what} comes in on a phone without a shift`, async ({ page, touch }) => {
		test.skip(!touch, 'a phone');
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
		// Verbonden is a tab of its own on a phone (A197-a).
		await expect(
			page
				.getByRole('group', { name: 'Tekst of Verbonden' })
				.getByRole('button', { name: 'Verbonden' })
		).toBeVisible();
		await page.waitForTimeout(1500);
		const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
		expect(cls).toBeLessThanOrEqual(0.05);
	});
}

// The line of the peildatum comes with the law's versions, which the API answers last (T9): the
// text under it keeps its place, on a phone and on a wide screen.
test('the text of an article keeps its place when the peildatum comes', async ({ page }) => {
	await page.route(/\/api\/instruments\/[^/]+\/versions/, async (route) => {
		await new Promise((done) => setTimeout(done, 1500));
		await route.fallback();
	});
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	const text = page.locator('.col--reader .article-text').first();
	await expect(text).toBeVisible();
	const before = (await text.boundingBox())!.y;
	await expect(page.getByText('Tekst geldend op')).toBeVisible();
	expect((await text.boundingBox())!.y).toBe(before);
});

// The card of a bron on the canvas keeps Lees and Toevoegen where they stood while its text comes
// in (live toets 27 Oct, B1: they dropped 62 px and a click missed).
test('the card of a bron keeps its actions in place while the text comes in', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone has the sheet, not the strip');
	let release!: () => void;
	const held = new Promise<void>((done) => (release = done));
	await page.route(/\/api\/articles\//, async (route) => {
		await held;
		await route.fallback();
	});
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	const list = page.locator('.canvas-node-list a');
	await expect(list.nth(1)).toBeAttached();
	const eerste = list.filter({ hasText: /^Art\./ }).nth(1);
	await eerste.focus();
	await page.keyboard.press('Enter');
	const card = page.locator('.strook--kaart.is-open');
	const lees = card.getByRole('link', { name: 'Lees', exact: true });
	const voeg = card.getByRole('button', { name: /^(Toevoegen|Weghalen)$/ });
	await expect(lees).toBeVisible();
	await expect(card.getByRole('status')).toBeVisible();
	const at = async () => ({
		lees: (await lees.boundingBox())!.y,
		voeg: (await voeg.boundingBox())!.y
	});
	const before = await at();
	release();
	await expect(card.getByRole('status')).toHaveCount(0);
	expect(await at()).toEqual(before);
});

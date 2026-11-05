// The keten stands as soon as its regulations are in; the wetten that only name the law
// (`related-instruments`) come later, cold up to 5 s, in the layer Noemt under all the rest (B109).
// What stands stays where it is: the layers, the law, the regulations. At 1440 and on a phone.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const WVW = '/explore?netwerk=instruments/bwbr0006622&weergave=keten';
const GRONDWET = '/explore?netwerk=instruments/bwbr0001840&weergave=keten';
const LATE = 2_000;

/** Where every layer heading, and on a wide screen every bron, stands (page coordinates). */
const standing = (page: Page) =>
	page.evaluate(() => {
		const at = (el: Element) => {
			const r = el.getBoundingClientRect();
			return [Math.round(r.x), Math.round(r.y + scrollY)];
		};
		const drawing = document.querySelector('svg.drawing');
		const shown = (el: Element) => (el as HTMLElement | SVGElement).getClientRects().length > 0;
		const heads = [
			...document.querySelectorAll('svg.drawing .layer-label, .list .list__head')
		].filter(shown);
		const nodes = drawing ? [...drawing.querySelectorAll('g.node')].filter(shown) : [];
		return Object.fromEntries([
			...heads.map((el) => [`kop ${el.textContent?.trim().toLowerCase()}`, at(el)]),
			...nodes.map((el) => [el.textContent?.trim(), at(el)])
		]) as Record<string, number[]>;
	});

for (const [name, url] of [
	['WVW', WVW],
	['Grondwet', GRONDWET]
] as const)
	test(`the ${name} keten stays put when the wetten that name it come late`, async ({
		page,
		touch
	}) => {
		if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
		let answered = false;
		await page.route(/\/related-instruments\b/, async (route) => {
			await new Promise((done) => setTimeout(done, LATE));
			await route.fallback();
			answered = true;
		});
		await page.goto(url);
		await expect(page.getByText('AMvB', { exact: false }).first()).toBeAttached();
		const amvb = touch
			? page.locator('.list__head', { hasText: 'AMvB' })
			: page.locator('svg.drawing .layer-label', { hasText: 'AMVB' });
		await expect(amvb).toBeVisible();
		await page.waitForTimeout(500);
		expect(answered, 'measured before the late answer').toBe(false);
		const before = await standing(page);
		const noemt = touch
			? page.locator('.list__head', { hasText: 'Noemt' })
			: page.locator('svg.drawing .layer-label', { hasText: 'NOEMT' });
		await expect(noemt).toBeVisible({ timeout: LATE + 5_000 });
		await page.waitForTimeout(250);
		const after = await standing(page);
		for (const [what, place] of Object.entries(before))
			expect(after[what], `${what} stays where it stood`).toEqual(place);
		// Noemt under all the rest.
		const heads = Object.entries(after).filter(([k]) => k.startsWith('kop '));
		const lowest = heads.reduce((a, b) => (a[1][1] > b[1][1] ? a : b));
		expect(lowest[0]).toBe('kop noemt');
	});

test('a law without a wet that names it has no heading Noemt', async ({ page }) => {
	await page.route(/\/related-instruments\b/, (route) =>
		route.fulfill({
			status: 200,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: JSON.stringify({ bwb_id: 'BWBR0006622', total: 0, items: [] })
		})
	);
	await page.goto(WVW);
	await expect(page.getByText('AMvB', { exact: false }).first()).toBeAttached();
	await page.waitForLoadState('networkidle');
	await expect(
		page.locator('.list__head, svg.drawing .layer-label').filter({ hasText: /^noemt$/i })
	).toHaveCount(0);
});

// The keten stands as soon as its regulations are in; the wetten that only name the law
// (`related-instruments`) come later, cold up to 5 s, in the layer Wet beside the law (B109): a
// layer is a kind, the dashed line is the relation. The layers stay as they are. At 1440 and on a phone.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { noemt } from '../support/noemt';

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

/** The bronnen of the layer Wet, drawn or listed. */
const wetten = (page: Page, touch: boolean) =>
	touch
		? page.locator('.list__layer[aria-label="Wet"] .list__row')
		: page.locator('g.node[data-layer="law"]');

for (const [name, url] of [
	['WVW', WVW],
	['Grondwet', GRONDWET]
] as const)
	test(`the ${name} keten stays put when the wetten that name it come late`, async ({
		page,
		touch
	}) => {
		if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
		// At least LATE, and until what stands is measured, however slow the machine.
		let measured = () => {};
		const held = new Promise<void>((done) => (measured = done));
		await page.route(/\/related-instruments\b/, async (route) => {
			await Promise.all([held, new Promise((done) => setTimeout(done, LATE))]);
			await route.fallback();
		});
		await page.goto(url);
		await expect(page.getByText('AMvB', { exact: false }).first()).toBeAttached();
		const amvb = touch
			? page.locator('.list__head', { hasText: 'AMvB' })
			: page.locator('svg.drawing .layer-label', { hasText: 'AMVB' });
		await expect(amvb).toBeVisible();
		await page.waitForTimeout(500);
		const before = await standing(page);
		const late = page.waitForResponse(/\/related-instruments\b/);
		measured();
		await late;
		await page.waitForTimeout(250);
		const after = await standing(page);
		// The layers, the law and the regulations stand where they stood (B109).
		for (const [what, place] of Object.entries(before))
			expect(after[what], `${what} stays where it stood`).toEqual(place);
		// A layer is a kind, never a relation.
		expect(Object.keys(after)).not.toContain('kop noemt');
	});

test('with Noemt off the wetten that only name the law are not drawn', async ({ page, touch }) => {
	if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto(WVW);
	await expect(page.getByText('AMvB', { exact: false }).first()).toBeAttached();
	await page.waitForLoadState('networkidle');
	const on = await wetten(page, touch).count();
	await noemt(page);
	await expect.poll(() => wetten(page, touch).count()).toBeLessThan(on);
	await noemt(page);
	await expect.poll(() => wetten(page, touch).count()).toBe(on);
});

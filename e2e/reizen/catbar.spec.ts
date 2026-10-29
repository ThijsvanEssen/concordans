// The tab strip of Bladeren (Kabinetten ... Fracties) pans sideways on a phone: the tab on show
// stands in view, clear of the fade on its edge; where all fits (1440) it does not pan at all.
import { expect, test } from '../support/test';

for (const kind of ['ministries', 'members', 'factions']) {
	test(`the tab on show is in view, clear of the fade (${kind})`, async ({ page }) => {
		await page.goto(`/explore?mode=index&kind=${kind}`);
		const bar = page.locator('nav.catbar');
		const on = bar.locator('.cat--on');
		await expect(on).toBeVisible();
		const fits = await bar.evaluate((el) => el.scrollWidth <= el.clientWidth + 1);
		if (fits) return;
		const box = await bar.boundingBox();
		const tab = await on.boundingBox();
		expect(tab!.x).toBeGreaterThanOrEqual(box!.x);
		expect(tab!.x + tab!.width).toBeLessThanOrEqual(box!.x + box!.width);
		// Where it hides more, the edge says so.
		const hidden = await bar.evaluate((el) => ({
			left: el.scrollLeft > 1,
			right: el.scrollLeft + el.clientWidth < el.scrollWidth - 1
		}));
		for (const [side, more] of [
			['left', hidden.left],
			['right', hidden.right]
		] as const) {
			if (more) await expect(bar).toHaveAttribute(`data-more-${side}`, '');
			else await expect(bar).not.toHaveAttribute(`data-more-${side}`);
		}
	});
}

test('a tab reached with the keyboard comes clear of the edge', async ({ page, isMobile }) => {
	test.skip(!isMobile, 'the strip only pans on a phone');
	await page.goto('/explore?mode=index&kind=ministries');
	const bar = page.locator('nav.catbar');
	const last = bar.locator('a.cat').last();
	await last.focus();
	await expect
		.poll(async () => {
			const b = await bar.boundingBox();
			const t = await last.boundingBox();
			return b!.x + b!.width - (t!.x + t!.width);
		})
		.toBeGreaterThanOrEqual(0);
});

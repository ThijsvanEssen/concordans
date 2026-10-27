// The werkplek with a netwerk stands from the first paint (UX-toets A294, B6): Weergave, Gekozen
// and Tonen keep their place while the chosen bronnen come in. The API answers a moment after the
// first look, as live; what comes late must not push what stands. At 1440 and on a phone.
import { expect, test } from '../support/test';

const NETWERK = '/explore?netwerk=instruments/bwbr0005289,instruments/bwbr0005537';

test('the werkplek with a netwerk comes in without a shift', async ({ page, touch }) => {
	if (!touch) await page.setViewportSize({ width: 1440, height: 900 });
	await page.route(/\/api\/(?!nodes\/)/, async (route) => {
		await new Promise((done) => setTimeout(done, 250));
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
	await page.goto(NETWERK);
	await expect(page.locator('.canvas-node-list')).toContainText('BW');
	await page.waitForLoadState('networkidle');
	await page.waitForTimeout(1000);
	const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
	expect(cls, 'layout shift of the load').toBeLessThanOrEqual(0.01);
});

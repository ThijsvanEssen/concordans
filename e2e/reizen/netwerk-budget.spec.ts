// The room of a netwerk of several wetten (B37): Cbb, Cbw and Sr, the last with thousands of
// neighbours, each keep their own articles in their hull; none is left a bare square.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const NETWERK =
	'/explore?mode=netwerk&netwerk=instruments/bwbr0052875,instruments/bwbr0052872,instruments/bwbr0001854';
const lijst = (page: Page) => page.locator('.canvas-node-list a');

test('three chosen wetten, one of them very large, each stand with their articles', async ({
	page
}) => {
	await page.goto(NETWERK);
	// Cbb's articles stand in its hull, as before it came last to the canvas and lost them.
	await expect(page.locator('.hull-label').filter({ hasText: /^Cbb$/ })).toBeVisible();
	await expect(
		lijst(page)
			.filter({ hasText: /^Artikel .* Cbb, Artikel$/ })
			.first()
	).toBeAttached();
	// Cbw and Sr: their articles as the group each stands in (a bare square has none).
	await expect(lijst(page).filter({ hasText: /^\d+ artikelen, groep$/ })).toHaveCount(2);
	for (const naam of ['Cbb, Wet', 'Cbw, Wet', 'Sr, Wet'])
		await expect(lijst(page).filter({ hasText: new RegExp(`^${naam}$`) })).toHaveCount(
			naam === 'Cbb, Wet' ? 0 : 1
		);
});

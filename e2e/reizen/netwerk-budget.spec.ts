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
	// Each wet's articles stand in a group of their own (Cbb was left a bare square when it came
	// first and the large Sr took the room).
	await expect(lijst(page).filter({ hasText: /^\d+ artikelen, groep$/ })).toHaveCount(3);
});

// Aantal stappen stays open for a large wet: Cbw at two steps is drawn with its most important
// bronnen, and the panel says in a line that this is not all of it.
test('Cbw at two steps is drawn, no step greyed out, and the panel says it is not complete', async ({
	page,
	touch
}) => {
	await page.goto('/explore?mode=netwerk&netwerk=instruments/bwbr0052872&diepte=2');
	if (touch) await page.getByRole('button', { name: 'Weergave', exact: true }).click();
	const stappen = page.getByRole('group', { name: 'Aantal stappen' });
	await expect(stappen.getByRole('button', { name: '2 stappen' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	for (const naam of ['1 stap', '2 stappen', '3 stappen'])
		await expect(stappen.getByRole('button', { name: naam })).toBeEnabled();
	await expect(
		page.getByRole('note').filter({ hasText: /^2 stappen: de belangrijkste 400/ })
	).toBeVisible();
	await expect(page.getByText(/Maximaal \d+ bronnen getoond/)).toHaveCount(0);
	await expect(lijst(page).filter({ hasText: /^\d+ artikelen, groep$/ })).toHaveCount(1);
});

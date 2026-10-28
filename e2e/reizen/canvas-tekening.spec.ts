// What the canvas draws and what a click on it chooses (A317, UX review A315): a name that
// would be cut by the rim of a hull waits for a hover; the name or the rim of a hull chooses its
// wet, its card in the strip at the right with the hull chosen; a cluster's card stands in that
// strip too, not beside the pointer.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

// Two wetten chosen: Boek 6 BW with its articles drawn as a hull, Gemw as a bron.
const NETWERK = '/wetten/BWBR0005416?mode=netwerk&netwerk=instruments/bwbr0005289';
const lijst = (page: Page) => page.locator('.canvas-node-list a');
const kaart = (page: Page) => page.locator('.strook--kaart');
// Its name stands short at rest, in full once chosen: the pill is found by the number.
const pil = (page: Page) => page.locator('.hull-label').filter({ hasText: /Boek 6/ });

test('the name of a wet’s hull chooses the wet: its card at the right, the hull in ink (B6)', async ({
	page,
	touch
}) => {
	await page.goto(NETWERK);
	await expect(pil(page)).toBeVisible();
	await expect(pil(page)).not.toHaveClass(/is-chosen/);
	const box = (await pil(page).boundingBox())!;
	const at = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
	if (touch) await page.touchscreen.tap(at.x, at.y);
	else await page.mouse.click(at.x, at.y);
	await expect(page).toHaveURL(/kies=instruments(%2F|\/)bwbr0005289/);
	await expect(kaart(page)).toHaveClass(/is-open/);
	await expect(kaart(page).getByText('Lees', { exact: true })).toBeVisible();
	await expect(pil(page)).toHaveClass(/is-chosen/);
	await expect(page.locator('.hull-overlay .hull.is-chosen')).toHaveCount(1);
});

test('the keyboard reaches the wet in the list: Enter chooses it', async ({ page, touch }) => {
	test.skip(touch, 'the keyboard list is the way without a pointer');
	await page.goto(NETWERK);
	const wet = lijst(page).filter({ hasText: /^Boek 6 BW, Wet$/ });
	await expect(wet).toHaveCount(1);
	await wet.focus();
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/kies=instruments/);
	await expect(kaart(page)).toHaveClass(/is-open/);
	await expect(pil(page)).toHaveClass(/is-chosen/);
});

test('the card of a cluster stands in the strip at the right, not over the canvas (B10)', async ({
	page,
	touch
}) => {
	test.skip(touch, 'the keyboard list is the way without a pointer');
	await page.goto('/uitspraken/ECLI:NL:HR:2009:BH2815?mode=netwerk');
	const groep = lijst(page).filter({ hasText: /^\d+ uitspraken, groep$/ });
	await expect(groep).toHaveCount(1);
	await groep.focus();
	await page.keyboard.press('Enter');
	const dialoog = page.getByRole('dialog', { name: /uitspraken$/ });
	await expect(dialoog).toBeVisible();
	await expect(kaart(page)).toHaveClass(/is-open/);
	await expect(kaart(page).getByRole('dialog')).toHaveCount(1);
	await expect(page.locator('.buhne .cluster-kaart')).toHaveCount(0);
});

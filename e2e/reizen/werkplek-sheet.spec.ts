// The werkplek on a phone gives the canvas the screen: the bronnen and the filters stand in a
// sheet behind the button "Weergave" (Design System, Netwerkkeuze). On a wide screen
// they stand in the strip, and the strip and the sheet are one set of blocks.
import { expect, test } from '../support/test';
import { isPhone } from '../support/navigation';

const URL = '/explore?netwerk=articles/bwbr0005289_162';

test('a phone: the canvas has the screen, the sheet opens and closes, the page stands still', async ({
	page
}) => {
	test.skip(!isPhone(page), 'a phone');
	await page.goto(URL);
	const knop = page.getByRole('button', { name: 'Weergave' });
	await expect(knop).toBeVisible();
	await expect(knop).toHaveAttribute('aria-expanded', 'false');
	await expect(page.getByRole('region', { name: 'Weergave' })).toBeHidden();
	// Not 221 of 812 px, as with the blocks above it: more than 70 % of the height under the bar.
	const canvas = await page.locator('.graph-canvas-wrap').boundingBox();
	expect(canvas!.height).toBeGreaterThan(450);

	await knop.click();
	const sheet = page.getByRole('dialog', { name: 'Weergave' });
	await expect(sheet).toBeVisible();
	await expect(knop).toHaveAttribute('aria-expanded', 'true');
	await expect(sheet.getByRole('button', { name: 'Sluiten' })).toBeFocused();
	await expect(sheet.getByRole('button', { name: 'Bron toevoegen' })).toBeVisible();
	expect(await page.evaluate(() => document.body.style.position)).toBe('fixed');
	const view = page.viewportSize()!;
	expect((await sheet.boundingBox())!.height).toBeLessThanOrEqual(view.height * 0.88);

	await page.keyboard.press('Escape');
	await expect(sheet).toHaveCount(0);
	await expect(knop).toBeFocused();
	expect(await page.evaluate(() => document.body.style.position)).toBe('');

	await knop.click();
	await sheet.getByRole('button', { name: 'Sluiten' }).click();
	await expect(sheet).toHaveCount(0);
});

test('a wide screen: no button, the strip stands at the left in two blocks, Bronnen and Weergave, with no key of Soort or Lijnen', async ({
	page
}) => {
	test.skip(isPhone(page), 'wider than a phone');
	await page.goto(URL);
	await expect(page.getByRole('button', { name: 'Weergave' })).toBeHidden();
	const strook = page.getByRole('complementary', { name: 'Bronnen en filters' });
	await expect(strook.getByRole('region', { name: 'Weergave' })).toBeVisible();
	await expect(strook.getByRole('heading', { name: 'Bronnen' })).toHaveCount(1);
	await expect(strook.getByRole('heading', { name: 'Weergave' })).toHaveCount(1);
	await expect(strook.getByRole('heading', { name: 'Soort' })).toHaveCount(0);
	await expect(strook.getByRole('heading', { name: 'Lijnen' })).toHaveCount(0);
	await expect(strook.getByRole('heading', { name: 'Tonen' })).toHaveCount(1);
});

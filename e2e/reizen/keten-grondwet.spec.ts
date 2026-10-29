// The keten of the Grondwet: Noemt is on from the start, a wet that only names the law in its
// text (Kieswet, Wet op de Raad van State) beside it in the layer Wet, with a dashed line; switched off, a
// regulation under a regulation that only names the law goes with it, and a missing basis_kind
// is no grondslag (the Proclamatie).
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

const GRONDWET = '/explore?netwerk=instruments/bwbr0001840&weergave=keten';
const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });

/** Noemt (Relatie: Aanhaling) switched, in the strip of a wide screen or the sheet of a phone. */
async function noemt(page: Page) {
	await openSheet(page);
	const toggle = strip(page).getByRole('button', { name: 'Filter', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await strip(page)
		.getByRole('region', { name: 'Filters' })
		.getByRole('button', { name: /^Aanhaling/ })
		.click();
	if (await page.getByRole('dialog', { name: 'Weergave' }).isVisible())
		await page.keyboard.press('Escape');
}

/** The text the keten holds: the drawing on a wide screen, the list on a phone. */
const ketenText = async (page: Page) =>
	(await page.locator('main').innerText()).replace(/\s+/g, ' ');

test('without Noemt the Grondwet keten holds no regulation that hangs only under a mention', async ({
	page
}) => {
	await page.goto(GRONDWET);
	await expect(page.getByText('Koninklijk besluit', { exact: true }).first()).toBeAttached();
	await noemt(page);
	await expect(page.getByText('Kieswet')).toHaveCount(0);
	const text = await ketenText(page);
	expect(text).not.toContain('Defensieregeling');
	expect(text).not.toContain('Proclamatie houdende');
	expect(text).not.toContain('Kieswet');
});

test('Noemt, on from the start, draws the wetten that only name the Grondwet in their text, with their dashed line', async ({
	page
}) => {
	await page.goto(GRONDWET);
	await expect(page.getByText('Koninklijk besluit', { exact: true }).first()).toBeAttached();
	// on from the start
	await expect(page.getByText('Kieswet').first()).toBeAttached();
	await expect(page.getByText('Wet op de Raad van State').first()).toBeAttached();
	// Its lines are dashed (a mention), on the drawing.
	if (await page.locator('svg.drawing').isVisible())
		expect(await page.locator('svg.drawing path.line[stroke-dasharray]').count()).toBeGreaterThan(
			0
		);
});

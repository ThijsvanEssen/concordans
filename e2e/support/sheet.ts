// The werkplek on a phone: the bronnen and the filters stand in a sheet behind the button
// "Weergave" at the foot of the canvas. Wider they stand in the strip at the left.
import { expect, type Page } from '@playwright/test';

/** Opens the sheet where the page has one (a phone), and waits for the strip where it does not. */
export async function openSheet(page: Page) {
	const knop = page.getByRole('button', { name: 'Weergave' });
	const strook = page.getByRole('complementary', { name: 'Bronnen en filters' });
	await expect(knop.or(strook).first()).toBeVisible({ timeout: 30_000 });
	if ((await knop.isVisible()) && (await knop.getAttribute('aria-expanded')) !== 'true') {
		await knop.click();
		await expect(page.getByRole('dialog', { name: 'Weergave' })).toBeVisible();
	}
}

/** Closes the sheet again, the canvas whole: for what is done there next. */
export async function closeSheet(page: Page) {
	const sheet = page.getByRole('dialog', { name: 'Weergave' });
	if (!(await sheet.isVisible())) return;
	await sheet.getByRole('button', { name: 'Sluiten' }).click();
	await expect(sheet).toHaveCount(0);
}

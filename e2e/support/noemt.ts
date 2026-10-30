// Noemt (Relatie: Noemt) of the keten switched, in the strip of a wide screen or the sheet of
// a phone. On from the start: a click turns it off.
import type { Page } from '@playwright/test';
import { openSheet } from './sheet';

const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });

export async function noemt(page: Page) {
	await openSheet(page);
	const toggle = strip(page).getByRole('button', { name: 'Filter', exact: true });
	if (await toggle.isVisible()) await toggle.click();
	await strip(page)
		.getByRole('region', { name: 'Filters' })
		.getByRole('button', { name: /^Noemt/ })
		.click();
	if (await page.getByRole('dialog', { name: 'Weergave' }).isVisible())
		await page.keyboard.press('Escape');
}

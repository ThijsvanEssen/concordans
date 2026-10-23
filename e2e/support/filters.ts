// The bar of filters of a list page (FilterBar, besluit 40): on a wide screen a button per
// dimension that opens a menu, on a phone Verfijnen that opens a sheet of folds.
import type { Locator, Page } from '@playwright/test';

const named = (label: string) => new RegExp(`^${label}(:|$)`);

/**
 * Opens what holds the filter `group` under the button `button` (its own, or Meer): its menu,
 * or on a phone the sheet with its fold open. The options in it, by their name.
 */
export async function openFilter(
	page: Page,
	touch: boolean,
	group: string,
	button = group
): Promise<(name: string | RegExp) => Locator> {
	if (!touch) {
		await page
			.locator('.filterbar .wide')
			.getByRole('button', { name: named(button) })
			.click();
		const menu = page.getByRole('menu');
		const fold = menu.getByRole('button', { name: group, exact: true });
		if ((await fold.count()) && (await fold.getAttribute('aria-expanded')) === 'false')
			await fold.click();
		return (name) => menu.getByRole('menuitemcheckbox', { name });
	}
	await page.getByRole('button', { name: /^Verfijnen/ }).click();
	const sheet = page.getByRole('dialog', { name: 'Verfijnen' });
	const fold = sheet.getByRole('button', { name: button, exact: true });
	if ((await fold.getAttribute('aria-expanded')) === 'false') await fold.click();
	return (name) => sheet.locator('.fold-body').getByRole('button', { name });
}

/** The chip of a filter chosen, by the count of the list: a click takes it off. */
export const chip = (page: Page, label: string | RegExp) =>
	page.locator('.filterbar .head').getByRole('button', {
		name: typeof label === 'string' ? `${label} wissen` : label
	});

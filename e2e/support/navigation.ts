// The top navigation as a reader uses it: on a wide screen the links of the bar and the menu
// Mijn, on a phone the tab bar with its two sheets (besluit 36).
import type { Page } from '@playwright/test';

/** The page is a phone's width: the tab bar, not the links of the bar. */
export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 768;

/** Goes to a kind of source (Wetten, Uitspraken, Kamerstukken, Parlement, Regering). */
export async function goToSource(page: Page, label: string) {
	if (isPhone(page)) {
		await page
			.getByRole('navigation', { name: 'Hoofdmenu' })
			.getByRole('button', { name: 'Bladeren' })
			.click();
		await page
			.getByRole('dialog', { name: 'Bladeren op soort bron' })
			.getByRole('link', { name: new RegExp(`^${label}`) })
			.click();
	} else
		await page
			.getByRole('navigation', { name: 'Hoofdnavigatie' })
			.getByRole('link', { name: label, exact: true })
			.click();
}

/** Goes to an item of Mijn (Bundels, Gevolgd). */
export async function goToMine(page: Page, label: string) {
	if (isPhone(page)) {
		await page
			.getByRole('navigation', { name: 'Hoofdmenu' })
			.getByRole('button', { name: /^Mijn/ })
			.click();
		await page
			.getByRole('dialog', { name: 'Mijn' })
			.getByRole('link', { name: new RegExp(`^${label}`) })
			.click();
	} else {
		await page.getByRole('button', { name: /^Mijn/ }).click();
		await page.getByRole('menuitem', { name: new RegExp(`^${label}`) }).click();
	}
}

/** What carries the sign of something new at Mijn: the button of the menu, or the tab. */
export const mineSign = (page: Page) =>
	isPhone(page)
		? page.getByRole('navigation', { name: 'Hoofdmenu' }).getByRole('button', { name: /^Mijn/ })
		: page.getByRole('button', { name: /^Mijn/ });

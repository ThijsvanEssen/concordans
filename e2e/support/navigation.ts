// The top navigation as a reader uses it: on a wide screen the links of the bar and the menu
// Mijn, on a phone the tab bar with its two sheets (besluit 36).
import type { Page } from '@playwright/test';

/** The page is a phone's width: the tab bar, not the links of the bar. */
export const isPhone = (page: Page) => (page.viewportSize()?.width ?? 1440) <= 768;

/** Goes to a kind of source (Wetten, Rechtspraak, Kamerstukken, Parlement, Regering). */
export async function goToSource(page: Page, label: string) {
	if (isPhone(page)) {
		await page
			.getByRole('navigation', { name: 'Hoofdmenu' })
			.getByRole('button', { name: 'Bronnen' })
			.click();
		await page
			.getByRole('dialog', { name: 'Bronnen' })
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

/** On a phone Verbonden is a tab of its own (A197-a): choose it; wider, it stands beside the
 *  text and nothing is to be done. */
export async function naarVerbonden(page: Page) {
	if (isPhone(page)) await page.getByRole('tab', { name: 'Verbonden' }).click();
}

/** Back to the text, on a phone its tab. */
export async function naarTekst(page: Page) {
	if (isPhone(page)) await page.getByRole('tab', { name: 'Tekst' }).click();
}

/** The Netwerk button: in the top bar on a wide screen, a tab of the tab bar on a phone. */
export const netwerkKnop = (page: Page) =>
	isPhone(page)
		? page.getByRole('navigation', { name: 'Hoofdmenu' }).getByRole('button', { name: /^Netwerk/ })
		: page.getByRole('banner').getByRole('button', { name: /^Netwerk/ });

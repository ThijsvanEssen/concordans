import type { Page } from '@playwright/test';

/**
 * A link to a bron opens it in Netwerk (docs/routes.md, Links to a bron): at 1440 the text
 * stands beside the network, at 375 the panes take turns and Netwerk comes first. This shows
 * the text on either.
 */
export async function showText(page: Page, touch: boolean) {
	if (touch)
		await page
			.getByRole('navigation', { name: 'Panelen' })
			.getByRole('button', { name: 'Tekst' })
			.click();
}

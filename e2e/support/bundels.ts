// Filling the bundels the way a reader does: from the readers, with Bewaar and the menu of a
// lid or a rechtsoverweging. The bundels live in the browser (localStorage), so each test
// starts empty.
import type { BrowserContext, Page } from '@playwright/test';
import { expect } from './test';

export const ARTICLE = '/wetten/BWBR0005289/artikel/6:162?lezen=1';
export const JUDGMENT = '/uitspraken/ECLI:NL:HR:2019:2006?lezen=1';

/** Bewaar on the article 6:162 BW: into Losse markeringen. */
export async function keepArticle(page: Page) {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Bewaar', exact: true }).click();
	await expect(page.getByRole('button', { name: 'Bewaard', exact: true })).toBeVisible();
}

/** Lid 2 of 6:162 BW and r.o. 5.3.2 of Urgenda, each through its own menu. */
export async function keepPlaces(page: Page) {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'art. 6:162 lid 2 BW: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' }).click();
	await page.goto(JUDGMENT);
	await page.getByRole('button', { name: 'Overweging 5.3.2: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' }).click();
}

/** What the page puts on the clipboard, read back by the test (headless has no clipboard). */
export async function catchClipboard(context: BrowserContext) {
	await context.addInitScript(() => {
		const copied: string[] = [];
		Object.defineProperty(window, '__copied', { value: copied });
		Object.defineProperty(navigator, 'clipboard', {
			value: { writeText: async (text: string) => void copied.push(text) }
		});
	});
	return (page: Page) =>
		page.evaluate(() => (window as unknown as { __copied: string[] }).__copied.at(-1));
}

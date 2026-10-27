// A busy canvas reads (UX review N4, N5, N8): a ministerie stands on its canvas as the hull
// of its bewindspersonen, every wet drawn as its anchor alone carries its name, and the
// keyboard's list of the canvas names each bron its own (eight judgments of one court on one
// day by their ECLI), the uitspraken that cite HR BH2815 folded as one.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const lijst = (page: Page) => page.locator('.canvas-node-list a');
const hullNames = (page: Page) => page.locator('.hull-label');

test('a ministerie in focus stands on its canvas, its name on its hull (N5)', async ({ page }) => {
	await page.goto('/ministeries/bzk?mode=netwerk');
	await expect(lijst(page).first()).toHaveText(
		'Binnenlandse Zaken en Koninkrijksrelaties, Ministerie'
	);
	await expect(hullNames(page).filter({ hasText: /^BZK$/ })).toHaveCount(1);
	// A toezegging by what was promised, never by its number alone.
	await expect(
		lijst(page)
			.filter({ hasText: /, Toezegging$/ })
			.first()
	).toBeAttached();
	await expect(lijst(page).filter({ hasText: /^Toezegging TZ/ })).toHaveCount(0);
});

test('every wet drawn as its anchor alone carries its name (N8)', async ({ page }) => {
	await page.goto('/wetten/BWBR0005416?mode=netwerk&netwerk=instruments/bwbr0005289');
	await expect(lijst(page).filter({ hasText: /, Wet$/ })).toHaveCount(2);
	for (const naam of ['Gemw', 'Boek 6 BW'])
		await expect(hullNames(page).filter({ hasText: new RegExp(`^${naam}$`) })).toHaveCount(1);
	await expect(hullNames(page).filter({ hasText: /^\s*$/ })).toHaveCount(0);
});

test('each bron of the canvas has a name of its own, the uitspraken folded (N4)', async ({
	page
}) => {
	await page.goto('/uitspraken/ECLI:NL:HR:2009:BH2815?mode=netwerk');
	await expect(lijst(page).filter({ hasText: /^\d+ uitspraken, groep$/ })).toHaveCount(1);
	const namen = await lijst(page).allTextContents();
	expect(namen.length).toBeGreaterThan(1);
	expect(new Set(namen).size).toBe(namen.length);
});

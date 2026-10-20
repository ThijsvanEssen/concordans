// Visual snapshots of a handful of fixed pages, at both widths: what the asserts cannot see
// (a margin, a type size, an overlap). The baseline is made on Linux, as CI runs it
// (`npm run e2e:update`, in the Playwright image); elsewhere these are skipped, since fonts
// render differently per system. The network canvas is left out: WebGL is not pixel-stable.
import { keepArticle, keepPlaces } from './support/bundels';
import { expect, test } from './support/test';

test.skip(process.platform !== 'linux', 'the baseline is made on Linux (npm run e2e:update)');

const PAGES = {
	artikel: '/wetten/BWBR0005289/artikel/6:162?lezen=1',
	uitspraak: '/uitspraken/ECLI:NL:HR:2019:2006?lezen=1',
	kamerstuk: '/kamerstukken/36799/31?lezen=1',
	bronnen: '/explore?mode=index',
	methode: '/docs/methode'
};

for (const [name, url] of Object.entries(PAGES))
	test(`${name} looks as before`, async ({ page }) => {
		await page.goto(url);
		await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
		await page.waitForLoadState('networkidle');
		await page.evaluate(() => document.fonts.ready);
		await expect(page).toHaveScreenshot(`${name}.png`);
	});

test('a bundel looks as before', async ({ page }) => {
	await keepArticle(page);
	await keepPlaces(page);
	await page.goto('/bundels/losse-markeringen');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.evaluate(() => document.fonts.ready);
	// The day a row changed is today's: the clock of the suite keeps it fixed.
	await expect(page).toHaveScreenshot('bundel.png');
});

// The Zijpaneel from Verbonden (B224): "Lees verder" on an open uitspraak opens the judgment
// beside the article. On a phone Verbonden is a tab of its own and hides the text, so the
// panel opened there had no height; it now stands in the text's tab, seen, with its × clear
// of the screen's edge.
import { expect, test } from '../support/test';
import { ARTICLE } from '../support/bundels';
import { naarVerbonden } from '../support/navigation';

test('Lees verder in Verbonden opens the Zijpaneel in view', async ({ page }, info) => {
	await page.goto(ARTICLE);
	await naarVerbonden(page);
	const titel = page
		.locator('section.kind[data-kind="judgments"] a.kind__title[aria-expanded]')
		.first();
	await titel.scrollIntoViewIfNeeded();
	await page.waitForLoadState('networkidle');
	await titel.click();
	await page.getByRole('link', { name: 'Lees verder' }).click();
	await expect(page).toHaveURL(/naast=judgments\//);
	const naast = page.locator('.reader__beside');
	await expect(naast).toBeVisible();
	expect((await naast.boundingBox())!.height).toBeGreaterThan(100);
	await expect(naast.getByRole('heading', { level: 1 })).toBeVisible();
	await page.screenshot({ path: `test-results/b224-${info.project.name}.png` });
	const sluit = await naast.getByRole('button', { name: 'Sluiten' }).boundingBox();
	const breedte = page.viewportSize()!.width;
	expect(sluit!.x + sluit!.width).toBeLessThanOrEqual(breedte - 8);
});

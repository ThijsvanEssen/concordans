// The old address of an office without a ministry (the sitemap named it with a "-") moves to the new.
import { expect, test } from '../support/test';

test('/ambten/-/… moves to /ambten/…', async ({ page }) => {
	await page.goto('/ambten/-/minister/werk-en-participatie');
	await expect(page).toHaveURL(/\/ambten\/minister\/werk-en-participatie$/);
	await expect(page.locator('h1').first()).toBeVisible();
});

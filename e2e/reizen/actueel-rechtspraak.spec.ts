// Actueel: the lower courts of a day are one line, which opens to a heading per rechtsgebied
// with its first judgments, fetched when the heading opens.
import { expect, test } from '../support/test';

test('Actueel: the lower courts of a day open to headings per rechtsgebied', async ({ page }) => {
	await page.goto('/actueel');
	const row = page.getByRole('button', { name: /^Inhoud van \d[\d.]* uitspraken/ }).first();
	await expect(row).toBeVisible();
	await expect(row).toHaveAttribute('aria-expanded', 'false');
	// The button lies under the line's text: a click lands on the text, as a reader's does.
	const line = row.locator('xpath=following-sibling::*[contains(@class, "zin")]');
	await row.evaluate((e) => e.scrollIntoView({ block: 'center' }));

	// Asked when the line opens, not before.
	const asked = page.waitForRequest((r) => /subject_area=/.test(r.url()));
	await line.click();
	await expect(row).toHaveAttribute('aria-expanded', 'true');
	await asked;
	await expect(page).toHaveURL(/open=rechtspraak\/\d{4}-\d{2}-\d{2}/);

	const groups = page.locator('section', { has: page.getByRole('button', { expanded: true }) });
	const first = groups.getByRole('button', { expanded: true }).first();
	await expect(first).toBeVisible();
	await expect(page.locator('ul li a[href*="/uitspraken/"]').first()).toBeVisible();

	// A heading beyond the first ones opens on its own click.
	const third = page.getByRole('button', { name: /^Strafrecht/ }).first();
	await expect(third).toHaveAttribute('aria-expanded', 'false');
	await third.click();
	await expect(third).toHaveAttribute('aria-expanded', 'true');

	// "Alle N" lists the rest in place and "Minder" folds it again.
	const all = page.getByRole('button', { name: /^Alle [\d.]+ uitspraken$/ }).first();
	if (await all.count()) {
		await all.click();
		await expect(page.getByRole('button', { name: 'Minder' }).first()).toBeVisible();
	}

	await line.click();
	await expect(row).toHaveAttribute('aria-expanded', 'false');
});

// The amendments of a dossier: the timetable is there when the page loads with the section
// already open (the reader's kept choice), and on a phone it fits the column, the outcome
// in view, without a sideways scroll (UX-toets W3, B228).
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const regeling = (page: Page) =>
	page.locator('section').filter({ has: page.getByRole('heading', { name: /^Amendementen/ }) });

test('a dossier whose Amendementen stand open on load shows its first amendment', async ({
	page
}) => {
	await page.addInitScript(() =>
		localStorage.setItem('concordans:kopjes', JSON.stringify({ amendementen: true }))
	);
	await page.goto('/dossiers/36496');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wet betaalbare huur');
	const sectie = regeling(page);
	await expect(sectie.getByRole('button', { name: /^Amendementen/ })).toHaveAttribute(
		'aria-expanded',
		'true'
	);
	await expect(sectie.getByText('Amendementen laden…')).toHaveCount(0, { timeout: 10_000 });
	await expect(sectie.locator('tbody tr').first()).toBeAttached();
});

test('on a phone the amendments fit the column, the outcome in view', async ({ page }) => {
	test.skip((page.viewportSize()?.width ?? 1440) > 640, 'the timetable is for the wide column');
	await page.goto('/dossiers/36496');
	const sectie = regeling(page);
	await sectie.scrollIntoViewIfNeeded();
	const rij = sectie.locator('tbody tr').first();
	await expect(rij).toBeVisible();
	const rol = sectie.locator('.rol');
	expect(await rol.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
	expect(
		await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
	).toBeLessThanOrEqual(0);
	// The outcome stands in the card, inside the screen.
	const uitslag = rij.locator('td.eind');
	const box = await uitslag.boundingBox();
	expect(box && box.x >= 0 && box.x + box.width <= 375).toBe(true);
});

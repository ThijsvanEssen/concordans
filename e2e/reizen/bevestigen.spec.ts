// The one ritual of Bewaar, Volg and Kopieer (decision 33): the button changes, a status line
// says where it went with a link there, the navigation shows a sign until the reader has been
// there, a kept lid is marked in the text, and a screen reader hears the line (role status).
import { expect, test } from '../support/test';
import { ARTICLE, catchClipboard } from '../support/bundels';

test('Bewaar says where it went, marks Bundels until visited, and marks the lid', async ({
	page
}) => {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Bewaar', exact: true }).click();

	const status = page.getByRole('status');
	await expect(status).toContainText('Bewaard in Losse markeringen');
	await expect(status.getByRole('link', { name: 'Losse markeringen' })).toHaveAttribute(
		'href',
		'/bundels/losse-markeringen'
	);
	await expect(page.getByRole('button', { name: 'Bewaard', exact: true })).toBeVisible();
	// The sign: at Bundels, or on the menu button where the navigation is folded.
	const folded = (page.viewportSize()?.width ?? 1440) <= 768;
	const nav = folded ? '.mobile-menu-btn' : 'nav a[href="/bundels"]';
	await expect(page.locator(`${nav} [aria-label="nieuw"]`)).toHaveCount(1);
	// Gone after two seconds.
	await expect(status).toHaveText('', { timeout: 4000 });

	if (folded) {
		await page.getByRole('button', { name: 'Menu' }).click();
		await expect(page.locator('.mobile-nav a[href="/bundels"] [aria-label="nieuw"]')).toHaveCount(
			1
		);
		await page.locator('.mobile-nav a[href="/bundels"]').click();
	} else await page.locator('nav a[href="/bundels"]').click();
	await expect(page).toHaveURL(/\/bundels$/);
	await expect(page.locator('[aria-label="nieuw"]')).toHaveCount(0);
});

test('a kept lid carries the bar in the text', async ({ page }) => {
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'art. 6:162 lid 2 BW: citeren, bewaren' }).click();
	await page.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' }).click();
	await expect(page.getByRole('status')).toContainText('Bewaard in Losse markeringen');
	await expect(page.locator('.plaats-bewaard')).toHaveCount(1);
});

test('Kopieer is heard by a screen reader, without a line drawn', async ({ page, context }) => {
	const copied = await catchClipboard(context);
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Citeer', exact: true }).click();
	await page.getByRole('menuitem').first().click();
	await expect(page.getByRole('status')).toHaveText('Gekopieerd');
	expect(await copied(page)).toBeTruthy();
});

test('Volg a dossier says where it went and marks Gevolgd', async ({ page }) => {
	await page.goto('/dossiers/36496');
	await page.getByRole('button', { name: 'Volg', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Bewaar bij Gevolgd' }).click();
	const status = page.getByRole('status');
	await expect(status).toContainText('Bewaard bij Gevolgd');
	await expect(status.getByRole('link', { name: 'Gevolgd' })).toHaveAttribute(
		'href',
		'/onderwerpen'
	);
	await expect(
		page
			.locator('nav a[href="/onderwerpen"], .mobile-menu-btn')
			.locator('[aria-label="nieuw"]')
			.first()
	).toBeAttached();
});

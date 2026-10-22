// The one ritual of Bewaar, Volg and Kopieer (decision 33): the button changes, a status line
// says where it went with a link there, the navigation shows a sign until the reader has been
// there, a kept lid is marked in the text, and a screen reader hears the line (role status).
import { mineSign } from '../support/navigation';
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
	// The sign: at Mijn, on its button in the bar or on the tab of a phone, and at Bundels in it.
	await expect(mineSign(page).locator('[aria-label="nieuw"]')).toHaveCount(1);
	// Gone after two seconds.
	await expect(status).toHaveText('', { timeout: 4000 });

	await mineSign(page).click();
	const bundels = page
		.getByRole('menuitem', { name: /^Bundels/ })
		.or(page.getByRole('link', { name: /^Bundels/ }));
	await expect(bundels.locator('[aria-label="nieuw"]')).toHaveCount(1);
	await bundels.click();
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

test('Kopieer says what it copied in the status line, seen and heard', async ({
	page,
	context
}) => {
	const copied = await catchClipboard(context);
	await page.goto(ARTICLE);
	await page.getByRole('button', { name: 'Citeer', exact: true }).click();
	await page.getByRole('menuitem').first().click();
	const status = page.getByRole('status');
	await expect(status).toHaveText('Gekopieerd: art. 6:162 BW');
	// Drawn, not only read: a line a reader sees, over no part of the table of contents.
	await expect(status).toBeVisible();
	const box = (await status.boundingBox())!;
	const kolom = await page.locator('.nav-kolom').first().boundingBox();
	if (kolom) expect(box.x).toBeGreaterThanOrEqual(kolom.x + kolom.width);
	expect(await copied(page)).toBeTruthy();
	await expect(status).toHaveText('', { timeout: 4000 });
});

test('Citeer with the date says the day the page says (T5)', async ({ page }) => {
	await page.goto(ARTICLE);
	const dag = await page.getByRole('button', { name: /^Tekst geldend op/ }).textContent();
	await page.getByRole('button', { name: 'Citeer', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: /tekst geldend op/ })).toContainText(
		dag!.replace(/^Tekst geldend op\s*/, '').trim()
	);
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
	await expect(mineSign(page).locator('[aria-label="nieuw"]')).toHaveCount(1);
});

test('Volg a dossier then stays one button, Gevolgd, and never flips back', async ({ page }) => {
	await page.goto('/dossiers/36496');
	await page.getByRole('button', { name: 'Volg', exact: true }).click();
	await page.getByRole('menuitem', { name: 'Bewaar bij Gevolgd' }).click();
	const kop = page.locator('.kop-acties');
	await expect(kop.getByRole('button', { name: 'Gevolgd', exact: true })).toBeVisible();
	// Over the next seconds: the one button, never a second one, never Volg again.
	for (let i = 0; i < 12; i++) {
		await page.waitForTimeout(150);
		await expect(kop.getByRole('button', { name: 'Volg', exact: true })).toHaveCount(0);
		await expect(kop.getByRole('button', { name: 'Gevolgd', exact: true })).toHaveCount(1);
	}
	await kop.getByRole('button', { name: 'Gevolgd', exact: true }).click();
	await expect(page.getByRole('menuitem', { name: 'Open Gevolgd' })).toHaveAttribute(
		'href',
		'/onderwerpen'
	);
});

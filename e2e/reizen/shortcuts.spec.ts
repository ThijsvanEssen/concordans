// One-key shortcuts (research 29 Oct): L, 1, 2, J and K do nothing while a Blad is open or the
// focus is in a field or a list box, J and K also go through Verbonden's overview, and after L
// the focus is on something, not on the body.
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

const NETWERK = '/wetten/BWBR0005289/artikel/6:162?mode=netwerk';
const LEZER = '/wetten/BWBR0005289/artikel/6:162';

test('L with a Blad open leaves the Blad standing', async ({ page }) => {
	await page.goto(NETWERK);
	await openSheet(page);
	const open = page.getByRole('region', { name: 'Netwerk' }).getByRole('button', {
		name: 'Bron toevoegen'
	});
	await open.click();
	const dialog = page.getByRole('dialog', { name: 'Bron toevoegen' });
	await expect(dialog).toBeVisible();
	// Off the field, onto the Blad itself: the focus is not in a field now.
	await dialog.getByRole('button', { name: 'Sluiten' }).focus();
	const url = page.url();
	await page.keyboard.press('l');
	await page.keyboard.press('1');
	await page.keyboard.press('j');
	await expect(dialog).toBeVisible();
	expect(page.url()).toBe(url);
});

test('L in a select does nothing', async ({ page }) => {
	await page.goto(NETWERK);
	await expect(page.getByRole('application', { name: /^Netwerk\./ })).toBeVisible();
	await page.evaluate(() => {
		const s = document.createElement('select');
		s.setAttribute('aria-label', 'Keuze');
		s.innerHTML = '<option>lang</option><option>kort</option>';
		document.body.append(s);
		s.focus();
	});
	const url = page.url();
	await page.keyboard.press('l');
	await expect(page.getByRole('combobox', { name: 'Keuze' })).toBeFocused();
	expect(page.url()).toBe(url);
});

test('J and K go through the overview of Verbonden', async ({ page, isMobile }) => {
	test.skip(isMobile, 'on a phone Verbonden is a tab of its own');
	await page.goto(LEZER);
	const titels = page.locator('.verbonden a.kind__title');
	await expect(titels.first()).toBeVisible({ timeout: 30_000 });
	await page.locator('body').click({ position: { x: 1, y: 1 } });
	await page.keyboard.press('j');
	await expect(titels.first()).toBeFocused();
	if ((await titels.count()) > 1) {
		await page.keyboard.press('j');
		await expect(titels.nth(1)).toBeFocused();
		await page.keyboard.press('k');
		await expect(titels.first()).toBeFocused();
	}
});

test('after L the focus is on something visible', async ({ page }) => {
	await page.goto(NETWERK);
	const canvas = page.getByRole('application', { name: /^Netwerk\./ });
	await canvas.focus();
	await page.keyboard.press('l');
	await expect(page).not.toHaveURL(/mode=netwerk/);
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY'))
		.not.toBe('BODY');
	await page.keyboard.press('l');
	await expect(page).toHaveURL(/mode=netwerk|mode=graph/);
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY'))
		.not.toBe('BODY');
});

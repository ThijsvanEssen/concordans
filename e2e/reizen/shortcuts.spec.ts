// Shortcuts (research 29 Oct): Alt L, Alt J and Alt K do nothing while a Blad is
// open (the plain L in a field or a list box is only a letter), J and K also go through Verbonden's overview, and after L
// the focus is on something, not on the body.
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

const NETWORK = '/wetten/BWBR0005289/artikel/6:162?mode=netwerk';
const READER = '/wetten/BWBR0005289/artikel/6:162';

test('L with a Blad open leaves the Blad standing', async ({ page }) => {
	await page.goto(NETWORK);
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
	await page.keyboard.press('Alt+KeyL');
	await page.keyboard.press('Alt+KeyJ');
	await expect(dialog).toBeVisible();
	expect(page.url()).toBe(url);
});

test('L in a select does nothing', async ({ page }) => {
	await page.goto(NETWORK);
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
	await page.goto(READER);
	const titles = page.locator('.verbonden a.kind__title');
	await expect(titles.first()).toBeVisible({ timeout: 30_000 });
	// J and K with the focus in the list (Alt K is Keten since 30 Oct).
	await titles.first().focus();
	if ((await titles.count()) > 1) {
		await page.keyboard.press('j');
		await expect(titles.nth(1)).toBeFocused();
		await page.keyboard.press('k');
		await expect(titles.first()).toBeFocused();
	}
});

test('after L the focus is on something visible', async ({ page }) => {
	await page.goto(NETWORK);
	const canvas = page.getByRole('application', { name: /^Netwerk\./ });
	await canvas.focus();
	await page.keyboard.press('Alt+KeyL');
	await expect(page).not.toHaveURL(/mode=netwerk/);
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY'))
		.not.toBe('BODY');
	await page.keyboard.press('Alt+KeyL');
	await expect(page).toHaveURL(/mode=netwerk/);
	await expect
		.poll(() => page.evaluate(() => document.activeElement?.tagName ?? 'BODY'))
		.not.toBe('BODY');
});

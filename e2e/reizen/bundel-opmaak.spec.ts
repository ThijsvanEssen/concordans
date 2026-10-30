// The opmaak of a note in a bundel (B62): typed with its signs in sight, a verwijzing
// recognized under the field, kept with ⌘↵; read as kop, list and link; left as it was with
// Escape; read the same, without a field, from a shared link. On a phone the row of buttons
// takes the place of the keys.
import { expect, test } from '../support/test';
import { catchClipboard, keepArticle } from '../support/bundels';

const BUNDEL = '/bundels/losse-markeringen';
const FIELD = { name: 'Aantekening bij Mijn markeringen' };

test('a note is typed with its signs and read in its opmaak', async ({ page, touch }) => {
	await keepArticle(page);
	await page.goto(BUNDEL);
	const field = page.getByRole('textbox', FIELD);
	await field.click();
	await page.keyboard.type('# Onderzoeksvraag');
	await page.keyboard.press('Enter');
	await page.keyboard.type('Is **gevaarzetting** onrechtmatig op grond van art. 6:162 BW?');
	await page.keyboard.press('Enter');
	await page.keyboard.type('1. Welke factoren weegt ECLI:NL:HR:1965:AB7079?');
	// Enter in a list goes on with the next point.
	await page.keyboard.press('Enter');
	await page.keyboard.type('Wat bij een wegbeheerder?');
	await expect(field).toHaveValue(/\n2\. Wat bij een wegbeheerder\?$/);

	// The signs stay in sight, dimmed; what is recognized is named under the field.
	await expect(page.locator('.mirror .sign').first()).toHaveText('# ');
	await expect(page.getByText('Herkend: artikel 6:162 BW, ECLI:NL:HR:1965:AB7079')).toBeVisible();
	if (touch) {
		await expect(page.getByRole('toolbar', { name: 'Opmaak' })).toBeVisible();
		await page.getByRole('button', { name: 'Bewaren' }).tap();
	} else {
		await expect(page.locator('.keys')).toBeVisible();
		await page.keyboard.press('ControlOrMeta+Enter');
	}

	await expect(field).toBeHidden();
	await expect(page.getByRole('heading', { name: 'Onderzoeksvraag', level: 3 })).toBeVisible();
	await expect(page.getByText('gevaarzetting', { exact: true })).toHaveJSProperty(
		'tagName',
		'STRONG'
	);
	await expect(page.locator('a.ref', { hasText: 'art. 6:162 BW' })).toHaveAttribute(
		'href',
		'/wetten/BWBR0005289/artikel/6:162'
	);
	await expect(page.getByRole('listitem').filter({ hasText: 'wegbeheerder' })).toBeVisible();

	// Kept in this browser: a reload reads it the same.
	await page.reload();
	await expect(page.getByRole('heading', { name: 'Onderzoeksvraag', level: 3 })).toBeVisible();
});

test('Escape leaves a note as it was', async ({ page }) => {
	await keepArticle(page);
	await page.goto(BUNDEL);
	await page.getByRole('textbox', FIELD).fill('Eerste vraag');
	await page.getByRole('textbox', FIELD).blur();
	await page.getByRole('button', { name: 'Mijn markeringen wijzigen' }).click();
	const field = page.getByRole('textbox', FIELD);
	await expect(field).toBeFocused();
	await page.keyboard.type(' en meer');
	await page.keyboard.press('Escape');
	await expect(field).toBeHidden();
	await expect(page.getByText('Eerste vraag', { exact: true })).toBeVisible();
});

test('a shared bundel reads the note in its opmaak, without a field', async ({
	context,
	browser
}) => {
	const copied = await catchClipboard(context);
	const page = await context.newPage();
	await keepArticle(page);
	await page.goto(BUNDEL);
	await page.getByRole('textbox', FIELD).fill('# Vraag\nZie *art. 6:162 BW*');
	await page.getByRole('textbox', FIELD).blur();
	await page.getByRole('button', { name: 'Kopieer link' }).click();
	const link = await copied(page);

	const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
	const { serveApi } = await import('../support/api');
	await serveApi(other, []);
	const fresh = await other.newPage();
	await fresh.goto(new URL(link!).pathname + new URL(link!).hash);
	await expect(fresh.getByRole('heading', { name: 'Vraag', level: 3 })).toBeVisible();
	await expect(fresh.locator('a.ref', { hasText: 'art. 6:162 BW' })).toBeVisible();
	await expect(fresh.locator('main').getByRole('textbox')).toHaveCount(0);
	await expect(fresh.getByRole('button', { name: /wijzigen$/ })).toHaveCount(0);
	await other.close();
});

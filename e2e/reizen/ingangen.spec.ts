// The ways in and the steps between (R3-I): an old network address is carried over, a link
// that names the bronnen comes for Verbonden on a phone, a defined term opens its card on a
// first tap, a list names itself in the tab, and the app can be installed.
import { expect, test } from '../support/test';

test('an address of the old network is carried over, in place', async ({ page }) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=graph&diepte=3');
	await expect(page).toHaveURL(/\/artikel\/6:162\?mode=netwerk$/);
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=text');
	await expect(page).toHaveURL(/\/artikel\/6:162$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
});

test('?bronnen= brings Verbonden into view where it stands under the text', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'Beside the text on a wide screen it is in view already');
	await page.goto('/wetten/BWBR0005289/artikel/6:162?bronnen=uitspraken');
	await expect(page.getByRole('complementary', { name: 'Verbonden' })).toBeInViewport();
});

test('a list names itself in the tab, also when it is the first page', async ({ page }) => {
	await page.goto('/explore?mode=index&kind=instruments');
	await expect(page).toHaveTitle(/^Wetten, Concordans$/);
});

test('the app can be installed: a manifest with a name, icons and standalone', async ({
	page,
	request,
	baseURL
}) => {
	await page.goto('/');
	const href = await page.locator('link[rel=manifest]').getAttribute('href');
	expect(href).toBe('/manifest.webmanifest');
	const manifest = await (await request.get(`${baseURL}${href}`)).json();
	expect(manifest).toMatchObject({ name: 'Concordans', display: 'standalone', start_url: '/' });
	for (const icon of manifest.icons)
		expect((await request.get(`${baseURL}${icon.src}`)).ok(), icon.src).toBe(true);
});

test('a defined term shows its definition on the first tap and goes on the second', async ({
	page,
	touch
}) => {
	test.skip(!touch, 'A mouse shows the card on hover');
	await page.goto('/wetten/BWBR0052872/artikel/1');
	const term = page.locator('a.begrip').first();
	await term.scrollIntoViewIfNeeded();
	const url = page.url();
	await term.tap();
	const card = page.locator('.floating-card.clickable');
	await expect(card).toBeVisible();
	expect(page.url()).toBe(url);
	await expect(card.getByRole('link', { name: /^Lees / })).toBeVisible();
});

// What a reader sees when the API fails: a sentence that names what failed, as an alert, with
// Opnieuw that asks again; slow told from broken; the rest of the page goes on. Rood only
// for the failure itself.
import { failApi, REQUEST_ID } from '../support/api';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162?lezen=1';
const FAILED = /status of (500|503)|ERR_INTERNET_DISCONNECTED|net::ERR_FAILED/;

test('a 500 on the article says so, and Opnieuw loads it once the API answers', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/articles\//, 500);
	await page.goto(ARTICLE);
	const alert = page.getByRole('alert').filter({ hasText: 'Artikel kon niet worden geladen.' });
	await expect(alert).toBeVisible();
	// The kenmerk of the failure: the first eight characters of the API's request_id.
	await expect(alert).toContainText(`kenmerk ${REQUEST_ID.slice(0, 8)}`);
	await expect(page.getByRole('heading', { level: 1, name: 'Artikel 6:162' })).toHaveCount(0);

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162');
	await expect(alert).toHaveCount(0);
});

test('a 503 reads as slow, not as broken', async ({ page, guard }) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/articles\//, 503);
	await page.goto(ARTICLE);
	await expect(
		page.getByRole('alert').filter({ hasText: 'Artikel kon niet op tijd worden geladen.' })
	).toBeVisible();
});

test('without a connection the page says what it could not load', async ({ page, guard }) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/articles\//, 'offline');
	await page.goto(ARTICLE);
	await expect(page.getByRole('alert').first()).toContainText('kon niet');
	await expect(
		page.getByRole('alert').first().getByRole('button', { name: 'Opnieuw' })
	).toBeVisible();
});

test('a failing step to the next article keeps the page and says what failed', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162');
	await failApi(page, /^\/api\/articles\/BWBR0005289\/163$/, 500);
	await page.getByRole('link', { name: 'Volgend artikel →' }).click();
	await expect(page).toHaveURL(/6:163/);
	await expect(
		page.getByRole('alert').filter({ hasText: 'kon niet worden geladen' }).first()
	).toBeVisible();
	await expect(page.getByRole('banner')).toBeVisible();
	await page.goBack();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162');
});

test('one failing group of Verbonden leaves the others and the text standing', async ({
	page,
	guard,
	touch
}) => {
	test.skip(touch, 'Verbonden stands beside the text from 1440');
	guard.allow(FAILED);
	await failApi(page, /^\/api\/articles\/BWBR0005289\/162\/cited-by/, 500);
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162');
	const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
	const alert = verbonden.getByRole('alert').first();
	await expect(alert).toContainText('De uitspraken konden niet worden geladen.');
	await expect(alert.getByRole('button', { name: 'Opnieuw' })).toBeVisible();
	await expect(
		verbonden.getByRole('heading', { name: 'Artikelen die naar dit artikel verwijzen' })
	).toBeVisible();
});

test('a failure is not red at rest', async ({ page, guard }) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/articles\//, 500);
	await page.goto(ARTICLE);
	const alert = page.getByRole('alert').first();
	await expect(alert).toBeVisible();
	const colour = await alert.evaluate((el) => getComputedStyle(el).color);
	const accent = await page.evaluate(() => {
		const probe = document.createElement('span');
		probe.style.color = 'var(--accent)';
		document.body.append(probe);
		const c = getComputedStyle(probe).color;
		probe.remove();
		return c;
	});
	expect(colour).not.toBe(accent);
});

test('a readable address whose lookup fails says which bron, with its kenmerk', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/lookup/, 500);
	await page.goto('/leden/rob-jetten');
	const alert = page.getByRole('alert');
	await expect(alert).toContainText('Lid rob-jetten kon niet worden geladen.');
	await expect(alert).toContainText(`kenmerk ${REQUEST_ID.slice(0, 8)}`);
	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Rob Jetten');
});

test('a page that cannot load without a connection says Geen verbinding', async ({
	page,
	context,
	guard,
	touch
}) => {
	guard.allow(/ERR_INTERNET_DISCONNECTED|Failed to fetch|dynamically imported module/);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	if (touch) await page.getByRole('button', { name: 'Menu' }).click();
	await context.setOffline(true);
	await page.getByRole('link', { name: 'Bundels', exact: true }).first().click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Geen verbinding');
	await expect(page).toHaveTitle('Geen verbinding, Concordans');
	await expect(page.getByRole('button', { name: 'Opnieuw laden' })).toBeVisible();
});

test('Actueel that cannot load says so under its heading, and Opnieuw asks the list again', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/feed\?/, 503);
	await page.goto('/actueel');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Actueel');
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'Actueel kon niet op tijd worden geladen.' });
	await expect(alert).toBeVisible();

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(page.getByRole('heading', { level: 2, name: /^Vandaag/ })).toBeVisible();
	await expect(alert).toHaveCount(0);
});

test('Actueel keeps its days when the next ones fail, and says so below them with Opnieuw', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await page.goto('/actueel');
	const days = page.getByRole('heading', { level: 2, name: /^Vandaag/ });
	await expect(days).toBeVisible();
	let asked = 0;
	await failApi(page, /^\/api\/feed\?.*cursor=/, 503);
	page.on('request', (r) => {
		if (/\/api\/feed\?.*cursor=/.test(r.url())) asked++;
	});
	await page.getByRole('button', { name: 'Volgende dagen' }).click();
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'De volgende dagen konden niet op tijd worden geladen.' });
	await expect(alert).toBeVisible();
	await expect(days).toBeVisible();
	// Opnieuw takes the place of Volgende dagen: one way to ask again.
	await expect(page.getByRole('button', { name: 'Volgende dagen' })).toHaveCount(0);
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect.poll(() => asked).toBe(2);
	await expect(alert).toBeVisible();
});

test('a network that cannot be drawn says so on the canvas, the bron stays, Opnieuw draws it', async ({
	page,
	guard,
	touch
}) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/nodes\/articles\/bwbr0005289_162\/neighborhood/, 503);
	await page.goto('/wetten/BWBR0005289/artikel/6:162');
	if (touch)
		await page
			.getByRole('navigation', { name: 'Panelen' })
			.getByRole('button', { name: 'Netwerk' })
			.click();
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'Het netwerk kon niet op tijd worden geladen.' });
	await expect(alert).toBeVisible();
	await expect(page).toHaveTitle(/6:162/);

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(alert).toHaveCount(0);
	await expect(
		page
			.getByRole('list', { name: /^Bronnen in het netwerk, \d+/ })
			.getByRole('link', { name: 'Art. 6:162 BW, Artikel' })
	).toBeAttached();
});

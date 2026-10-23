// What a reader sees when the API fails: a sentence that names what failed, as an alert, with
// Opnieuw that asks again; slow told from broken; the rest of the page goes on. Rood only
// for the failure itself.
import { failApi, REQUEST_ID } from '../support/api';
import { failChunk } from '../support/chunks';
import { goToMine } from '../support/navigation';
import { expect, test } from '../support/test';

const ARTICLE = '/wetten/BWBR0005289/artikel/6:162';
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
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
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

test('a failing step to the next article keeps this one and its address, and says which failed', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await page.goto(ARTICLE);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	await failApi(page, /^\/api\/articles\/BWBR0005289\/163$/, 500);
	const volgend = page.getByRole('link', { name: 'Volgend artikel →' });
	await volgend.click();
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'Artikel 6:163 kon niet worden geladen.' });
	await expect(alert).toBeVisible();
	await expect(page).toHaveURL(/6:162/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:163 BW');
	await expect(page).toHaveURL(/6:163/);
	await expect(alert).toHaveCount(0);
});

test('a 429 says so with its wait, and asks again by itself once the wait is over', async ({
	page,
	guard
}) => {
	guard.allow(/status of 429/);
	await failApi(page, /^\/api\/factions/, 429);
	await page.goto('/explore?mode=index&kind=factions');
	const wacht = page.getByRole('status').filter({ hasText: 'Even te veel verzoeken' });
	await expect(wacht).toBeVisible();
	await expect(wacht.getByText(/^Even te veel verzoeken, opnieuw over \d s\.$/)).toBeVisible();
	await expect(page.getByRole('alert')).toHaveCount(0);
	// The wait over, the API answers again: the list comes by itself.
	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await expect(wacht).toHaveCount(0, { timeout: 8000 });
	await expect(page.getByRole('figure', { name: 'Zetelverdeling Tweede Kamer' })).toBeVisible();
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
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162 BW');
	const verbonden = page.getByRole('complementary', { name: 'Verbonden' });
	const alert = verbonden.getByRole('alert').first();
	await expect(alert).toContainText('De uitspraken konden niet worden geladen.');
	await expect(alert.getByRole('button', { name: 'Opnieuw' })).toBeVisible();
	await expect(verbonden.getByRole('heading', { name: /^Wetten/ })).toBeVisible();
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
	guard
}) => {
	guard.allow(/ERR_INTERNET_DISCONNECTED|Failed to fetch|dynamically imported module/);
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await context.setOffline(true);
	await goToMine(page, 'Bundels');
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
	await page.getByRole('button', { name: 'Eerdere dagen' }).click();
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'De eerdere dagen konden niet op tijd worden geladen.' });
	await expect(alert).toBeVisible();
	await expect(days).toBeVisible();
	// Opnieuw takes the place of Eerdere dagen: one way to ask again.
	await expect(page.getByRole('button', { name: 'Eerdere dagen' })).toHaveCount(0);
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect.poll(() => asked).toBe(2);
	await expect(alert).toBeVisible();
});

test('a network that cannot be drawn says so on the canvas, the bron stays, Opnieuw draws it', async ({
	page,
	guard
}) => {
	guard.allow(FAILED);
	await failApi(page, /^\/api\/nodes\/articles\/bwbr0005289_162\/neighborhood/, 503);
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
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

test('a part whose chunk did not come says so in its place, and Opnieuw asks it again', async ({
	page,
	guard
}) => {
	// The comparison is a chunk of its own; one that does not come (a deploy removed it, the
	// connection dropped it) stands as a failure with Opnieuw, as a failing request does.
	guard.allow(/dynamically imported module|net::ERR_FAILED|Importing a module script failed/);
	await failChunk(page, 'src/lib/components/articles/VersionCompare.svelte');
	await page.goto('/wetten/BWBR0001840/artikel/23');
	await page.getByRole('link', { name: 'Vergelijken', exact: true }).click();
	const alert = page
		.getByRole('alert')
		.filter({ hasText: 'De vergelijking kon niet worden geladen.' });
	await expect(alert).toBeVisible();

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(page.getByRole('insertion').first()).toBeVisible();
	await expect(alert).toHaveCount(0);
});

test('a list of Bronnen whose chunk did not come says so, and Opnieuw shows it', async ({
	page,
	guard
}) => {
	guard.allow(/dynamically imported module|net::ERR_FAILED|Importing a module script failed/);
	await failChunk(page, 'src/lib/components/explore/IndexView.svelte');
	await page.goto('/explore?mode=index&kind=judgments');
	const alert = page.getByRole('alert').filter({ hasText: 'De lijst kon niet worden geladen.' });
	await expect(alert).toBeVisible();

	await page.unrouteAll({ behavior: 'ignoreErrors' });
	await alert.getByRole('button', { name: 'Opnieuw' }).click();
	await expect(alert).toHaveCount(0);
	await expect(page.getByRole('link', { name: /ECLI:NL:/ }).first()).toBeVisible();
});

test('a judgment that does not load fails in its column, with its heading line and Verbonden', async ({
	page,
	guard,
	touch
}) => {
	test.skip(touch, 'Verbonden stands beside the text from 1440');
	guard.allow(FAILED);
	await failApi(page, /^\/api\/(judgments|nodes)\//, 500);
	await page.goto('/uitspraken/ECLI:NL:HR:2019:2006');
	await expect(
		page.getByRole('alert').filter({ hasText: 'Uitspraak kon niet worden geladen.' })
	).toBeVisible();
	await expect(page.getByRole('complementary', { name: 'Verbonden' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Er ging iets mis' })).toHaveCount(0);
});

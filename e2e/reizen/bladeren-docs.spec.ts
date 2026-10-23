// Bronnen (Bladeren): the overview in four groups and a list per kind; the documentation,
// the method, the sources with their coverage, and the API reference.
import { expect, test } from '../support/test';

const GROUPS = {
	Recht: ['Wetten', 'Uitspraken'],
	'Parlementaire behandeling': ['Dossiers', 'Stemmingen', 'Stukken'],
	Parlement: ['Kamerleden', 'Fracties', 'Commissies'],
	Regering: ['Kabinetten', 'Bewindspersonen', 'Toezeggingen']
};

test('Bronnen lists every kind in its group, each with its count', async ({ page }) => {
	await page.goto('/explore?mode=index');
	const main = page.getByRole('main');
	for (const [group, kinds] of Object.entries(GROUPS)) {
		await expect(main.getByRole('heading', { level: 2, name: group, exact: true })).toBeVisible();
		for (const kind of kinds)
			await expect(main.getByRole('link', { name: new RegExp(`^${kind} [\\d.]+$`) })).toBeVisible();
	}
});

for (const kind of ['Uitspraken', 'Stemmingen', 'Kamerleden', 'Toezeggingen'])
	test(`Bronnen › ${kind} opens its list`, async ({ page }) => {
		await page.goto('/explore?mode=index');
		await page
			.getByRole('main')
			.getByRole('link', { name: new RegExp(`^${kind} [\\d.]+$`) })
			.click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Bronnen: ${kind}`);
		await expect(page.getByRole('searchbox', { name: /^Zoek in / })).toBeVisible();
		await expect(
			page.getByRole('main').getByRole('listitem').getByRole('link').first()
		).toBeVisible();
	});

test('a bare collection typed in the bar opens its list, named as its kind', async ({ page }) => {
	await page.goto('/uitspraken');
	await expect(page).toHaveURL(/\/explore\?mode=index&kind=judgments$/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bronnen: Uitspraken');
	await expect(page).toHaveTitle('Uitspraken, Concordans');
});

test('the documentation leads to the method and the keys', async ({ page }) => {
	await page.goto('/docs');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Documentatie');
	await page.getByRole('main').getByRole('link', { name: 'Methode' }).first().click();
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Methode');
	for (const part of ['Verwijzingen in de tekst', 'Betrouwbaarheid', 'Grenzen'])
		await expect(page.getByRole('heading', { level: 2, name: part })).toBeVisible();
});

test('Bronnen en hergebruik gives the coverage and the date of each source', async ({ page }) => {
	await page.goto('/bronnen');
	await expect(page.getByRole('heading', { level: 2, name: 'Dekking en stand' })).toBeVisible();
	const main = page.getByRole('main');
	await expect(main).toContainText(/Uitspraken\s*[\d.]+/);
	await expect(main).toContainText(/wetten\.overheid\.nl\s*tot en met \d+\s\S+\s\d{4}/);
});

test('the API reference lists the routes per kind', async ({ page }) => {
	await page.goto('/api');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('API-referentie');
	for (const part of ['Wetten', 'Artikelen', 'Uitspraken', 'Stemmingen'])
		await expect(page.getByRole('heading', { level: 2, name: part, exact: true })).toBeVisible();
	await expect(
		page.getByText('/api/articles/{bwb_id}/{article_number}', { exact: true }).first()
	).toBeVisible();
});

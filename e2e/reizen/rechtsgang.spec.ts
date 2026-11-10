// Rechtsgang (/rechtspraak/rechtsgang, B143): per area of law the route of a case, each court
// with the article that gives it its say as a link, a gap shown as one; under bestuursrecht
// the Bevoegdheidsregeling by chapter, an article opened to the laws its list names.
import { smallTargets } from '../support/rules';
import { expect, test } from '../support/test';

test('the route of civiel recht names each court with its article as a link', async ({ page }) => {
	await page.goto('/rechtspraak/rechtsgang');
	await expect(page.getByRole('heading', { level: 1, name: 'Rechtsgang' })).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Civiel recht en strafrecht' })
	).toBeVisible();
	// At its readable address, not by /explore?focus (B144).
	await expect(page.getByRole('link', { name: 'art. 42 RO' })).toHaveAttribute(
		'href',
		'/wetten/BWBR0001830/artikel/42'
	);
	await expect(page.getByRole('link', { name: 'art. 78 RO' })).toBeVisible();
});

test('a court whose article is not read in the source shows the gap', async ({ page }) => {
	await page.goto('/rechtspraak/rechtsgang?gebied=belasting');
	const cassation = page.locator('.vak').filter({ hasText: 'Hoge Raad' });
	await expect(cassation).toContainText('wetsartikel niet in de gegevens');
	await expect(cassation.getByRole('link')).toHaveCount(0);
});

test('the area chosen is the address’s, so a reload shows it again', async ({ page }) => {
	await page.goto('/rechtspraak/rechtsgang?gebied=belasting');
	await page.getByRole('button', { name: 'Bestuur', exact: true }).click();
	await expect(page).toHaveURL(/\?gebied=bestuur$/);
	await page.reload();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Bestuursrecht', exact: true })
	).toBeVisible();
});

test('the links of Rechtsgang stand a finger’s target apart', async ({ page, touch }) => {
	test.skip(!touch, 'a finger’s target');
	await page.goto('/rechtspraak/rechtsgang?gebied=bestuur');
	const links = '.rechtsgang a:not(.lede a)';
	// The crumb and the courts with their articles; then an article of the regeling opened.
	await expect(page.getByRole('link', { name: 'art. 8:6 Awb' }).first()).toBeVisible();
	expect(await smallTargets(page, links), 'tap targets under 44 px').toEqual([]);
	await page.locator('details').nth(1).locator('summary').click();
	await expect(page.getByRole('link', { name: 'Artikel 2 van de regeling' })).toBeVisible();
	expect(await smallTargets(page, links), 'tap targets under 44 px').toEqual([]);
});

test('bestuursrecht opens an article of the regeling to the laws it names', async ({ page }) => {
	await page.goto('/rechtspraak/rechtsgang');
	await page.getByRole('button', { name: 'Bestuur', exact: true }).click();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Bevoegdheidsregeling bestuursrechtspraak' })
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'Bijlage 2 bij de Awb' })).toHaveAttribute(
		'href',
		'/wetten/BWBR0005537/bijlage/2'
	);
	const article = page.locator('details').filter({ hasText: 'Artikel 2 Beroep bij de Afdeling' });
	await article.locator('summary').click();
	await expect(article.getByRole('link', { name: 'Archiefwet 1995' })).toBeVisible();
	await expect(article.getByRole('link', { name: 'Artikel 2 van de regeling' })).toHaveAttribute(
		'href',
		/bijlage/
	);
});

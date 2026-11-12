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
	await expect(page.locator('.gebied').getByRole('link', { name: 'art. 78 RO' })).toBeVisible();
});

test('Rechtsgang is a tab under Rechtspraak, beside Uitspraken', async ({ page }) => {
	await page.goto('/uitspraken');
	const tabs = page.getByRole('navigation', { name: 'Rechtspraak', exact: true });
	await expect(tabs.getByRole('link', { name: 'Uitspraken' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await tabs.getByRole('link', { name: 'Rechtsgang' }).click();
	await expect(page).toHaveURL(/\/rechtspraak\/rechtsgang$/);
	await expect(page.getByRole('heading', { level: 1, name: 'Rechtsgang' })).toBeVisible();
	const here = page.getByRole('navigation', { name: 'Rechtspraak', exact: true });
	await expect(here.getByRole('link', { name: 'Rechtsgang' })).toHaveAttribute(
		'aria-current',
		'page'
	);
	await expect(here.getByRole('link', { name: 'Uitspraken' })).toHaveAttribute(
		'href',
		'/uitspraken'
	);
});

test('cassation in belastingrecht names art. 28 AWR beside art. 78 RO', async ({ page }) => {
	await page.goto('/rechtspraak/rechtsgang?gebied=belasting');
	const cassation = page.locator('.vak').filter({ hasText: 'Hoge Raad' });
	await expect(cassation.getByRole('link', { name: 'art. 28 AWR' })).toBeVisible();
	await expect(cassation.getByRole('link', { name: 'art. 78 RO' })).toBeVisible();
});

test('bestuursrecht reads as rows "als … / anders", the excepted besluit first', async ({
	page
}) => {
	await page.goto('/rechtspraak/rechtsgang?gebied=bestuur');
	const first = page.locator('.vak').filter({ hasText: 'Eerste aanleg' });
	await expect(first.locator('.als')).toHaveText([
		'als het besluit is uitgezonderd, art. 1 bijlage 2 Awb',
		'als de rechter is aangewezen, hoofdstuk 2 bijlage 2',
		'anders'
	]);
	await expect(first.locator('.rij--anders')).toContainText('Rechtbanken');
	await expect(page.getByText('hoger beroep, na de rechtbank')).toBeVisible();
	await expect(
		page.locator('.gebied').getByText('Gestippeld: alleen in enkele zaken.')
	).toBeVisible();
});

test('cassation in bestuursrecht is a dashed card after the Centrale Raad van Beroep alone', async ({
	page
}) => {
	await page.goto('/rechtspraak/rechtsgang?gebied=bestuur');
	const stages = page.locator('.gebied .vak');
	await expect(stages).toHaveCount(3);
	const cassation = stages.filter({ hasText: 'Cassatie' });
	await expect(cassation).toHaveClass(/vak--stippel/);
	await expect(cassation.locator('.als')).toHaveText('alleen in enkele zaken');
	await expect(cassation.locator('.naam')).toHaveText('Hoge Raad');
	// With its grounds: art. 78 RO and the laws that open it (B150).
	await expect(cassation.getByRole('link', { name: 'art. 53 AOW' })).toBeVisible();
	await expect(
		page.locator('.gebied').getByText('cassatie, alleen na de Centrale Raad van Beroep')
	).toBeVisible();
});

test('the entries into the Hoge Raad name each court before it, with its articles', async ({
	page
}) => {
	await page.goto('/rechtspraak/rechtsgang?gebied=belasting');
	const entries = page.locator('.ingangen');
	await expect(
		entries.getByRole('heading', { level: 2, name: 'Ingangen naar de Hoge Raad' })
	).toBeVisible();
	await expect(entries.locator('.in > li')).toHaveCount(5);
	// Sprongcassatie after the rechtbank: dashed, with art. 398 Rv.
	const leap = entries.locator('.in > li').filter({ hasText: 'eerste aanleg, civiel' });
	await expect(leap).toHaveClass(/stippel/);
	await expect(leap.getByRole('link', { name: 'art. 398 Rv' })).toBeVisible();
	// The Hoge Raad in first and only instance, and the court after verwijzing.
	await expect(entries.getByText('Eerste en enige aanleg')).toBeVisible();
	await expect(entries.getByRole('link', { name: 'art. 76 RO' })).toBeVisible();
	await expect(entries.getByRole('link', { name: 'art. 440 Sv' })).toBeVisible();
	await expect(entries.getByText('Gestippeld: alleen in enkele zaken.')).toBeVisible();
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
	// The courts with their articles; then an article of the regeling opened.
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

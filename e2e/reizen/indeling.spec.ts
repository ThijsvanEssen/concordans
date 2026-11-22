// Indeling (/rechtspraak/indeling, B140): the rechtbank and the gerechtshof of a municipality
// as the CBS gives them, with the article of the Wet op de rechterlijke indeling as a link;
// under it every arrondissement. Where the API holds no map yet, the page says so.
import { smallTargets } from '../support/rules';
import { apiPath } from '../support/api';
import { expect, test } from '../support/test';

test('a municipality typed gives its rechtbank and gerechtshof with their articles', async ({
	page
}) => {
	await page.goto('/rechtspraak/indeling');
	await expect(page.getByRole('heading', { level: 1, name: 'Indeling' })).toBeVisible();
	await page.getByRole('combobox', { name: 'Gemeente' }).fill('haar');
	await page.getByRole('option', { name: 'Haarlem' }).click();
	await expect(page).toHaveURL(/\?gemeente=GM0392$/);
	const result = page.getByRole('region', { name: 'Haarlem' });
	await expect(result.getByText('Rechtbank Noord-Holland', { exact: true })).toBeVisible();
	await expect(result.getByRole('link', { name: 'art. 8 RI' })).toHaveAttribute(
		'href',
		'/wetten/BWBR0002080/artikel/8'
	);
	await expect(result.getByText('Gerechtshof Amsterdam', { exact: true })).toBeVisible();
	await expect(result.getByRole('link', { name: 'art. 78 RO' })).toBeVisible();
	await expect(
		result.getByRole('link', { name: 'Uitspraken van de rechtbank Noord-Holland' })
	).toHaveAttribute('href', /court=RBNHO/);
	await expect(page.getByText('Indeling: CBS, Gebieden in Nederland (CC BY 4.0)')).toBeVisible();
});

test('two municipalities of one name tell themselves apart by their province', async ({ page }) => {
	await page.goto('/rechtspraak/indeling');
	await page.getByRole('combobox', { name: 'Gemeente' }).fill('Bergen');
	await expect(page.getByRole('listbox').getByRole('option')).toHaveText([
		'BergenNoord-Holland',
		'BergenLimburg'
	]);
	await page.getByRole('option', { name: /Limburg/ }).click();
	await expect(page.getByRole('region', { name: 'Bergen' })).toContainText('Rechtbank Limburg');
});

test('a name no municipality bears says so, and Wissen empties the field', async ({ page }) => {
	await page.goto('/rechtspraak/indeling?gemeente=GM0392');
	const field = page.getByRole('combobox', { name: 'Gemeente' });
	await expect(field).toHaveValue('Haarlem');
	await field.fill('Xyzzy');
	await expect(page.getByText('Geen gemeente met deze naam')).toBeVisible();
	await page.getByRole('button', { name: 'Wissen' }).click();
	await expect(field).toHaveValue('');
	await expect(page).not.toHaveURL(/gemeente=/);
	await expect(page.getByRole('region', { name: 'Haarlem' })).toHaveCount(0);
});

test('a municipality the text of the law does not name says it under its result', async ({
	page
}) => {
	await page.goto('/rechtspraak/indeling?gemeente=GM0383');
	await expect(page.getByText('noemt deze gemeente niet zoals het CBS')).toBeVisible();
	await page.goto('/rechtspraak/indeling?gemeente=GM0392');
	await expect(page.getByText('noemt deze gemeente niet zoals het CBS')).toHaveCount(0);
});

test('every arrondissement is a row, its municipalities opened in place', async ({ page }) => {
	await page.goto('/rechtspraak/indeling');
	const rows = page.locator('tbody tr:not(.gemeenten)');
	await expect(rows).toHaveCount(11);
	await expect(rows.first()).toContainText('Rechtbank Amsterdam');
	const row = rows.filter({ hasText: 'Rechtbank Noord-Holland' });
	await expect(row).toContainText('Gerechtshof Amsterdam');
	await expect(row.getByRole('link', { name: 'art. 8 RI' })).toBeVisible();
	await row.getByRole('button', { name: /gemeenten?$/ }).click();
	await page.getByRole('button', { name: 'Castricum' }).click();
	await expect(page).toHaveURL(/\?gemeente=GM0383$/);
	await expect(page.getByRole('region', { name: 'Castricum' })).toBeVisible();
});

test('the day of reckoning is the address’s', async ({ page }) => {
	await page.goto('/rechtspraak/indeling');
	await page.getByLabel('Peildatum').selectOption('2025');
	await expect(page).toHaveURL(/\?jaar=2025$/);
	await expect(page.getByLabel('Peildatum')).toHaveValue('2025');
	await page.goto('/rechtspraak/indeling?jaar=2025&gemeente=GM0383');
	// An older year is not checked against the text: no remark on the municipality.
	await expect(page.getByRole('region', { name: 'Castricum' })).toBeVisible();
	await expect(page.getByText('noemt deze gemeente niet zoals het CBS')).toHaveCount(0);
});

test('where the API holds no map yet the page marks it as not loaded', async ({ page, guard }) => {
	guard.allow(/status of 404/);
	await page.route(apiPath('/api/courts/districts'), (route) =>
		route.fulfill({
			status: 404,
			contentType: 'application/json',
			headers: { 'access-control-allow-origin': '*' },
			body: '{"detail":"court map of year \'newest\' not found."}'
		})
	);
	await page.goto('/rechtspraak/indeling');
	await expect(
		page.getByText('De indeling per gemeente van het CBS is nog niet geladen')
	).toBeVisible();
	await expect(page.getByRole('combobox')).toHaveCount(0);
});

test('Indeling is a tab beside Uitspraken and Rechtsgang', async ({ page }) => {
	await page.goto('/rechtspraak/rechtsgang');
	const tabs = page.getByRole('navigation', { name: 'Rechtspraak', exact: true });
	await tabs.getByRole('link', { name: 'Indeling' }).click();
	await expect(page).toHaveURL(/\/rechtspraak\/indeling$/);
	await expect(tabs.getByRole('link', { name: 'Indeling' })).toHaveAttribute(
		'aria-current',
		'page'
	);
});

test('the targets of Indeling stand a finger’s size apart', async ({ page, touch }) => {
	test.skip(!touch, 'a finger’s target');
	await page.goto('/rechtspraak/indeling?gemeente=GM0392');
	await expect(page.getByRole('region', { name: 'Haarlem' })).toBeVisible();
	await page
		.locator('tbody tr:not(.gemeenten)')
		.first()
		.getByRole('button', { name: /gemeenten?$/ })
		.click();
	expect(
		await smallTargets(page, '.indeling a:not(.lede a), .indeling button, .indeling select'),
		'tap targets under 44 px'
	).toEqual([]);
});

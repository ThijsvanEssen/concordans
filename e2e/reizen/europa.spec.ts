// Europa (/europa, B176; no tab of Wetten, its lists are filters of Dossiers and Uitspraken): EU proposals before the Tweede Kamer, bills that transpose EU acts and
// the preliminary rulings on questions of Dutch courts, each row opening its bron, with the
// official source (EUR-Lex) one step further where the API names the number.
import { expect, test } from '../support/test';

test('/europa lists the three, with EUR-Lex where the API names the act', async ({ page }) => {
	await page.goto('/europa');
	await expect(
		page.getByRole('heading', { level: 2, name: 'EU-voorstellen in behandeling' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Omzetting in Nederland' })
	).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: /^Zaken uit Nederland/ })).toBeVisible();
	const eurLex = page.getByRole('link', { name: /^EUR-Lex, / }).first();
	await expect(eurLex).toHaveAttribute('href', /^https:\/\/eur-lex\.europa\.eu\//);
	await expect(eurLex).toHaveAttribute('rel', /external/);
	await expect(page.getByRole('link', { name: /Legislative Train/ })).toHaveAttribute(
		'href',
		'https://www.europarl.europa.eu/legislative-train/'
	);
});

test('Europa is no tab of Wetten; its lists are filters of Dossiers and Uitspraken', async ({
	page
}) => {
	await page.goto('/wetten');
	await expect(page.getByRole('link', { name: 'Europa', exact: true })).toHaveCount(0);
	await page.goto('/europa');
	await page
		.getByRole('link', { name: /EU-voorstellen/ })
		.first()
		.click();
	await expect(page).toHaveURL(/\/dossiers\?.*eu=proposal/);
});

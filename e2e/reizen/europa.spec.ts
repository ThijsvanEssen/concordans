// Europa (/europa, B176): EU proposals before the Tweede Kamer, bills that transpose EU acts and
// the newest judgments of the Court of Justice, each row opening its bron, with the official
// source (EUR-Lex) one step further where the title names the number.
import { expect, test } from '../support/test';

test('/europa lists the three, with EUR-Lex where the title names the act', async ({ page }) => {
	await page.goto('/europa');
	await expect(
		page.getByRole('heading', { level: 2, name: 'Voorstellen van de Commissie' })
	).toBeVisible();
	await expect(
		page.getByRole('heading', { level: 2, name: 'Omzetting in Nederland' })
	).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: 'Hof van Justitie' })).toBeVisible();
	const eurLex = page.getByRole('link', { name: /^EUR-Lex, / }).first();
	await expect(eurLex).toHaveAttribute('href', /^https:\/\/eur-lex\.europa\.eu\//);
	await expect(eurLex).toHaveAttribute('rel', /external/);
	await expect(page.getByRole('link', { name: /Legislative Train/ })).toHaveAttribute(
		'href',
		'https://www.europarl.europa.eu/legislative-train/'
	);
});

test('Europa is a tab beside the lists of Wetten', async ({ page }) => {
	await page.goto('/wetten');
	await page.getByRole('link', { name: 'Europa', exact: true }).click();
	await expect(page).toHaveURL(/\/europa$/);
});

// Saying what the text is (Coverage): Dutch law in force says so with its date; an EU act is
// the text as adopted, dated by its adoption, with EUR-Lex as the source; a regeling whose
// text is not read in points to wetten.overheid.nl; a bron without verbindingen says so.
import { expect, test } from '../support/test';

test('Dutch law says it is the law in force, since when', async ({ page }) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162?lezen=1');
	await expect(page.getByText('Geldend recht, tekst sinds 1 januari 1992')).toBeVisible();
});

test('an EU article is the text as adopted, dated so, and sourced to EUR-Lex', async ({ page }) => {
	await page.goto('/wetten/32016R0679/artikel/6?lezen=1');
	await expect(
		page.getByText(/^Tekst zoals vastgesteld op 27 april 2016, latere wijzigingen niet verwerkt/)
	).toBeVisible();
	await expect(page.getByRole('link', { name: 'EUR-Lex ↗' })).toHaveAttribute(
		'href',
		/eur-lex\.europa\.eu\/.*CELEX:32016R0679/
	);
	await expect(page.getByText(/^Geldend recht/)).toHaveCount(0);

	await page.getByRole('button', { name: 'Citeer', exact: true }).click();
	const cite = page.getByRole('menu', { name: /^Citeer art\. 6 / });
	await expect(cite.getByRole('menuitem', { name: /voluit$/ })).toContainText(
		'Verordening (EU) 2016/679'
	);
	// Dated as adopted, never as in force on a day.
	await expect(cite.getByRole('menuitem', { name: /met datum$/ })).toContainText(
		'tekst zoals vastgesteld op 27 april 2016'
	);
	await expect(cite).not.toContainText('geldend');
	await expect(cite.getByRole('menuitem', { name: 'eur-lex.europa.eu ↗' })).toBeVisible();
});

test('a regeling without its text read in points to wetten.overheid.nl', async ({ page }) => {
	await page.goto('/wetten/BWBR0038996?lezen=1');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Aanwijzing afpakken');
	const note = page.getByRole('paragraph').filter({ hasText: 'Tekst niet ingelezen' });
	await expect(note).toBeVisible();
	await expect(note.getByRole('link', { name: 'wetten.overheid.nl ↗' })).toHaveAttribute(
		'href',
		/wetten\.overheid\.nl\/.*BWBR0038996/
	);
});

test('a bron without verbindingen says so', async ({ page, touch }) => {
	test.skip(touch, 'Verbonden stands beside the text from 1440');
	await page.goto('/wetten/BWBR0038996');
	await expect(
		page.getByRole('complementary', { name: 'Verbonden' }).getByText('Geen verbindingen.')
	).toBeVisible();
});

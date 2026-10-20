// A judgment: its heading and course of proceedings, the overview of its parts, the menu of a
// rechtsoverweging, and an article it cites.
import { expect, test } from '../support/test';
import { showText } from '../support/panes';

const URGENDA = '/uitspraken/ECLI:NL:HR:2019:2006?lezen=1';

test('a judgment shows its court, its course and its parts', async ({ page, touch }) => {
	await page.goto(URGENDA);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'HR 20 december 2019, ECLI:NL:HR:2019:2006 (Urgenda)'
	);
	await expect(
		page.getByRole('navigation', { name: 'Behoort bij' }).getByRole('link', {
			name: /Rb\. Den Haag 24 juni 2015/
		})
	).toBeVisible();
	await expect(page.getByRole('rowheader', { name: 'Eiser' })).toBeVisible();
	await expect(
		page.getByRole('button', { name: /^Overweging [\d.]+: citeren, bewaren$/ })
	).not.toHaveCount(0);

	if (touch) return; // the overview of parts stands beside the text from 1440
	await page
		.getByRole('complementary', { name: 'Inhoud' })
		.getByRole('link', { name: '9. Beslissing' })
		.click();
	await expect(page.getByRole('heading', { level: 3, name: '9. Beslissing' })).toBeInViewport();
});

test('a rechtsoverweging cites short, in full and as a link to its place', async ({ page }) => {
	await page.goto(URGENDA);
	await page.getByRole('button', { name: 'Overweging 5.3.2: citeren, bewaren' }).click();
	const menu = page.getByRole('menu', { name: 'HR 20 december 2019, r.o. 5.3.2' });
	await expect(menu.getByRole('menuitem', { name: /kort$/ })).toHaveText(/r\.o\. 5\.3\.2/);
	await expect(menu.getByRole('menuitem', { name: /voluit$/ })).toContainText(
		'ECLI:NL:HR:2019:2006'
	);
	await expect(menu.getByRole('menuitem', { name: /link$/ })).toContainText('#rov-5.3.2');
	await expect(menu.getByRole('menuitem', { name: 'Bewaar in Losse markeringen' })).toBeVisible();
});

test('a cited article opens at the lid the judgment names', async ({ page, touch }) => {
	await page.goto(URGENDA);
	await page.getByRole('link', { name: 'art. 6:162 BW', exact: true }).first().click();
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
	await showText(page, touch);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText('Artikel 6:162');
});

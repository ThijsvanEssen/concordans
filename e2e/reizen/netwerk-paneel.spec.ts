// The panel Netwerk: the bron the page is of is not offered again as "Aangeklikt op het
// canvas", and the head counts nothing the list of Gekozen already shows.
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';

test('the bron in the middle is not offered as a suggestion, and the head holds no count', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0005289/artikel/6:162?mode=netwerk');
	await expect(page.locator('.canvas-node-list a').first()).toBeAttached();
	await openSheet(page);
	await expect(page.getByRole('button', { name: '+ Bron toevoegen' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'Aangeklikt op het canvas' })).toHaveCount(0);
	await expect(page.getByText(/getoond/)).toHaveCount(0);
});

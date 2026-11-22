// Openstaand (besluit 37, 45): the card of a bron a lopend dossier wants to change names the
// dossier and its voorstel and adds the voorstel to the netwerk.
import { expect, test } from '../support/test';

test('the card of an article names the open dossier and adds its voorstel to the netwerk', async ({
	page
}) => {
	await page.goto('/wetten/BWBR0001827/artikel/17?mode=netwerk&kies=articles/bwbr0001827_17');
	const kaart = page.locator('.strook--kaart.is-open');
	const open = kaart.getByRole('region', { name: 'Lopend wetsvoorstel' });
	await expect(open).toBeVisible();
	await expect(open.getByText(/^Dossier 33723 /)).toBeVisible();
	await expect(open.getByRole('link', { name: 'Voorstel van wet', exact: true })).toBeVisible();
	await open.getByRole('button', { name: 'Aan het netwerk toevoegen' }).scrollIntoViewIfNeeded();
	await open.getByRole('button', { name: 'Aan het netwerk toevoegen' }).click();
	await expect(page).toHaveURL(/netwerk=.*documents/);
	await expect(open.getByRole('button', { name: 'In het netwerk' })).toBeDisabled();
});

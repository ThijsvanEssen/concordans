// Openstaand (besluit 37, 45): the card of a bron a lopend dossier wants to change names the
// dossier and its voorstel and adds the voorstel to the netwerk; the vinkje Voorstellen draws
// the voorstellen of the bronnen on the canvas, and takes them off again.
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

test('the vinkje Voorstellen draws the voorstellen of a wet and takes them off again', async ({
	page,
	touch
}) => {
	test.skip(touch, 'a phone sets it on the sheet Weergave');
	await page.goto('/explore?mode=netwerk&netwerk=instruments/bwbr0005416');
	const list = page.locator('.canvas-node-list');
	await expect(list.getByText('Gemw, Wet')).toBeAttached();
	const vinkje = page.getByRole('button', { name: /^Voorstellen\b/ });
	await expect(vinkje).toHaveAttribute('aria-pressed', 'false');
	// It says how many voorstellen it draws before it is on (live-toets B3).
	await expect(vinkje).toHaveText(/Voorstellen\s*\d+/);
	const voorstel = list.getByText(/^Voorstel van wet, Dossier \d+/);
	const eerst = await voorstel.count();

	await vinkje.click();
	await expect(page).toHaveURL(/voorstellen=ja/);
	await expect(vinkje).toHaveAttribute('aria-pressed', 'true');
	await expect.poll(() => voorstel.count()).toBeGreaterThan(eerst);

	await vinkje.click();
	await expect(page).not.toHaveURL(/voorstellen=/);
	await expect.poll(() => voorstel.count()).toBe(eerst);
});

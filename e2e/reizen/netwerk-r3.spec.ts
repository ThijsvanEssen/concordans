// The werkplek after round 3 (R3-N, R3-K): a chosen bron stays drawn whatever Soort leaves, the
// last bron leaves /explore as it leaves a bron's page, and Keten follows the bron of the
// netwerk, not the route; where it can mean nothing it is not offered.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

const strip = (page: Page) => page.getByRole('complementary', { name: 'Bronnen en filters' });
/** The filters of the strip, behind Filter on a narrow screen. */
async function filters(page: Page) {
	const knop = strip(page).getByRole('button', { name: 'Filter', exact: true });
	await expect(strip(page).getByRole('heading', { name: 'Weergave' }).or(knop)).toBeVisible();
	if (await knop.isVisible()) await knop.click();
	return strip(page).getByRole('region', { name: 'Legenda' });
}

test('Soort off for the kind of the chosen bronnen leaves them and the filters standing (R3-N B1)', async ({
	page
}) => {
	await page.goto('/explore?netwerk=articles/bwbr0005289_162');
	const legenda = await filters(page);
	const artikelen = legenda.getByRole('button', { name: /^Artikelen/ });
	await expect(artikelen).toHaveAttribute('aria-pressed', 'true');
	await artikelen.click();
	await expect(page).toHaveURL(/bronnen=/);
	await expect(artikelen).toHaveAttribute('aria-pressed', 'false');
	// The bron stays on the canvas: the keyboard's list of what is drawn names it.
	await expect(page.locator('.canvas-node-list')).toContainText('Art. 6:162 BW');
	await artikelen.click();
	await expect(artikelen).toHaveAttribute('aria-pressed', 'true');
});

test('the last bron on /explore leaves with × and stays gone (R3-N B2)', async ({ page }) => {
	await page.goto('/explore?netwerk=instruments/bwbr0005537');
	await page.getByRole('button', { name: /^Haal .* uit netwerk$/ }).click();
	await expect(page).not.toHaveURL(/netwerk=/);
	await page.waitForTimeout(500);
	await expect(page).not.toHaveURL(/netwerk=/);
	await expect(
		page.getByRole('banner').getByRole('link', { name: /^Netwerk/ })
	).toHaveAccessibleName('Netwerk');
});

test('Keten on /explore with a law draws its keten (R3-N B3)', async ({ page, touch }) => {
	await page.goto('/explore?netwerk=instruments/bwbr0010346&weergave=keten');
	await expect(page.getByRole('button', { name: 'Keten', pressed: true })).toBeVisible();
	await expect(page.getByText(/alleen bij een wet/)).toHaveCount(0);
	const regeling = touch
		? page.getByRole('region', { name: 'AMvB' }).getByRole('button').first()
		: page.getByRole('group', { name: 'Keten' }).getByRole('button', { name: 'Arbowet' });
	await expect(regeling).toBeVisible();
});

test('Keten is not offered where it means nothing (R3-K F9)', async ({ page }) => {
	await page.goto('/fracties/vvd?mode=netwerk');
	await expect(page.getByRole('button', { name: 'Omgeving', pressed: true })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Keten' })).toBeDisabled();
});

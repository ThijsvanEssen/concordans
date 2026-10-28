// Aantal stappen is the one measure of a netwerk's reach (Alleen gekozen draws the chosen bronnen
// and what ties them, its effect and not only ?diepte in the address), and a bundel opens in the
// werkplek with its bronnen.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';
import { keepArticle } from '../support/bundels';

const CHOSEN = ['instruments/bwbr0005537', 'instruments/bwbr0010346'];

/** The names on the canvas for the keyboard: what is drawn. */
const drawn = (page: Page) => page.locator('.canvas-node-list li');

test('Alleen gekozen draws the chosen bronnen and what ties them, 1 stap their surroundings again', async ({
	page
}) => {
	await page.goto(`/wetten/BWBR0010346?mode=netwerk&netwerk=${CHOSEN.join(',')}`);
	await openSheet(page);
	const strip = page.getByRole('complementary', { name: 'Bronnen en filters' });
	const dialog = page.getByRole('dialog', { name: 'Weergave' });
	const steps = strip.or(dialog).getByRole('group', { name: 'Aantal stappen' });
	// The filter Alleen verbonden bronnen is gone; the one measure is Aantal stappen.
	await expect(page.getByRole('button', { name: 'Alleen verbonden bronnen' })).toHaveCount(0);
	await expect(steps.getByRole('button', { name: '1 stap' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await expect(drawn(page).nth(1)).toBeAttached();
	const all = (await drawn(page).allInnerTexts()).length;

	await steps.getByRole('button', { name: 'Alleen gekozen' }).click();
	await expect(page).toHaveURL(/diepte=0/);
	await expect(page).not.toHaveURL(/omgeving=/);
	await expect.poll(async () => (await drawn(page).allInnerTexts()).length).toBeLessThan(all);
	// The chosen bronnen stay in the address.
	await expect(page).toHaveURL(/netwerk=instruments\/bwbr0005537,instruments\/bwbr0010346/);
	const only = (await drawn(page).allInnerTexts()).length;

	await steps.getByRole('button', { name: '1 stap' }).click();
	await expect(page).toHaveURL(/diepte=1/);
	await expect.poll(async () => (await drawn(page).allInnerTexts()).length).toBeGreaterThan(only);
});

test('a bundel opens in the werkplek with its bronnen as the netwerk', async ({ page }) => {
	await keepArticle(page);
	await page.goto('/bundels/losse-markeringen');
	await page
		.locator('#map-losse-markeringen')
		.getByRole('link', { name: 'Netwerk', exact: true })
		.click();
	await expect(page).toHaveURL(/\/explore\?.*netwerk=articles\/bwbr0005289_162/);
	await expect(page.getByTestId('werkplek')).toBeVisible();
	await expect(page.locator('.canvas-node-list')).toContainText('Art. 6:162 BW');
});

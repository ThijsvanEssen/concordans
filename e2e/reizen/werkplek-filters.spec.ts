// The filter Alleen verbonden bronnen draws only the surroundings of the bron marked (its effect,
// not only ?omgeving in the address), and a bundel opens in the werkplek with its bronnen.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';
import { openSheet } from '../support/sheet';
import { keepArticle } from '../support/bundels';

const CHOSEN = ['instruments/bwbr0005537', 'instruments/bwbr0010346'];

/** The names on the canvas for the keyboard: what is drawn. */
const drawn = (page: Page) => page.locator('.canvas-node-list li');

test('Alleen verbonden bronnen draws only the bron of the page with its surroundings, and off brings the rest back', async ({
	page
}) => {
	await page.goto(`/wetten/BWBR0010346?mode=netwerk&netwerk=${CHOSEN.join(',')}`);
	await openSheet(page);
	const strip = page.getByRole('complementary', { name: 'Bronnen en filters' });
	// The filters of the strip, behind Filter on a narrow screen, and the option under Meer.
	const toggle = strip.getByRole('button', { name: 'Filter', exact: true });
	await expect(
		strip.getByRole('region', { name: 'Weergave' }).or(toggle).first()
	).toBeVisible();
	if (await toggle.isVisible()) await toggle.click();
	const meer = strip.getByRole('region', { name: 'Filters' }).getByRole('button', { name: 'Meer' });
	if ((await meer.getAttribute('aria-expanded')) !== 'true') await meer.click();
	const filter = strip.getByRole('button', { name: 'Alleen verbonden bronnen' });
	await expect(filter).toHaveAttribute('aria-pressed', 'false');
	await expect(drawn(page).nth(1)).toBeAttached();
	const all = (await drawn(page).allInnerTexts()).length;

	await filter.click();
	await expect(page).toHaveURL(/omgeving=/);
	await expect(filter).toHaveAttribute('aria-pressed', 'true');
	// The effect: the canvas draws fewer bronnen; the chosen ones stay in the address.
	await expect.poll(async () => (await drawn(page).allInnerTexts()).length).toBeLessThan(all);
	const only = (await drawn(page).allInnerTexts()).length;
	await expect(page).toHaveURL(/netwerk=instruments\/bwbr0005537,instruments\/bwbr0010346/);

	await filter.click();
	await expect(page).not.toHaveURL(/omgeving=/);
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

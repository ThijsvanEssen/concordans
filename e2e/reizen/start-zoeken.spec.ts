// The start page and search: the scopes of Zoek in, the lanes of results, and a result that
// opens its bron.
import type { Page } from '@playwright/test';
import { expect, test } from '../support/test';

/** The results of a query, once the slow lanes (best result, judgments) are in. */
async function search(page: Page, q: string) {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.getByRole('combobox', { name: 'Zoeken' }).fill(q);
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('option').first()).toBeVisible({ timeout: 30_000 });
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	return results;
}

test('search lists its lanes and Enter opens the best result: art. 6:162 BW', async ({ page }) => {
	const results = await search(page, 'onrechtmatige daad');
	for (const lane of ['Wetten', 'Dossiers', 'Stemmingen'])
		await expect(results.getByRole('group', { name: lane })).toBeVisible();
	await expect(results.getByRole('option', { selected: true })).toContainText('6:162');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
	await expect(page.getByRole('heading', { level: 1 })).toContainText('6:162');
});

test('ontslag op staande voet finds the article of the Burgerlijk Wetboek', async ({ page }) => {
	const results = await search(page, 'ontslag op staande voet');
	await expect(results.getByRole('option', { name: /7:677/ }).first()).toBeVisible();
});

test('a motie of a fractie: the stukken it signed, and the lane says by whom', async ({ page }) => {
	const results = await search(page, 'motie stikstof VVD');
	const stukken = results.getByRole('group', { name: 'Stukken' });
	await expect(stukken.getByText(/^Gezocht in .*, door VVD/)).toBeVisible();
	await expect(stukken.getByRole('option').first()).toBeVisible();
	await expect(stukken).toContainText(/stikstof/i);
});

test('a scope narrows the search to its kind', async ({ page }) => {
	await page.goto('/');
	const scopes = page.getByRole('group', { name: 'Zoek in' });
	await scopes.getByRole('button', { name: 'Uitspraken' }).click();
	await expect(scopes.getByRole('button', { name: 'Uitspraken' })).toHaveAttribute(
		'aria-pressed',
		'true'
	);
	await page.getByRole('combobox', { name: 'Zoeken' }).fill('onrechtmatige daad');
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('option').first()).toBeVisible();
	await expect(results.getByRole('group', { name: 'Wetten' })).toHaveCount(0);
	await results.getByRole('option').first().click();
	await expect(page).toHaveURL(/\/uitspraken\/ECLI:/);
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('the start page promises, tries a search for you and answers three questions', async ({
	page
}) => {
	await page.goto('/');
	const main = page.getByRole('main');
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Zie hoe wetten, rechtspraak en parlement samenhangen.'
	);
	// The steps stand forward, in three parts.
	await expect(main.locator('ol.stappen li')).toHaveCount(3);
	// A trial search of the hint fills the field in place; the steps and questions give way.
	await main.getByRole('link', { name: 'Awb', exact: true }).click();
	await expect(page.getByRole('combobox', { name: 'Zoeken' })).toHaveValue('Awb');
	await expect(page).toHaveURL(/\/$/);
	await expect(main.locator('ol.stappen')).toHaveCount(0);
	await expect(main.getByRole('heading', { level: 2, name: 'Wat kun je ermee?' })).toHaveCount(0);
});

test('the first question of the start page opens an article with what refers to it', async ({
	page
}) => {
	await page.goto('/');
	const vragen = page.getByRole('region', { name: 'Wat kun je ermee?' });
	await expect(vragen.locator('.vragen__lijst').getByRole('heading', { level: 3 })).toHaveText([
		'Wie haalt dit artikel aan?',
		'Hoe stemde de Kamer?',
		'Wat onderzoek ik?'
	]);
	await vragen.getByRole('link', { name: /art\. 6:162 BW/ }).click();
	await expect(page.getByRole('heading', { level: 1 })).toContainText('6:162');
});

test('Ctrl K opens search from any page', async ({ page, touch }) => {
	test.skip(touch, 'a keyboard shortcut');
	await page.goto('/docs');
	await expect(page.getByRole('button', { name: /Zoeken/ })).toBeVisible();
	await page.keyboard.press('ControlOrMeta+k');
	const field = page.getByRole('dialog').getByRole('combobox');
	await expect(field).toBeFocused();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog')).toHaveCount(0);
});

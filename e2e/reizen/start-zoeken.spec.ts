// The start page and search: the scopes of Zoek in, the lanes of results, and a result that
// opens its bron.
import { expect, test } from '../support/test';

test('search lists its lanes and Enter opens the best result', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	await page.getByRole('combobox', { name: 'Zoeken' }).fill('onrechtmatige daad');
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	for (const lane of ['Wetten', 'Dossiers', 'Stemmingen'])
		await expect(results.getByRole('group', { name: lane })).toBeVisible();
	// The slow lanes (best result, judgments) come in later; the choice waits for them.
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	await expect(results.getByRole('option', { selected: true })).toContainText(
		'Wet conflictenrecht onrechtmatige daad'
	);
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0012408/);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText(
		'Wet conflictenrecht onrechtmatige daad'
	);
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

test('the start page leads into Samenhang, an article and a vote', async ({ page }) => {
	await page.goto('/');
	await expect(
		page.getByRole('region', { name: 'Artikel' }).getByRole('link').first()
	).toHaveAttribute('href', /\/wetten\//);
	await expect(page.getByRole('region', { name: 'Stemming' })).toContainText(/voor.*tegen/);
	await page.getByRole('region', { name: 'Artikel' }).getByRole('link').first().click();
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

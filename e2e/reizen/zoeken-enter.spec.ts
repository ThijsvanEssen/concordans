// Enter in the search with nothing chosen goes to the page of results of what is typed; a citation
// the API recognises opens, as a row chosen with the keys does (Thijs, 5 Nov). The fields the API adds (`best`,
// `exact`, `matched`, 0.80.5) are added to the recorded answers.
import type { Page } from '@playwright/test';
import { apiPath, CORS, patchApi } from '../support/api';
import { expect, test } from '../support/test';

type Body = Record<string, unknown>;
type Hit = Body & { id: string; key: string };

/** An answer as the new API gives it: `best` named (null for none), the rest as given. */
const named = (body: Body, more: Body = {}): Body => ({
	words: [],
	left_out: [],
	matched: 'all',
	best: null,
	...body,
	...more
});

async function searchFor(page: Page, q: string) {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
	const field = page.getByRole('combobox', { name: 'Zoeken' });
	await field.fill(q);
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	return { field, results };
}

/** The page of results asks the whole query in full: nothing recorded, so it is answered here. */
const emptyPage = (page: Page) =>
	page.route(apiPath(/limit=50/), (route) =>
		route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify(named({ q: '', types: [], total: 0, results: {}, searched: {} }))
		})
	);

/** ⌘K open, its field focused. */
async function palette(page: Page) {
	await page.goto('/wetten');
	const dialog = page.getByRole('dialog', { name: 'Zoekvenster' });
	const field = dialog.getByRole('combobox');
	await expect(async () => {
		if (!(await field.count())) await page.keyboard.press('ControlOrMeta+k');
		await expect(field).toBeFocused({ timeout: 1000 });
	}).toPass();
	return { dialog, field };
}

test('an exact article: Enter opens it, the row stands chosen', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) => named(body));
	const { field, results } = await searchFor(page, '6:162 BW');
	await expect(results.getByRole('option', { selected: true })).toContainText('6:162', {
		timeout: 30_000
	});
	await field.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
});

test('a citation that does not exist: Enter goes to the page of results', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) =>
		named(body, {
			results: {},
			searched: {},
			partial: {},
			resolved: { match: null, notation: { kind: 'article', value: '6:162 BW' } }
		})
	);
	const { field, results } = await searchFor(page, '6:162 BW');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	await emptyPage(page);
	await field.press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=6%3A162(%20|\+)BW/);
});

test('words: Enter goes to the page of results, no row chosen, no hit above the groups', async ({
	page
}) => {
	await patchApi(page, /\/api\/search/, (body) => named(body));
	const { field, results } = await searchFor(page, 'huurverhoging');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	await expect(results.getByText('Beste treffer')).toHaveCount(0);
	await emptyPage(page);
	await field.press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=huurverhoging/);
});

test('⌘K: the right column says what Enter does, and shows the row chosen without moving', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has the one column');
	const { dialog, field } = await palette(page);
	await field.fill('onrechtmatige daad');
	const results = dialog.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('option').first()).toBeVisible({ timeout: 30_000 });
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	const preview = dialog.getByRole('complementary', { name: 'Voorbeeld' });
	await expect(preview).toContainText('zoekt "onrechtmatige daad" op de zoekpagina');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	const before = (await dialog.boundingBox())!;

	await page.keyboard.press('ArrowDown');
	const chosen = results.getByRole('option', { selected: true });
	await expect(chosen).toHaveCount(1);
	await expect(preview).toContainText(/Enter\s+opent/);
	await expect(preview).not.toContainText('zoekpagina');
	for (const action of ['Keten', 'Netwerk'])
		await expect(preview.getByRole('button', { name: action, exact: true })).toBeVisible();
	await expect(preview).toContainText('Alt');
	expect((await dialog.boundingBox())!.height).toBe(before.height);

	// The key of an action does it on the row chosen.
	await page.keyboard.press('Alt+KeyN');
	await expect(page).toHaveURL(/mode=netwerk/);
});

test('⌘K: the right column shows a citation Enter opens, and says so', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has the one column');
	const { dialog, field } = await palette(page);
	await field.fill('6:162 BW');
	const preview = dialog.getByRole('complementary', { name: 'Voorbeeld' });
	await expect(preview).toContainText(/Enter\s+opent/, { timeout: 30_000 });
	await expect(preview).not.toContainText('zoekpagina');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
});

test('hits with only some of the words say so', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) =>
		named(body, { matched: 'any', left_out: ['de'], words: ['toezeggingen', 'pensioenen'] })
	);
	const { results } = await searchFor(page, 'toezeggingen pensioenen');
	await expect(results.getByText('treffers met een deel van de woorden').first()).toBeVisible();
	await expect(results.getByText('Weggelaten: de')).toBeVisible();
});

test('nothing found offers a way on instead of bare text', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) =>
		named(body, { results: {}, resolved: null, searched: {}, partial: {} })
	);
	const { results } = await searchFor(page, 'xqzvbnm qwertzpl');
	await expect(results.getByText('Geen resultaten voor "xqzvbnm qwertzpl"')).toBeVisible();
	await expect(results.getByRole('button', { name: 'Pas de zoekterm aan' })).toBeVisible();
	await results.getByRole('button', { name: 'Zoek "qwertzpl"' }).click();
	await expect(page.getByRole('combobox', { name: 'Zoeken' })).toHaveValue('qwertzpl');
	await expect(results.getByText('Geen resultaten voor "qwertzpl"')).toBeVisible();
});

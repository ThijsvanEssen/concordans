// Enter in the search jumps only for what the query names exactly (besluit 30): a citation,
// an identifier, a law by its name. Words keep the list open. The API that says so (`best`,
// `exact`, `matched`, 0.80.5) is not live yet: its fields are added to the recorded answers.
import type { Page } from '@playwright/test';
import { patchApi } from '../support/api';
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

test('an exact article: Enter opens it', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) => {
		const articles = ((body.results as Record<string, Hit[]>)?.articles ?? []) as Hit[];
		const exact = articles.find((h) => h.key.endsWith('_art162'));
		if (!exact) return named(body);
		exact.exact = true;
		return named(body, { best: exact.id });
	});
	const { results } = await searchFor(page, '6:162 BW');
	await expect(results.getByRole('option', { selected: true })).toContainText('6:162');
	await page.keyboard.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0005289\/artikel\/6:162/);
});

test('words name nothing: Enter opens nothing and chooses the first row', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) => named(body));
	const { field, results } = await searchFor(page, 'huurverhoging');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	await expect(results.getByText('Beste treffer')).toHaveCount(0);
	await field.press('Enter');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(1);
	await expect(page).toHaveURL(/\/$/);
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

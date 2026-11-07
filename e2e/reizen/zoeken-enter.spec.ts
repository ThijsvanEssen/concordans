// Enter in the search with nothing chosen goes to the page of results of what is typed; a citation
// the API recognises opens, as a row chosen with the keys does (Thijs, 5 Nov). The fields the API adds (`best`,
// `exact`, `matched`, 0.80.5) are added to the recorded answers.
import type { Page } from '@playwright/test';
import { apiPath, CORS, patchApi } from '../support/api';
import { expect, test } from '../support/test';

type Body = Record<string, unknown>;

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

/** ⌘K with `q` typed and every answer in: the live answer has Wetten asked again in full. */
async function paletteWithAllIn(page: Page, q: string) {
	const { dialog, field } = await palette(page);
	await field.fill(q);
	const results = dialog.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('group', { name: /Wetten/ })).toBeVisible({ timeout: 30_000 });
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	return { dialog, field, results };
}

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
	await expect(results.getByRole('status')).toContainText('"6:162 BW"');
	await expect(results.getByRole('option')).toHaveCount(0);
	await emptyPage(page);
	await field.press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=6%3A162(%20|\+)BW/);
});

test('a law by its name: no row above the groups, the group Wetten leads', async ({ page }) => {
	const law = {
		id: 'instruments/bwbr0006299',
		key: 'bwbr0006299',
		collection: 'instruments',
		display_name: 'Politiewet 1993'
	};
	await page.route(apiPath(/\/api\/search/), (route) =>
		route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify(
				named({
					q: 'Politiewet',
					types: [],
					total: 1,
					results: { instruments: [law] },
					searched: {},
					resolved: {
						match: {
							kind: 'instrument',
							collection: 'instruments',
							key: law.key,
							display_name: law.display_name
						},
						notation: null
					}
				})
			)
		})
	);
	const { field, results } = await searchFor(page, 'Politiewet');
	await expect(results.getByRole('option')).toHaveCount(1);
	await expect(results.getByRole('group', { name: /Wetten/ }).getByRole('option')).toHaveCount(1);
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	await emptyPage(page);
	await field.press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=Politiewet/);
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
	const { dialog, results } = await paletteWithAllIn(page, 'onrechtmatige daad');
	const preview = dialog.getByRole('complementary', { name: 'Voorbeeld' });
	await expect(preview).toContainText('zoekt "onrechtmatige daad" op de zoekpagina');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	const before = (await dialog.boundingBox())!;

	await page.keyboard.press('ArrowDown');
	const chosen = results.getByRole('option', { selected: true });
	await expect(chosen).toHaveCount(1);
	await expect(preview).toContainText(/Enter\s+opent/);
	await expect(preview).not.toContainText('laden…');
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

test('the pointer on a row: it lights, Enter goes to the page of results', async ({ page }) => {
	await patchApi(page, /\/api\/search/, (body) => named(body));
	const { field, results } = await searchFor(page, 'huurverhoging');
	await results.getByRole('option').first().hover();
	await expect(results.locator('.is-active')).toHaveCount(1);
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	await emptyPage(page);
	await field.press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=huurverhoging/);
});

test('⌘K: the pointer shows a row in the column, a click opens it, Enter searches', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no pointer and no column');
	const { dialog, field, results } = await paletteWithAllIn(page, 'onrechtmatige daad');
	const row = results.getByRole('option').first();
	const preview = dialog.getByRole('complementary', { name: 'Voorbeeld' });
	await row.hover();
	await expect(row).toHaveClass(/is-active/);
	await expect(preview).not.toContainText('laden…');
	await expect(results.getByRole('option', { selected: true })).toHaveCount(0);
	await expect(row).not.toContainText('↵');
	await expect(preview.getByRole('button', { name: 'Netwerk', exact: true })).toBeVisible();
	await expect(preview).toContainText('zoekt "onrechtmatige daad" op de zoekpagina');
	await expect(preview).not.toContainText(/Enter\s+opent/);
	await emptyPage(page);
	await field.press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=onrechtmatige/);
});

test('the pointer and then ↓: the next row stands chosen, and the column says Enter opens it', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no pointer');
	const { dialog, results } = await paletteWithAllIn(page, 'onrechtmatige daad');
	const rows = results.getByRole('option');
	await rows.first().hover();
	await page.keyboard.press('ArrowDown');
	await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
	await expect(rows.first()).not.toHaveClass(/is-active/);
	const preview = dialog.getByRole('complementary', { name: 'Voorbeeld' });
	await expect(preview).toContainText(/Enter\s+opent/);
	await expect(preview).not.toContainText('laden…');
});

test('a slower answer after ↓ comes in under the rows: Enter opens the bron that was chosen', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no ↓');
	const article = {
		id: 'articles/bwbr0005289_162',
		key: 'bwbr0005289_162',
		collection: 'articles',
		display_name: 'Artikel 6:162 BW',
		extra: { bwb_id: 'BWBR0005289', number: '6:162' }
	};
	const law = {
		id: 'instruments/bwbr0032904',
		key: 'bwbr0032904',
		collection: 'instruments',
		display_name: 'Politiewet 1993',
		extra: { bwb_id: 'BWBR0032904' }
	};
	let articlesIn = () => {};
	const articles = new Promise<void>((resolve) => (articlesIn = resolve));
	await page.route(apiPath(/\/api\/search/), async (route) => {
		const types = new URL(route.request().url()).searchParams.getAll('types').join(',');
		const fast = types.includes('instruments');
		if (!fast && types.includes('articles')) await articles;
		const results = fast
			? { instruments: [law] }
			: types.includes('articles')
				? { articles: [article] }
				: {};
		await route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify(
				named({ q: 'onrechtmatig', types: [], total: 1, results, searched: {}, resolved: null })
			)
		});
	});
	const { field } = await palette(page);
	await field.fill('onrechtmatig');
	const dialog = page.getByRole('dialog', { name: 'Zoekvenster' });
	const results = dialog.getByRole('listbox', { name: 'Resultaten' });
	// The slower lanes wait for the fast one; once it is in, the rows stay where they are.
	await expect(results.getByRole('option')).toHaveCount(1, { timeout: 30_000 });
	await page.keyboard.press('ArrowDown');
	const chosen = results.getByRole('option', { selected: true });
	await expect(chosen).toContainText('Politiewet');

	articlesIn();
	await expect(results.getByRole('option')).toHaveCount(2);
	await expect(results.getByRole('option').first()).toContainText('Politiewet');
	await expect(chosen).toContainText('Politiewet');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0032904/);
});

test('the rows wait for the full answer, not for the live one: Enter opens the bron chosen', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has no ↓');
	const law = (number: string) => ({
		id: `instruments/bwbr${number}`,
		key: `bwbr${number}`,
		collection: 'instruments',
		display_name: `Wet ${number}`,
		extra: { bwb_id: `BWBR${number}` }
	});
	const LIVE = ['0012408', '0032904', '0005289'];
	const FULL = ['0005289', '0006299', '0006622', '0012408', '0032904'];
	let fullIn = () => {};
	const full = new Promise<void>((resolve) => (fullIn = resolve));
	await page.route(apiPath(/\/api\/search/), async (route) => {
		const params = new URL(route.request().url()).searchParams;
		const fast = params.getAll('types').includes('instruments');
		const inFull = params.get('mode') === 'full';
		if (fast && inFull) await full;
		const numbers = !fast ? [] : inFull ? FULL : LIVE;
		await route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify(
				named({
					q: 'wvw',
					types: [],
					total: numbers.length,
					results: fast ? { instruments: numbers.map(law) } : {},
					searched: {},
					resolved: null,
					// Left out of the live answer and not found in it: asked again in full.
					partial: fast && !inFull ? { dossiers: true } : {}
				})
			)
		});
	});
	const { dialog, field } = await palette(page);
	await field.fill('wvw');
	const results = dialog.getByRole('listbox', { name: 'Resultaten' });
	const rows = results.getByRole('option');
	// The live answer left kinds out: the fast lane asks again in full and shows nothing before.
	await expect(rows).toHaveCount(0);
	fullIn();
	await expect(rows).toHaveCount(FULL.length, { timeout: 30_000 });
	for (let i = 0; i < FULL.length; i++) await page.keyboard.press('ArrowDown');
	const chosen = results.getByRole('option', { selected: true });
	await expect(chosen).toContainText('Wet 0032904');
	await field.press('Enter');
	await expect(page).toHaveURL(/\/wetten\/BWBR0032904/);
});

test('⌘K: a long description leaves the name of the bron in the column', async ({
	page,
	isMobile
}) => {
	test.skip(isMobile, 'a phone has the one column');
	await patchApi(page, /\/api\/nodes\/instruments\/bwbr00(12408|32904)/, (body) => {
		const node = body.node as { props: Record<string, unknown> };
		node.props.official_title = 'Een hele lange officiële titel van deze wet, '.repeat(30);
		return body;
	});
	const { dialog, results } = await paletteWithAllIn(page, 'onrechtmatige daad');
	await page.keyboard.press('ArrowDown');
	const preview = dialog.getByRole('complementary', { name: 'Voorbeeld' });
	await expect(preview).toContainText('Een hele lange officiële titel');
	const title = preview.locator('.title');
	const height = (await title.boundingBox())!.height;
	expect(height).toBeGreaterThan(15);
	await expect(results.getByRole('option', { selected: true })).toContainText(
		(await title.innerText()).slice(0, 12)
	);
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

// The page of results (besluit 31): Enter on words goes to /zoeken, which shows the hits per
// soort, says "via begrip" for a hit the curated list found, and has a page for nothing found.
// The API's answers are made here: the page asks the whole query in full, with a limit the
// recordings of the dropdown do not hold.
import type { Page } from '@playwright/test';
import { apiPath, CORS } from '../support/api';
import { expect, test } from '../support/test';
import { openFilter } from '../support/filters';

type Body = Record<string, unknown>;

const article = (n: number, more: Body = {}) => ({
	id: `articles/bwbr0005289_${n}`,
	key: `bwbr0005289_${n}`,
	collection: 'articles',
	type: 'article',
	display_name: `Art. 6:${n} BW`,
	snippet: `Een tekortkoming in de nakoming ${n}`,
	score: 0.1,
	exact: false,
	concept: null,
	extra: { bwb_id: 'BWBR0005289', article_number: String(n), heading: null },
	path: null,
	...more
});

const judgment = (n: number, court: string, year: number) => ({
	id: `judgments/ecli_nl_${court.toLowerCase()}_${year}_${n}`,
	key: `ecli_nl_${court.toLowerCase()}_${year}_${n}`,
	collection: 'judgments',
	type: 'judgment',
	display_name: `Uitspraak ${n}`,
	snippet: 'Wanprestatie. Onrechtmatige daad.',
	score: 0.1,
	exact: false,
	concept: null,
	extra: { ecli: `ECLI:NL:${court}:${year}:${n}`, names: [] },
	path: null
});

/** The answer of /api/search for the types asked: `results` per type, nothing for the rest. */
async function answerSearch(page: Page, results: Record<string, unknown[]>, more: Body = {}) {
	await page.route(apiPath(/\/api\/search/), async (route) => {
		const types = new URL(route.request().url()).searchParams.getAll('types');
		const mine = Object.fromEntries(types.map((t) => [t, results[t] ?? []]));
		await route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify({
				q: '',
				types,
				total: 0,
				results: mine,
				partial: {},
				searched: {},
				resolved: null,
				words: [],
				left_out: [],
				matched: 'all',
				best: null,
				...more
			})
		});
	});
}

test('words end on the page of results, with the hits per soort', async ({ page }) => {
	await answerSearch(page, {
		articles: [article(74), article(75)],
		judgments: [judgment(1, 'HR', 2019), judgment(2, 'RBAMS', 2019), judgment(3, 'HR', 2005)]
	});
	await page.goto('/');
	await page.getByRole('combobox', { name: 'Zoeken' }).fill('wanprestatie');
	await expect(
		page.getByRole('listbox', { name: 'Resultaten' }).getByRole('group').first()
	).toBeVisible();
	await page.getByRole('combobox', { name: 'Zoeken' }).press('Enter');
	await expect(page).toHaveURL(/\/zoeken\?q=wanprestatie/);
	await expect(page.getByRole('heading', { level: 1, name: 'Zoeken' })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: /Artikelen/ })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: /Uitspraken/ })).toBeVisible();
	await expect(page.getByRole('link', { name: /Artikel 6:74/ })).toBeVisible();
	await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex');
});

test('a soort and an instantie narrow the hits, in the address', async ({ page, touch }) => {
	await answerSearch(page, {
		judgments: [judgment(1, 'HR', 2019), judgment(2, 'RBAMS', 2019), judgment(3, 'HR', 2005)]
	});
	await page.goto('/zoeken?q=wanprestatie');
	// On a phone the filters wait in the sheet of Verfijnen.
	const option = await openFilter(page, touch, 'Soort');
	await option(/Uitspraken/).click();
	await expect(page).toHaveURL(/soort=judgments/);
	await expect(page.getByRole('link', { name: /ECLI:NL/ })).toHaveCount(3);
	await page.goto('/zoeken?q=wanprestatie&soort=judgments&instantie=HR');
	await expect(page.getByRole('link', { name: /ECLI:NL/ })).toHaveCount(2);
});

test('a hit found by a begrip says so', async ({ page }) => {
	await answerSearch(page, {
		articles: [article(74, { concept: 'wanprestatie', exact: true }), article(75)]
	});
	await page.goto('/zoeken?q=wanprestatie');
	await expect(page.getByText('via begrip wanprestatie')).toHaveCount(1);
});

test('nothing found has a page that offers a way on', async ({ page }) => {
	await answerSearch(page, {});
	await page.goto('/zoeken?q=xqzvbnm+qwertzpl');
	await expect(page.getByText('Geen resultaten voor "xqzvbnm qwertzpl"')).toBeVisible();
	await page.getByRole('link', { name: 'Zoek "qwertzpl"' }).click();
	await expect(page).toHaveURL(/q=qwertzpl/);
	await expect(page.getByText('Geen resultaten voor "qwertzpl"')).toBeVisible();
});

test('the source of a hit is a word wide, not squeezed to a letter by a long text', async ({
	page,
	touch
}) => {
	test.skip(touch, 'on a phone the source stands under the text');
	const lang =
		'Iedere tekortkoming in de nakoming van een verbintenis verplicht de schuldenaar '.repeat(4);
	await answerSearch(page, {
		articles: [
			article(74, {
				snippet: lang,
				extra: {
					bwb_id: 'BWBR0005289',
					article_number: '74',
					citation_title: 'Uitvoeringsregeling Ikoa'
				}
			})
		]
	});
	await page.goto('/zoeken?q=wanprestatie');
	const bron = page.locator('.rij .context').first();
	await expect(bron).toBeVisible();
	const tekst = ((await bron.textContent()) ?? '').trim();
	const doos = (await bron.boundingBox())!;
	// One line, as wide as its text: not a column of single letters.
	expect(doos.width).toBeGreaterThan(tekst.length * 4);
	expect(doos.height).toBeLessThan(30);
});

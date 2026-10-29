// The groups of a search: the Beste treffer on top, under it the groups in their order, but a
// group with a whole name or an identifier (score 0.75 or more) goes up on that score. The order
// stands once the fast lane is in; the slow lanes (text, judgments) come in under their places.
// The API's answers are made here: a Kamerlid found by the whole name needs API R2.
import type { Page } from '@playwright/test';
import { apiPath, CORS } from '../support/api';
import { expect, test } from '../support/test';

type Body = Record<string, unknown>;

const hit = (
	collection: string,
	key: string,
	name: string,
	score: number,
	extra: Body = {},
	exact = false
) => ({
	id: `${collection}/${key}`,
	key,
	collection,
	type: collection,
	display_name: name,
	snippet: null,
	score,
	exact,
	concept: null,
	extra,
	path: null
});

const RESULTS: Record<string, unknown[]> = {
	members: [
		hit('members', 'dilan_yesilgoz', 'Dilan Yeşilgöz-Zegerius', 0.75, {}, true),
		hit('members', 'yesil_ander', 'A. Yeşil', 0.5)
	],
	dossiers: [hit('dossiers', '36000', 'Wet op de veiligheid', 0.1)],
	articles: [hit('articles', 'bwbr0005289_74', 'Art. 6:74 BW', 0.1, { bwb_id: 'BWBR0005289' })],
	judgments: [
		hit('judgments', 'ecli_nl_hr_2019_1', 'Uitspraak 1', 0.1, { ecli: 'ECLI:NL:HR:2019:1' })
	]
};

/** Answers /api/search per type asked; a lane in `slow` waits that long (ms). */
async function answer(page: Page, slow: Record<string, number> = {}) {
	await page.route(apiPath(/\/api\/search/), async (route) => {
		const types = new URL(route.request().url()).searchParams.getAll('types');
		const wait = Math.max(0, ...types.map((t) => slow[t] ?? 0));
		if (wait) await new Promise((r) => setTimeout(r, wait));
		await route.fulfill({
			status: 200,
			headers: { ...CORS, 'content-type': 'application/json' },
			body: JSON.stringify({
				q: '',
				types,
				total: 0,
				results: Object.fromEntries(types.map((t) => [t, RESULTS[t] ?? []])),
				partial: {},
				searched: {},
				resolved: null,
				words: [],
				left_out: [],
				matched: 'all',
				best: 'members/dilan_yesilgoz'
			})
		});
	});
}

const headings = (page: Page) => page.getByRole('heading', { level: 2 }).allTextContents();
const first = (list: string[], re: RegExp) => list.findIndex((t) => re.test(t));

test('/zoeken: the Beste treffer on top, the group with a whole name before the text', async ({
	page
}) => {
	await answer(page);
	await page.goto('/zoeken?q=Yesilgoz');
	await expect(page.getByRole('heading', { level: 2, name: /Beste treffer/ })).toBeVisible();
	await expect(page.getByRole('heading', { level: 2, name: /Artikelen/ })).toBeVisible();
	const list = await headings(page);
	expect(first(list, /Beste treffer/)).toBe(0);
	expect(first(list, /Kamerleden|Leden/)).toBe(1);
	expect(first(list, /Kamerleden|Leden/)).toBeLessThan(first(list, /Artikelen/));
	expect(first(list, /Kamerleden|Leden/)).toBeLessThan(first(list, /Dossiers/));
});

test('/zoeken: a slow lane comes in under its place and moves no group', async ({ page }) => {
	await answer(page, { judgments: 1500 });
	await page.goto('/zoeken?q=Yesilgoz');
	await expect(page.getByRole('heading', { level: 2, name: /Kamerleden|Leden/ })).toBeVisible();
	const before = await headings(page);
	await expect(page.getByRole('heading', { level: 2, name: /Beste treffer, / })).toBeVisible({
		timeout: 10_000
	});
	const after = await headings(page);
	const kept = after.filter((t) => before.includes(t) && !/^Beste treffer/.test(t));
	expect(kept).toEqual(before.filter((t) => kept.includes(t)));
});

test('the typeahead has the same order', async ({ page }) => {
	await answer(page);
	await page.goto('/');
	await page.getByRole('combobox', { name: 'Zoeken' }).fill('Yesilgoz');
	const results = page.getByRole('listbox', { name: 'Resultaten' });
	await expect(results.getByRole('group').first()).toBeVisible();
	await expect(results.getByRole('group', { name: /laden…$/ })).toHaveCount(0, { timeout: 30_000 });
	const names = await results
		.getByRole('group')
		.evaluateAll((els) =>
			els.map((e) => e.querySelector('.group-label')?.textContent?.trim() ?? '')
		);
	expect(names[0]).toMatch(/^Beste treffer/);
	expect(first(names, /Kamerleden|Leden/)).toBe(1);
	expect(first(names, /Kamerleden|Leden/)).toBeLessThan(first(names, /Artikelen/));
});

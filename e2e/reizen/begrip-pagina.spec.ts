// The page of a begrip (B180, B180b): its articles, then every judgment and paper that cites
// or explains them, each list with its filters in the address. The API's answers are made
// here: the lists take filters and a page size the recordings do not hold.
import type { Page } from '@playwright/test';
import { apiPath, CORS } from '../support/api';
import { expect, test } from '../support/test';

const json = (body: unknown) => ({
	status: 200,
	headers: { ...CORS, 'content-type': 'application/json' },
	body: JSON.stringify(body)
});

const judgment = (n: number, year: number) => ({
	judgment: {
		id: `judgments/ecli_nl_hr_${year}_${n}`,
		key: `ecli_nl_hr_${year}_${n}`,
		ecli: `ECLI:NL:HR:${year}:${n}`,
		court: 'HR',
		tier: 'hoge_raad',
		date: `${year}-03-01`,
		display_name: `Hoge Raad ${year}-03-01 / 2${n}/01`,
		inbound_citation_count: n,
		subject_areas: []
	},
	article_ids: ['articles/bwbr0001840_93']
});

const CONCEPT = {
	key: 'toetsing-van-wetten',
	name: 'Toetsing van wetten',
	explanation: { label: 'Rijksoverheid', url: 'https://www.rijksoverheid.nl/x' },
	articles: [
		{
			id: 'articles/bwbr0001840_93',
			key: 'bwbr0001840_93',
			display_name: 'Art. 93 Gw',
			heading: null,
			opening: 'Bepalingen van verdragen',
			judgment_total: 3,
			path: '/wetten/BWBR0001840/artikel/93'
		},
		{
			id: 'articles/bwbr0001840_94',
			key: 'bwbr0001840_94',
			display_name: 'Art. 94 Gw',
			heading: null,
			opening: 'Wettelijke voorschriften',
			judgment_total: 2,
			path: '/wetten/BWBR0001840/artikel/94'
		}
	],
	missing: [],
	judgment_total: 3,
	judgments: [],
	document_total: 0,
	documents: []
};

/** The three routes of a concept; the judgments answer by the `year` they are asked for. */
async function answerConcept(page: Page, asked: string[]) {
	await page.route(apiPath(/\/api\/concepts\/toetsing-van-wetten$/), (r) =>
		r.fulfill(json(CONCEPT))
	);
	await page.route(apiPath(/\/api\/concepts\/toetsing-van-wetten\/judgments/), (route) => {
		const q = new URL(route.request().url()).searchParams;
		asked.push(q.toString());
		const all = [judgment(1, 2024), judgment(2, 2023), judgment(3, 2024)];
		const items = q.get('year')
			? all.filter((j) => j.judgment.date.startsWith(q.get('year')!))
			: all;
		return route.fulfill(
			json({
				key: 'toetsing-van-wetten',
				total: items.length,
				facets: {
					year: [
						{ value: '2024', count: 2 },
						{ value: '2023', count: 1 }
					],
					tier: [{ value: 'hoge_raad', count: 3 }],
					subject_area: []
				},
				items
			})
		);
	});
	await page.route(apiPath(/\/api\/concepts\/toetsing-van-wetten\/documents/), (r) =>
		r.fulfill(json({ key: 'toetsing-van-wetten', total: 0, items: [] }))
	);
}

test('the page lists the judgments and a year in the address narrows them', async ({
	page,
	touch
}) => {
	const asked: string[] = [];
	await answerConcept(page, asked);
	await page.goto('/begrippen/toetsing-van-wetten');
	await expect(page.getByRole('heading', { level: 1, name: 'Toetsing van wetten' })).toBeVisible();
	await expect(page.getByText('Begrip, bijgehouden door Concordans')).toBeVisible();
	await expect(page.getByRole('link', { name: /ECLI:NL:HR:/ })).toHaveCount(3);

	await page.goto('/begrippen/toetsing-van-wetten?jaar=2023');
	await expect(page.getByRole('link', { name: /ECLI:NL:HR:/ })).toHaveCount(1);
	expect(asked.some((q) => q.includes('year=2023'))).toBe(true);
	// The filter is a button of the bar, on a phone behind Filter.
	await expect(
		page.getByRole('button', { name: touch ? /^Filter/ : /^Jaar/ }).first()
	).toBeVisible();
});

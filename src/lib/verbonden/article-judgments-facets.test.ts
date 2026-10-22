// The judgments that cite an article, as the API counts them since #895: the year and the
// rechter of the bronfilter are asked of the API, whose total and facets are those of the
// whole group (B7, B25), and Meest aangehaald says how often a judgment is cited itself (B6).
import { describe, expect, it } from 'vitest';
import { fakeApi } from '$lib/test/fakeApi';
import { EMPTY_FILTER } from './filter';
import { DEFAULT_LOADER_OPTIONS, LOADERS, type LoaderContext, type LoaderOptions } from './loaders';
import { rowsOfCitedBy } from './cited-by';
import { hoeVan } from './hoe';
import { filterGroups } from './view';
import type { Group } from './groups';

const ARTICLE = { bwb_id: 'BWBR0005537', article_number: '3:4' };
const ROUTE = '/api/articles/{bwb_id}/{article_number}/cited-by';

const item = (
	key: string,
	cited: number,
	paragraph = '3.1',
	tier = 'hoge_raad',
	date = '2020-01-10'
) => ({
	judgment: { key, ecli: key, date, tier, inbound_citation_count: cited },
	paragraph_number: paragraph,
	text: 'artikel 3:4',
	confidence: 1
});

const run = (options: Partial<LoaderOptions> = {}) =>
	LOADERS['article-judgments']({
		node: { id: 'articles/x', key: 'x', props: ARTICLE } as LoaderContext['node'],
		neighbors: [],
		totals: new Map(),
		buren: async () => [],
		signal: new AbortController().signal,
		options: { ...DEFAULT_LOADER_OPTIONS, ...options }
	});

const FACETS = {
	year: [
		{ value: null, count: 2 },
		{ value: '2019', count: 300 },
		{ value: '2020', count: 800 }
	],
	tier: [
		{ value: 'hoge_raad', count: 700 },
		{ value: 'parket', count: 50 },
		{ value: 'rechtbank', count: 300 },
		{ value: 'andere_instantie', count: 52 }
	]
};

describe('the judgments that cite an article, over the whole group', () => {
	it('takes the years and the rechters from the facets, not from the page loaded', async () => {
		fakeApi({
			[ROUTE]: {
				total: 2000,
				judgment_total: 1102,
				echr_judgment_total: 0,
				items: [item('a', 168)],
				facets: FACETS
			}
		});
		const found = await run();
		expect(found.total).toBe(1102);
		// A year without a date has no bar; the oldest first.
		expect(found.years).toEqual([
			{ year: 2019, count: 300 },
			{ year: 2020, count: 800 }
		]);
		// The Hoge Raad with the Parket; a tier no rechter names is left out.
		expect(found.rechters).toEqual({ hr: 750, rechtbank: 300 });
		expect(found.cutBy).toEqual(['jaar', 'rechter']);
	});

	it('asks the year and the rechter of the API, the tiers as a list', async () => {
		const api = fakeApi({
			[ROUTE]: { total: 1, judgment_total: 1, echr_judgment_total: 0, items: [], facets: FACETS }
		});
		await run({ year: 2020, rechter: 'hr' });
		expect(api.asked(ROUTE)[0].query).toMatchObject({
			year: '2020',
			tier: ['hoge_raad', 'parket']
		});
	});

	it('leaves the cutting to the rows on an API without facets', async () => {
		fakeApi({
			[ROUTE]: {
				total: 1,
				judgment_total: 1,
				echr_judgment_total: 0,
				items: [item('a', 3)]
			}
		});
		const found = await run({ year: 2020 });
		expect(found.cutBy).toBeUndefined();
		expect(found.years).toBeUndefined();
		expect(found.rechters).toBeUndefined();
	});

	it('holds the API total under the year and the rechter it asked, not under another filter', () => {
		const group: Group = {
			id: 'judgments',
			label: 'Uitspraken die dit artikel aanhalen',
			rows: rowsOfCitedBy([item('a', 3) as never]),
			total: 750,
			capped: false,
			cutBy: ['jaar', 'rechter']
		};
		const asked = { ...EMPTY_FILTER, jaar: 2020, rechter: 'hr' as const };
		expect(filterGroups([group], asked)[0].total).toBe(750);
		expect(filterGroups([group], { ...asked, zoek: 'x' })[0]?.total).toBeUndefined();
		expect(filterGroups([{ ...group, cutBy: undefined }], asked)[0].total).toBeUndefined();
	});
});

describe('Meest aangehaald (B6)', () => {
	const line = (items: unknown[], withCount: boolean) => {
		const [row] = rowsOfCitedBy(items as never, withCount);
		return { row, hoe: hoeVan({ ...row, edge: {} }, 'articles') };
	};

	it('says how often the judgment is cited itself, not how often it names the article', () => {
		const { row, hoe } = line([item('a', 168), item('a', 168, '4.2')], true);
		expect(row.cited).toBe(168);
		expect(hoe?.rest).toContain('zelf 168 keer aangehaald');
		expect(hoe?.rest).not.toMatch(/2 keer/);
	});

	it('says nothing of how often it is cited when it is not, in the order by authority', () => {
		const { hoe } = line([item('a', 0)], true);
		expect(hoe?.rest ?? '').not.toMatch(/keer/);
	});

	it('keeps the places it names the article in the order by date', () => {
		const { row, hoe } = line([item('a', 168), item('a', 168, '4.2')], false);
		expect(row.cited).toBeNull();
		expect(hoe?.rest).toContain('2 keer');
		expect(hoe?.rest).not.toMatch(/zelf/);
	});
});

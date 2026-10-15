import { describe, expect, it } from 'vitest';
import { fakeApi, fail, type FakeRequest } from '$lib/test/fakeApi';
import { faceted, type FacetedPath, type FacetsApart } from './faceted';

const settle = () => new Promise((r) => setTimeout(r));

/** The facets kept by the list, or the reason they did not come. */
function list() {
	const facets: unknown[] = [];
	const failed: unknown[] = [];
	const rows: { items: unknown; offset: number }[] = [];
	const apart: FacetsApart = (ask, set, signal) => {
		ask()
			.then((r) => {
				if (!signal.aborted) set(r);
			})
			.catch((e) => failed.push(e));
	};
	return { facets, failed, rows, apart };
}

const answer = (items: unknown[], tag: string) => ({ items, total: 2, facets: { tag } });

// The five lists as IndexView asks them: filters of their own, the page and facets from here.
const LISTS: [FacetedPath, Record<string, unknown>][] = [
	['/api/instruments', { q: 'huur', jurisdiction: 'nl', sort: 'title', limit: 100 }],
	['/api/judgments', { source: 'rechtspraak', from: '2020-01-01', limit: 100 }],
	['/api/dossiers', { status: 'open', subject: 'wonen', limit: 100 }],
	['/api/documents', { chamber: 'tk', kind: 'Motie', limit: 100 }],
	['/api/commitments', { status: 'open', q: 'stikstof', limit: 100 }]
];

describe('a faceted list', () => {
	it.each(LISTS)('%s asks its facets apart, then its rows, on the first page', async (path, q) => {
		const api = fakeApi({
			[path]: ({ params }: FakeRequest) =>
				params.query?.facets ? answer([{ id: 'f' }], 'facets') : answer([{ id: 'a' }], 'rows')
		});
		const l = list();
		const fetch = faceted(path, q as never, l.apart, (f) => l.facets.push(f.facets));
		l.rows.push({ items: (await fetch(0, new AbortController().signal)).items, offset: 0 });
		await settle();
		expect(api.asked(path)).toEqual([
			{ query: { ...q, offset: 0, limit: 1, facets: true } },
			{ query: { ...q, offset: 0, facets: false } }
		]);
		expect(l.facets).toEqual([{ tag: 'facets' }]);
		expect(l.rows).toEqual([{ items: [{ id: 'a' }], offset: 0 }]);
	});

	it.each(LISTS)('%s asks only its rows on a later page', async (path, q) => {
		const api = fakeApi({ [path]: answer([{ id: 'b' }], 'rows') });
		const l = list();
		const fetch = faceted(path, q as never, l.apart, (f) => l.facets.push(f));
		l.rows.push({ items: (await fetch(100, new AbortController().signal)).items, offset: 100 });
		await settle();
		expect(api.asked(path)).toEqual([{ query: { ...q, offset: 100, facets: false } }]);
		expect(l.facets).toEqual([]);
		expect(l.rows).toEqual([{ items: [{ id: 'b' }], offset: 100 }]);
	});

	it('shows the rows before the facets are counted', async () => {
		let count = () => {};
		const counted = new Promise<void>((r) => (count = r));
		fakeApi({
			'/api/judgments': async ({ params }: FakeRequest) => {
				if (!params.query?.facets) return answer([{ id: 'a' }], 'rows');
				await counted;
				return answer([], 'facets');
			}
		});
		const l = list();
		const fetch = faceted('/api/judgments', { limit: 100 }, l.apart, (f) =>
			l.facets.push(f.facets)
		);
		l.rows.push({ items: (await fetch(0, new AbortController().signal)).items, offset: 0 });
		expect(l.rows).toHaveLength(1);
		expect(l.facets).toEqual([]);
		count();
		await settle();
		expect(l.facets).toEqual([{ tag: 'facets' }]);
	});

	it('asks the facets with the time of a search (slowApi, 30 s), the rows as any list (#80)', async () => {
		const api = fakeApi({
			'/api/judgments': ({ params }: FakeRequest) =>
				params.query?.facets ? answer([], 'facets') : answer([{ id: 'a' }], 'rows')
		});
		const l = list();
		await faceted('/api/judgments', { from: '2025-10-14', limit: 100 }, l.apart, () => {})(
			0,
			new AbortController().signal
		);
		expect(api.requests.map((r) => [r.client, r.params.query?.facets])).toEqual([
			['slowApi', true],
			['api', false]
		]);
	});

	it('shows the rows when the facets fail', async () => {
		fakeApi({
			'/api/dossiers': ({ params }: FakeRequest) =>
				params.query?.facets ? fail(500) : answer([{ id: 'a' }], 'rows')
		});
		const l = list();
		const r = await faceted('/api/dossiers', { limit: 100 }, l.apart, (f) => l.facets.push(f))(
			0,
			new AbortController().signal
		);
		l.rows.push({ items: r.items, offset: 0 });
		await settle();
		expect(l.rows).toHaveLength(1);
		expect(l.failed).toHaveLength(1);
		expect(l.facets).toEqual([]);
	});

	it('fails the load when the rows fail', async () => {
		fakeApi({
			'/api/documents': ({ params }: FakeRequest) =>
				params.query?.facets ? answer([], 'facets') : fail(500)
		});
		const l = list();
		const load = faceted('/api/documents', { limit: 100 }, l.apart, () => {});
		await expect(load(0, new AbortController().signal)).rejects.toThrow('answered 500');
	});
});

import { describe, expect, it, vi } from 'vitest';
import { fail, fakeApi, type FakeRequest } from '$lib/test/fakeApi';
import type { FeedItem } from '$lib/components/actueel/feed';
import {
	allDecisions,
	countDecisions,
	countFeed,
	factionVotesOn,
	followChains,
	motionsOf,
	periodUnit,
	type Topic
} from './overview-load';

vi.mock('$lib/components/parliamentary/amendementen', () => ({
	getAmendementen: async (number: string) => ({
		rijen: [
			{
				stuk: { id: `documents/${number}-am`, nummer: '8', titel: `Amendement ${number}` },
				haltes: [
					{ id: `documents/${number}-p`, datum: number === 'a' ? '2026-01-02' : '2026-03-04' }
				],
				uitslag: null,
				nogNiet: true
			}
		]
	})
}));

const topic: Topic = { words: ['stikstof'], chamber: '', from: '', to: '' };
const signal = () => new AbortController().signal;

const item = (key: string, date: string, kind = 'Motie', dossier = 'a') => ({
	id: `documents/${key}`,
	node: { collection: 'documents', key },
	kind,
	date,
	title: key,
	persons: [],
	dossier: { key: dossier, number: dossier }
});

/** /api/feed in pages of the given items, each but the last with a cursor to the next. */
const feedOf =
	(...pages: ReturnType<typeof item>[][]) =>
	(r: FakeRequest) => {
		const n = Number(r.params.query?.cursor ?? 0);
		return {
			items: pages[n] ?? [],
			next_cursor: n + 1 < pages.length ? String(n + 1) : null,
			data_as_of: { tk: { newest: '2026-10-10T08:00:00' } }
		};
	};

const period = (p: string, counts: Record<string, number>, chains?: number) => ({
	period: p,
	counts,
	...(chains === undefined ? {} : { amendment_chains: { count: chains } })
});

describe('the feed of a topic counted', () => {
	it('counts every column per period, the amendments by their chains, without the feed', async () => {
		const api = fakeApi({
			'/api/feed/periods': {
				periods: [period('2026-10', { Motie: 3, 'Brief regering': 1 }, 2)],
				partial: false
			},
			'/api/feed': feedOf([])
		});
		const periods = vi.fn();
		const boundary = await countFeed(topic, false, signal(), { periods, page: vi.fn() });
		expect(boundary).toBe(null);
		expect(periods.mock.calls[0][0].counted).toEqual([
			{ date: '2026-10', kolom: 'moties', count: 3 },
			{ date: '2026-10', kolom: 'brieven', count: 1 },
			{ date: '2026-10', kolom: 'amendementen', count: 2 }
		]);
		expect(periods.mock.calls[0][0].chains).toBe(true);
		expect(api.asked('/api/feed')).toEqual([]);
		expect(api.asked('/api/feed/periods')[0].query).toMatchObject({ per: 'month' });
	});

	it('asks the feed for the amendments only, where their chains are not counted', async () => {
		const api = fakeApi({
			'/api/feed/periods': { periods: [period('2026-10', { Motie: 3 })], partial: false },
			'/api/feed': feedOf([item('x', '2026-10-01', 'Amendement')])
		});
		const page = vi.fn();
		await countFeed(topic, false, signal(), { periods: vi.fn(), page });
		expect(api.asked('/api/feed').map((q) => q.query?.kind)).toEqual(['Amendement']);
		expect(page.mock.calls[0][0].map((i: FeedItem) => i.id)).toEqual(['documents/x']);
	});

	it('counts the feed page by page where the periods are not whole, at most five pages', async () => {
		const pages = Array.from({ length: 7 }, (_, n) => [item(`p${n}`, `2026-0${9 - n}-01`)]);
		const api = fakeApi({
			'/api/feed/periods': { periods: [], partial: true },
			'/api/feed': feedOf(...pages)
		});
		const page = vi.fn();
		const boundary = await countFeed(topic, false, signal(), { periods: vi.fn(), page });
		const asked = api.asked('/api/feed');
		expect(asked).toHaveLength(5);
		expect(asked[0].query?.kind).toBe('Motie,Amendement,Brief regering,toezegging');
		expect(asked.map((q) => q.query?.cursor)).toEqual([undefined, '1', '2', '3', '4']);
		expect(page).toHaveBeenCalledTimes(5);
		expect(page.mock.calls[0][1]).toBe('2026-10-10');
		// More than was asked: searched from the day of the last event counted.
		expect(boundary).toBe('2026-05-01');
	});

	it('says no boundary where the feed ran out first', async () => {
		fakeApi({
			'/api/feed/periods': { periods: [], partial: true },
			'/api/feed': feedOf([item('a', '2026-10-01')])
		});
		expect(await countFeed(topic, false, signal(), { periods: vi.fn(), page: vi.fn() })).toBe(null);
	});

	it('goes on with the feed where the periods fail, and says so in the console', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		const api = fakeApi({ '/api/feed/periods': fail(500), '/api/feed': feedOf([]) });
		await countFeed(topic, false, signal(), { periods: vi.fn(), page: vi.fn() });
		expect(api.asked('/api/feed')).toHaveLength(1);
		expect(warn).toHaveBeenCalledWith('Overzicht perioden:', expect.anything());
	});

	it('counts weeks per day within 400 days from a first day, else by the feed', () => {
		expect(periodUnit(false, '', '')).toBe('month');
		expect(periodUnit(true, '2026-01-01', '2026-06-01')).toBe('day');
		expect(periodUnit(true, '', '')).toBe(null);
		expect(periodUnit(true, '2020-01-01', '2026-06-01')).toBe(null);
	});
});

describe('the stemmingen of a topic', () => {
	it('counts the days with how many passed, and the total', async () => {
		fakeApi({
			'/api/decisions': {
				items: [],
				total: 4,
				facets: { days: [{ date: '2026-10-01', count: 4, passed: 3 }, { count: 1 }] }
			}
		});
		const r = await countDecisions(topic, signal());
		expect(r.days).toEqual([{ date: '2026-10-01', count: 4, passed: 3 }]);
		expect(r.total).toBe(4);
		expect(r.counted).toBe(null);
	});

	it('asks every page of a list until a short one', async () => {
		const api = fakeApi({
			'/api/decisions': (r: FakeRequest) => ({
				items: Array.from({ length: r.params.query?.offset === 0 ? 200 : 3 }, (_, i) => ({
					key: `${r.params.query?.offset}-${i}`
				})),
				total: null
			})
		});
		expect(await allDecisions({ q: ['x'] })).toHaveLength(203);
		expect(api.asked('/api/decisions').map((q) => q.query?.offset)).toEqual([0, 200]);
	});

	it('asks the pages of a long list without facets, three for 450', async () => {
		const api = fakeApi({
			'/api/decisions': (r: FakeRequest) => {
				const offset = Number(r.params.query?.offset);
				const length = Math.max(0, Math.min(200, 450 - offset));
				return {
					items: Array.from({ length }, (_, i) => ({ key: `${offset + i}` })),
					total: null
				};
			}
		});
		expect(await allDecisions({ q: ['x'] })).toHaveLength(450);
		const asked = api.asked('/api/decisions');
		expect(asked).toHaveLength(3);
		expect(asked.every((q) => q.query?.facets === false)).toBe(true);
	});

	it('asks the moties and a fractie’s votes without facets', async () => {
		const api = fakeApi({ '/api/decisions': { items: [], total: null } });
		await motionsOf(topic, ['Motie'], signal());
		await factionVotesOn({ q: ['x'] }, 'VVD');
		const asked = api.asked('/api/decisions');
		expect(asked).toHaveLength(3);
		expect(asked.every((q) => q.query?.facets === false)).toBe(true);
	});

	it('asks the moties per kind and gives them together', async () => {
		const api = fakeApi({
			'/api/decisions': (r: FakeRequest) => ({
				items: [{ key: String(r.params.query?.kind), date: '2026-01-01' }],
				total: 1
			})
		});
		const r = await motionsOf(topic, ['Motie', 'Motie (gewijzigd)'], signal());
		expect(r.motions.map((d) => d.key)).toEqual(['Motie', 'Motie (gewijzigd)']);
		expect(r.boundary).toBe(null);
		expect(api.asked('/api/decisions')[0].query).toMatchObject({ q: ['stikstof'], kind: 'Motie' });
	});
});

describe('the amendments by their chains', () => {
	it('follows each dossier once and gives the chains found so far, the newest first', async () => {
		const papers = [
			item('a-p', '2026-01-02', 'Amendement', 'a'),
			item('b-p', '2026-03-04', 'Amendement', 'b'),
			item('a-p2', '2026-01-05', 'Amendement', 'a')
		].map((i) => ({ ...i, persons: [] }) as unknown as FeedItem);
		const found: string[][] = [];
		await followChains(papers, signal(), (chains) => found.push(chains.map((c) => c.id)));
		expect(found.at(-1)).toEqual(['documents/b-am', 'documents/a-am']);
		expect(found).toHaveLength(2);
	});

	it('stops when the topic changes', async () => {
		const ac = new AbortController();
		ac.abort();
		const papers = [item('a-p', '2026-01-02', 'Amendement')] as unknown as FeedItem[];
		await expect(followChains(papers, ac.signal, () => {})).rejects.toThrow();
	});
});

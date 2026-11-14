import { describe, expect, it, vi } from 'vitest';
import { fakeApi, type FakeRequest } from '$lib/test/fakeApi';
import type { MapItem } from './map';
import { Fresh } from './fresh.svelte';
import { LAW_FEED_KINDS } from './fresh';

vi.mock('$app/state', () => ({ page: { url: new URL('http://localhost/') } }));
vi.mock('$app/navigation', () => ({ goto: () => Promise.resolve() }));

const lid: MapItem = {
	id: 'articles/bwbr0005290_658',
	at: 'lid-1',
	kort: 'art. 7:658 lid 1 BW',
	groep: 'Burgerlijk Wetboek Boek 7',
	groupKey: 'wet:bwbr0005290'
};
const motie: MapItem = {
	id: 'documents/kst_36744_12',
	at: '',
	kort: 'Kamerstukken II 36744, 12',
	groep: 'Kamerstuk 36744',
	groupKey: 'dossier:36744'
};
const line = (id: string, date: string, article_key: string | null = null) => ({
	id,
	kind: 'publicatie',
	date,
	title: id,
	node: { collection: 'instruments', key: id, id: `instruments/${id}`, path: null },
	via: { relation: 'amends', article: null, article_key, dossier: null },
	amends_articles: [],
	persons: []
});

describe('what is new in a bundel', () => {
	it('asks each law and dossier from the day after the visit before, and each article once', async () => {
		const asked: FakeRequest[] = [];
		fakeApi({
			'/api/feed': (r: FakeRequest) => {
				asked.push(r);
				return {
					items: r.params.query?.instrument
						? [line('stb_2026_306', '2026-10-07', 'bwbr0005290_658'), line('oud', '2026-10-01')]
						: [line('stemming', '2026-10-09')],
					next_cursor: null
				};
			},
			'/api/articles/{bwb_id}/{article_number}/cited-by': (r: FakeRequest) => {
				asked.push(r);
				return {
					items: [
						{
							judgment: {
								date: '2026-10-07',
								cite: { full: 'Rb. Den Haag 7\u00a0oktober\u00a02026' }
							},
							paragraph_id: 'rov-3.1',
							paragraph_number: '3.1'
						}
					],
					total: 1
				};
			}
		});
		const fresh = new Fresh('2026-10-01');
		expect(fresh.any).toBe(false);
		await fresh.load([lid, motie], new AbortController().signal);
		expect(asked.map((r) => r.params.query)).toEqual([
			{ instrument: 'BWBR0005290', kind: LAW_FEED_KINDS, since: '2026-10-02', facets: false, limit: 50 },
			{ dossier: '36744', since: '2026-10-02', facets: false, limit: 50 },
			{ limit: 1, sort: 'date_desc' }
		]);
		expect(fresh.linesOf(lid).map((l) => l.id)).toEqual(['stb_2026_306']);
		expect(fresh.citingOf(lid)?.place).toBe('3.1');
		expect(fresh.group('dossier:36744')).toHaveLength(1);
		expect(fresh.isNew(motie)).toBe(false);
		expect(fresh.any).toBe(true);
	});

	it('keeps a new version of a law that many judgments cite on its page (BW Boek 5)', async () => {
		const boek5: MapItem = {
			id: 'articles/bwbr0005288_1',
			at: '',
			kort: 'art. 5:1 BW',
			groep: 'Burgerlijk Wetboek Boek 5',
			groupKey: 'wet:bwbr0005288'
		};
		const judgment = (n: number) => ({
			...line(`ecli_nl_hr_2026_${n}`, '2026-10-08'),
			kind: 'uitspraak',
			via: { relation: 'refers_to', article: '1', article_key: null, dossier: null }
		});
		const version = {
			...line('bwbr0005288_2026-10-05', '2026-10-05'),
			kind: 'inwerkingtreding',
			via: { relation: 'version_of', article: null, article_key: null, dossier: null }
		};
		fakeApi({
			// As the API answers: without `kind` the judgments fill the page of 50 and the
			// version, older, falls after it; under the kinds asked it is there.
			'/api/feed': (r: FakeRequest) => {
				const kinds = String(r.params.query?.kind ?? '').split(',');
				const items = [...Array.from({ length: 60 }, (_, n) => judgment(n)), version];
				return {
					items: items
						.filter((i) => !r.params.query?.kind || kinds.includes(i.kind))
						.slice(0, Number(r.params.query?.limit)),
					next_cursor: null
				};
			},
			'/api/articles/{bwb_id}/{article_number}/cited-by': () => ({ items: [], total: 0 })
		});
		const fresh = new Fresh('2026-10-01');
		await fresh.load([boek5], new AbortController().signal);
		expect(LAW_FEED_KINDS.split(',')).not.toContain('uitspraak');
		expect(LAW_FEED_KINDS.split(',')).toContain('inwerkingtreding');
		expect(fresh.group('wet:bwbr0005288').map((l) => l.id)).toEqual(['bwbr0005288_2026-10-05']);
	});
});

// The promise caches of the app are one: `once` in records.ts, with its bound and its
// asking again after a failure. A caller that leaves leaves the shared request standing.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { fail, fakeApi, type ApiPath } from '$lib/test/fakeApi';
import { laadUitspraak } from '$lib/bron/overweging';
import { getCitedByTop } from './articles';
import { getCabinets, getMinistries } from './government';
import { getInstrumentDetail } from './instrument-cache';
import { lawArticleList } from './law-articles';
import { once, RECORDS_KEPT } from './records';

const judgment = { judgment: { ecli: 'ECLI:NL:HR:2019:2006', paragraphs: [], footnotes: [] } };

const getters: { name: string; path: ApiPath; answer: unknown; get: () => Promise<unknown> }[] = [
	{ name: 'getCabinets', path: '/api/cabinets', answer: [], get: () => getCabinets() },
	{ name: 'getMinistries', path: '/api/ministries', answer: [], get: () => getMinistries() },
	{
		name: 'getInstrumentDetail',
		path: '/api/instruments/{identifier}',
		answer: { bwb_id: 'BWBR0005537', title: 'Algemene wet bestuursrecht' },
		get: () => getInstrumentDetail('BWBR0005537')
	},
	{
		name: 'lawArticleList',
		path: '/api/instruments/{bwb_id}/articles',
		answer: { items: [], total: 0 },
		get: () => lawArticleList('BWBR0005537')
	},
	{
		name: 'laadUitspraak',
		path: '/api/judgments/{ecli}',
		answer: judgment,
		get: () => laadUitspraak('ECLI:NL:HR:2019:2006')!
	}
];

describe.each(getters)('$name', ({ path, answer, get }) => {
	it('asks once for two callers', async () => {
		const api = fakeApi({ [path]: answer });
		await Promise.all([get(), get()]);
		expect(api.asked(path)).toHaveLength(1);
	});

	it('asks again after a failure', async () => {
		let n = 0;
		const api = fakeApi({ [path]: () => (n++ === 0 ? fail(503) : answer) });
		await expect(get()).rejects.toBeTruthy();
		await get();
		expect(api.asked(path)).toHaveLength(2);
	});

	it('is kept within the bound of the records', async () => {
		const api = fakeApi({ [path]: answer });
		await get();
		for (let i = 0; i < RECORDS_KEPT; i++) await once(`other/${i}`, async () => i);
		await get();
		expect(api.asked(path)).toHaveLength(2);
	});
});

describe('getCitedByTop', () => {
	it('leaves the shared request standing when a caller leaves', async () => {
		const api = fakeApi({
			'/api/articles/{bwb_id}/{article_number}/cited-by': { items: [], total: 0 }
		});
		const ctrl = new AbortController();
		ctrl.abort();
		await expect(getCitedByTop('BWBR0005537', '3:4', ctrl.signal)).rejects.toBeTruthy();
		await expect(getCitedByTop('BWBR0005537', '3:4')).resolves.toMatchObject({ total: 0 });
		const asked = api.requests.filter((r) => r.path.endsWith('/cited-by'));
		expect(asked).toHaveLength(1);
		expect(asked[0].signal).toBeUndefined();
	});
});

describe('one promise cache', () => {
	// expansion.ts keeps its requests under way per canvas (E52); a netwerk keeps the full
	// nodes of its chosen bronnen while it is composed.
	const apart = ['src/lib/api/records.ts', 'src/lib/graph/store/expansion.ts'];
	const apartInstance = ['src/routes/explore/netwerk-compose.svelte.ts'];
	const files = (dir: string): string[] =>
		readdirSync(dir).flatMap((name) => {
			const p = join(dir, name);
			if (statSync(p).isDirectory()) return files(p);
			return /\.(ts|svelte)$/.test(name) && !/\.test\.ts$/.test(name) ? [p] : [];
		});

	it('is records.ts: no other map of promises', () => {
		const found = files('src').filter(
			(f) =>
				![...apart, ...apartInstance].includes(f) &&
				readFileSync(f, 'utf8').includes('new Map<string, Promise')
		);
		expect(found).toEqual([]);
	});
});

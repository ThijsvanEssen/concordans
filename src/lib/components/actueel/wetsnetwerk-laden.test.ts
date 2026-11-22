import { beforeEach, describe, expect, it, vi } from 'vitest';

const log: string[] = [];
const wijzigingen = new Map<string, unknown>();
let feedAntwoord: unknown[] = [];

vi.mock('$lib/api/dossiers', () => ({
	// Asked once per dossier, as `once` has it.
	getChangedArticles: (n: string) => {
		if (!log.includes(`ca:${n}`)) log.push(`ca:${n}`);
		return Promise.resolve(wijzigingen.get(n) ?? null);
	}
}));
vi.mock('$lib/api/feed', () => ({
	getFeed: () => {
		log.push('feed');
		return Promise.resolve({ items: feedAntwoord });
	}
}));
vi.mock('$lib/api/articles', () => ({
	getCitedByTop: () => {
		log.push('cited-by');
		return Promise.resolve({ items: [] });
	}
}));
vi.mock('$lib/api/records', () => ({
	getNodeVerbonden: (c: string, key: string) => {
		log.push(`node:${c}/${key}`);
		return Promise.resolve({});
	}
}));
vi.mock('$lib/verbonden/NetworkSketch.svelte', () => ({ default: {} }));
vi.mock('./home-network', () => ({}));

import { laadWetsnetwerk } from './wetsnetwerk';

const stemming = (number: string, date: string, chamber: 'TK' | 'EK' = 'EK') =>
	({
		id: `decisions/${number}-${chamber}`,
		kind: 'stemming',
		date,
		title: `Wet ${number}`,
		subkind: 'Wetgeving',
		dossier: { key: number, number, title: `Wet ${number}`, short_title: `Wet ${number}` },
		vote: { chamber, passed: true, tally: {} }
	}) as never;

const verandert = (artikel: string) => ({
	total: 1,
	laws: [
		{
			law: { id: 'instruments/bwbr1', bwb_id: 'BWBR1', display_name: 'Wet' },
			total: 1,
			changes: [
				{
					article: {
						id: `articles/bwbr1_${artikel}`,
						key: `bwbr1_${artikel}`,
						article_number: artikel
					},
					source: { id: 'documents/d1', number: '2', sequence: 2 }
				}
			]
		}
	]
});

beforeEach(() => {
	log.length = 0;
	wijzigingen.clear();
	feedAntwoord = [];
});

describe('laadWetsnetwerk', () => {
	it('takes the first bill that changes articles and asks nothing it does not need', async () => {
		wijzigingen.set('1', verandert('9'));
		const s = await laadWetsnetwerk([stemming('1', '2026-11-01')], '2026-11-22');
		expect(s?.kandidaat.number).toBe('1');
		expect(s?.centrum.id).toBe('articles/bwbr1_9');
	});

	it('asks the older votes beside the summary bill, not after its answer', async () => {
		wijzigingen.set('2', verandert('7'));
		feedAntwoord = [stemming('2', '2026-10-01')];
		const s = await laadWetsnetwerk([stemming('1', '2026-11-01')], '2026-11-22');
		expect(s?.kandidaat.number).toBe('2');
		// The feed is asked before the answer of the first bill is waited for.
		expect(log.slice(0, 2).sort()).toEqual(['ca:1', 'feed']);
	});

	it('asks the nodes and the judgments together once the bill is chosen', async () => {
		wijzigingen.set('1', verandert('9'));
		await laadWetsnetwerk([stemming('1', '2026-11-01')], '2026-11-22');
		const na = log.slice(log.indexOf('ca:1') + 1);
		expect(na.sort()).toEqual(['cited-by', 'node:articles/bwbr1_9', 'node:dossiers/1'].sort());
	});

	it('asks at most four bills when none changes articles', async () => {
		feedAntwoord = ['3', '4', '5', '6'].map((n) => stemming(n, '2026-09-01'));
		const s = await laadWetsnetwerk(
			[stemming('1', '2026-11-01'), stemming('2', '2026-10-30')],
			'2026-11-22'
		);
		expect(s).toBeNull();
		expect(log.filter((l) => l.startsWith('ca:'))).toHaveLength(4);
	});

	it('gives the newest of two bills that both change articles', async () => {
		wijzigingen.set('1', verandert('9'));
		wijzigingen.set('2', verandert('7'));
		const s = await laadWetsnetwerk(
			[stemming('2', '2026-10-30'), stemming('1', '2026-11-01')],
			'2026-11-22'
		);
		expect(s?.kandidaat.number).toBe('1');
	});
});

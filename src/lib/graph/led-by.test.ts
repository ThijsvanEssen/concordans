import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Schema } from '$lib/api/types';

// A plain function, not vi.fn: a vi.fn's rejected promise fails the test though it is handled.
const calls: unknown[][] = [];
let answer: () => Promise<unknown> = async () => null;
const getNodeGraph = (...args: unknown[]) => {
	calls.push(args);
	return answer();
};
vi.mock('$lib/api/nodes', () => ({ NODE_BUCKET: 200, getNodeGraph }));
const { ledByRows, withLatestFirst } = await import('./led-by');

type NodeResponse = Schema<'NodeGraphResponse'>;

const dossier = (key: string, latest: string | null) => ({
	id: `dossiers/${key}`,
	collection: 'dossiers',
	key,
	display_name: key,
	props: {},
	meta: { derived_from: 'activities', activities: 1, latest }
});
const response = (buckets: object[]) =>
	({ node: { id: 'committees/jv' }, neighbors: { buckets } }) as unknown as NodeResponse;
const ledBucket = (items: object[]) => ({
	relation: 'LED_BY',
	direction: 'inbound',
	type: 'dossier',
	total: 619,
	items
});
const members = { relation: 'MEMBER_OF', direction: 'inbound', type: 'member', items: [] };

describe('the dossiers a commissie leads (B41)', () => {
	beforeEach(() => {
		calls.length = 0;
	});

	it('come the latest first: the bucket of the node replaced by the one asked sorted', async () => {
		const full = response([members, ledBucket([dossier('a', '2020-01-01')])]);
		answer = async () => response([ledBucket([dossier('z', '2026-10-01')])]);
		const sorted = await withLatestFirst('committees', 'jv', Promise.resolve(full));
		expect(calls).toEqual([
			[
				'committees',
				'jv',
				{
					limit: 200,
					relations: 'LED_BY',
					nodeTypes: 'dossier',
					direction: 'inbound',
					sort: 'importance'
				}
			]
		]);
		expect(sorted.neighbors.buckets.map((b) => b.items.map((i) => i.key))).toEqual([[], ['z']]);
		// The node response is shared: it stays as it came.
		expect(full.neighbors.buckets[1].items[0].key).toBe('a');
	});

	it('stay in key order where the sorted page fails, and of a dossier ask nothing', async () => {
		const full = response([ledBucket([dossier('a', null)])]);
		answer = async () => {
			throw new Error('500');
		};
		vi.spyOn(console, 'debug').mockImplementation(() => {});
		expect(await withLatestFirst('committees', 'jv', Promise.resolve(full))).toBe(full);
		expect(await withLatestFirst('dossiers', '36764', Promise.resolve(full))).toBe(full);
		expect(calls).toHaveLength(1);
	});

	it('are rows with the meta of their edge, which the canvas sorts by', () => {
		const rows = ledByRows('committees', response([ledBucket([dossier('36764', '2026-09-01')])]));
		expect(rows).toEqual([
			expect.objectContaining({
				ref: { collection: 'dossiers', key: '36764' },
				relation: 'LED_BY',
				direction: 'inbound',
				meta: expect.objectContaining({ latest: '2026-09-01' })
			})
		]);
		expect(ledByRows('members', response([]))).toEqual([]);
	});
});

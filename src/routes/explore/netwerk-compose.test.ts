// A bron alone brings 150 neighbours per bucket, a composed netwerk 200 per bron (besluit 29).
import { describe, expect, it, vi } from 'vitest';
import type { Schema } from '$lib/api/types';
import { NEIGHBORHOOD_CAP } from '$lib/graph/store/types';
import { NetwerkComposer, REACH_MAX, reachCap, withinCap } from './netwerk-compose.svelte';

vi.mock('$lib/api/records', () => ({
	getNodeFirst: vi.fn(async (collection: string, key: string) => responseOf(collection, key))
}));

function responseOf(collection: string, key: string) {
	return {
		node: {
			id: `${collection}/${key}`,
			collection,
			key,
			type: collection === 'dossiers' ? 'dossier' : 'member',
			display_name: key,
			labels: [],
			props: {}
		},
		neighbors: { total: 0, buckets: [] }
	} as unknown as Schema<'NodeGraphResponse'>;
}

type Response = Schema<'NodeGraphResponse'>;

const response = (n: number, total = 905) =>
	({
		node: { collection: 'instruments', key: 'bwbr0005290' },
		neighbors: {
			total,
			buckets: [
				{
					collection: 'articles',
					relation: 'PART_OF',
					direction: 'inbound',
					total,
					items: Array.from({ length: n }, (_, i) => ({ id: `articles/a${i}` }))
				}
			]
		}
	}) as unknown as Response;

describe('withinCap', () => {
	it('cuts a bucket of 200 to 150 and keeps its total, so Tonen says "150 van 905"', () => {
		const cut = withinCap(response(200), NEIGHBORHOOD_CAP);
		const bucket = cut.neighbors!.buckets[0];
		expect(bucket.items).toHaveLength(150);
		expect(bucket.total).toBe(905);
	});
	it('leaves a smaller bucket alone, the same object', () => {
		const small = response(40);
		expect(withinCap(small, NEIGHBORHOOD_CAP)).toBe(small);
	});
});

describe('the steps of a netwerk', () => {
	const setup = (capped = false) => {
		const store = {
			nodeResponse: vi.fn(async (c: string, k: string) => responseOf(c, k)),
			compose: vi.fn((_input: { fresh: boolean }) => ({ alone: new Set<string>(), joining: [] })),
			releaseNetwerk: vi.fn(),
			expandNeighborhood: vi.fn(
				async (_c: string, _k: string, opts: { onCut?: (c: boolean) => void }) => {
					opts.onCut?.(capped);
					return null;
				}
			)
		};
		const composer = new NetwerkComposer(store as never, () => null);
		composer.surroundings = true;
		return { store, composer };
	};
	const netwerk = (...ids: string[]) => ({ ids, uit: new Set<string>() });
	const settle = async (composer: NetwerkComposer) => {
		await vi.waitFor(() => expect(composer.loading || composer.extending).toBe(false));
	};

	it('asks one additive neighbourhood per chosen bron, sharing the canvas between them', async () => {
		const { store, composer } = setup();
		composer.steps = 3;
		composer.compose(netwerk('members/a', 'members/b', 'members/c'));
		await settle(composer);
		const calls = store.expandNeighborhood.mock.calls;
		expect(calls.map((c) => c[1]).sort()).toEqual(['a', 'b', 'c']);
		for (const [, , opts] of calls)
			expect(opts).toMatchObject({ depth: 3, additive: true, cap: reachCap(3) });
		expect(composer.reach).toEqual({ depth: 3, capped: false, cap: reachCap(3) });
	});

	it('says when the API cut a neighbourhood off', async () => {
		const { composer } = setup(true);
		composer.steps = 2;
		composer.compose(netwerk('members/a'));
		await settle(composer);
		expect(composer.reach).toMatchObject({ depth: 2, capped: true, cap: 400 });
	});

	it('takes the default of each bron when the address says nothing: a dossier stays at one step', async () => {
		const { store, composer } = setup();
		composer.compose(netwerk('members/a', 'dossiers/36496'));
		await settle(composer);
		expect(store.expandNeighborhood.mock.calls.map((c) => c[1])).toEqual(['a']);
	});

	it('asks nothing at Alleen gekozen or one step', async () => {
		for (const [steps, surroundings] of [
			[0, false],
			[1, true]
		] as const) {
			const { store, composer } = setup();
			composer.surroundings = surroundings;
			composer.steps = steps;
			composer.compose(netwerk('members/a', 'members/b'));
			await settle(composer);
			expect(store.expandNeighborhood).not.toHaveBeenCalled();
			expect(composer.reach).toBeNull();
		}
	});

	it('asks for the first few bronnen only, and not again for what it has', async () => {
		const { store, composer } = setup();
		composer.steps = 2;
		const ids = Array.from({ length: REACH_MAX + 2 }, (_, i) => `members/m${i}`);
		composer.compose(netwerk(...ids));
		await settle(composer);
		expect(store.expandNeighborhood).toHaveBeenCalledTimes(REACH_MAX);
		composer.compose(netwerk(...ids));
		await settle(composer);
		expect(store.expandNeighborhood).toHaveBeenCalledTimes(REACH_MAX);
	});

	it('draws anew when the reach gets shorter, and asks again when it grows', async () => {
		const { store, composer } = setup();
		composer.steps = 3;
		composer.compose(netwerk('members/a'));
		await settle(composer);
		composer.steps = 2;
		composer.compose(netwerk('members/a'));
		await settle(composer);
		const fresh = store.compose.mock.calls.map((c) => c[0].fresh);
		expect(fresh.at(-1)).toBe(true);
		expect(
			store.expandNeighborhood.mock.calls.map((c) => (c[2] as { depth: number }).depth)
		).toEqual([3, 2]);
	});

	it('shares the room: a quarter of it for four, never under 50, all of it for one', () => {
		expect(reachCap(1)).toBe(400);
		expect(reachCap(3)).toBe(133);
		expect(reachCap(4)).toBe(100);
		expect(reachCap(6)).toBe(66);
		expect(reachCap(40)).toBe(50);
	});
});

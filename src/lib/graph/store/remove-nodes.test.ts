// Whatever takes bronnen off the canvas (hiding rows, pruning, a new netwerk, the soft
// cap) leaves no line without an end, and the soft cap trims the oldest first.
import { describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import type { Schema } from '$lib/api/types';
import { createGraphStore } from '../graph-store';
import { createGraphContext } from './context';
import { SOFT_NODE_CAP } from './types';
import { createViewActions } from './view-actions';

const judgment = (key: string) => ({
	id: `judgments/${key}`,
	key,
	collection: 'judgments',
	type: 'judgment',
	display_name: `Uitspraak ${key}`,
	labels: [],
	props: {}
});

/** A judgment that refers to `referred`. */
const referring = (key: string, referred: string[]) =>
	({
		node: judgment(key),
		neighbors: {
			total: referred.length,
			buckets: [
				{
					relation: 'REFERS_TO',
					collection: 'judgments',
					direction: 'outbound',
					type: 'judgment',
					total: referred.length,
					items: referred.map((k) => ({
						...judgment(k),
						relation: 'REFERS_TO',
						direction: 'outbound'
					}))
				}
			]
		}
	}) as unknown as Schema<'NodeGraphResponse'>;

type Store = ReturnType<typeof createGraphStore>;

/** The edges on the canvas whose source or target is not. */
const loose = (store: Store) => {
	const ids = new Set(get(store.nodes).map((n) => n.id));
	return get(store.edges).filter((e) => !ids.has(e.source) || !ids.has(e.target));
};

const ids = (store: Store) => get(store.nodes).map((n) => n.id);

const composed = () => {
	const store = createGraphStore();
	store.compose({
		participants: [{ response: referring('a', ['x', 'y']) }, { response: referring('b', ['z']) }],
		surroundings: true,
		fresh: true
	});
	return store;
};

describe('taking bronnen off the canvas', () => {
	it('hideRows leaves no line without an end', () => {
		const store = composed();
		expect(get(store.edges).length).toBeGreaterThan(0);
		store.hideRows(['judgments/y']);
		expect(ids(store)).not.toContain('judgments/y');
		expect(loose(store)).toEqual([]);
	});

	it('hideRows keeps the pinned bronnen', () => {
		const store = composed();
		store.hideRows(['judgments/a']);
		expect(ids(store)).toContain('judgments/a');
	});

	it('pruneNodes leaves no line without an end', () => {
		const store = composed();
		store.pruneNodes(new Set(['judgments/a', 'judgments/y']));
		expect(ids(store).sort()).toEqual(['judgments/a', 'judgments/y']);
		expect(get(store.edges).map((e) => [e.source, e.target])).toEqual([
			['judgments/a', 'judgments/y']
		]);
	});

	it('a second netwerk leaves no line without an end', () => {
		const store = composed();
		store.compose({
			participants: [{ response: referring('b', ['z']) }],
			surroundings: true,
			fresh: true
		});
		expect(ids(store)).not.toContain('judgments/a');
		expect(loose(store)).toEqual([]);
	});

	it('the soft cap trims the oldest first, and a row shown last stays', () => {
		const ctx = createGraphContext();
		const many = Array.from({ length: SOFT_NODE_CAP }, (_, i) => `n${i}`);
		ctx.mergeResponse(referring('focus', many));
		expect(ctx.nodes.size).toBe(SOFT_NODE_CAP);
		createViewActions(ctx).showRows('judgments/focus', [
			{
				ref: { collection: 'judgments', key: 'row' },
				title: 'row',
				relation: 'REFERS_TO',
				direction: 'outbound'
			}
		]);
		// The focus has the most lines and stays; of the rest the oldest goes.
		const first = [...ctx.nodes.keys()][1];
		ctx.trimToCap();
		expect(ctx.nodes.size).toBe(SOFT_NODE_CAP);
		expect(ctx.nodes.has(first)).toBe(false);
		expect(ctx.nodes.has('judgments/row')).toBe(true);
		const nodeIds = new Set(ctx.nodes.keys());
		expect(
			[...ctx.edges.values()].filter((e) => !nodeIds.has(e.source) || !nodeIds.has(e.target))
		).toEqual([]);
	});
});

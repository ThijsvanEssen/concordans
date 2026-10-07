// One load of the verbindingen of the selected bron, read by the panel, the table,
// the legend of the network and the margin of the reader. The groups come from the
// group table; a group with a loader fills in as its request answers.
import { bucketTotals, neighborsOf } from '$lib/api/nodes';
import type { GraphStore } from '$lib/graph/graph-store';
import type { GraphNode } from '$lib/graph/types';
import { get, writable, type Readable } from 'svelte/store';
import { getNodeFirst } from '$lib/api/records';
import { buildGroups, groupCount, withUnresolvedAppeals, type Group } from './groups';
import { LOADERS } from './loaders';

export type VerbondenState = {
	/** The id of the bron the groups belong to. */
	id: string | null;
	groups: Group[];
	/** Requests still under way. */
	loading: boolean;
	failed: boolean;
	/**
	 * The groups to come, with their counts, from the light node while the full one is on
	 * its way: the panel shows their heads before their rows (the Awb's full node is 4.9 MB).
	 */
	preview?: { id: string; label: string; count: number | null }[];
};

export type VerbondenSource = Readable<VerbondenState> & {
	load: (selection: GraphNode | null) => void;
	/** Load the same bron again, after a failed request. */
	reload: () => void;
	destroy: () => void;
};

const EMPTY: VerbondenState = { id: null, groups: [], loading: false, failed: false };

export function createVerbondenSource(store: GraphStore): VerbondenSource {
	const state = writable<VerbondenState>(EMPTY);
	let controller: AbortController | null = null;
	let current: string | null = null;
	let last: GraphNode | null = null;

	const load = (selection: GraphNode | null) => {
		if (selection?.id === current) return;
		last = selection;
		controller?.abort();
		current = selection?.id ?? null;
		if (!selection) {
			state.set(EMPTY);
			return;
		}
		const ac = new AbortController();
		controller = ac;
		state.set({ id: selection.id, groups: [], loading: true, failed: false });
		const { collection, key } = selection;
		getNodeFirst(collection, key)
			.then((first) => {
				if (ac.signal.aborted || get(state).groups.length > 0) return;
				const preview = buildGroups(collection, neighborsOf(first), bucketTotals(first))
					.filter((g) => g.load || g.rows.length > 0)
					.map((g) => ({ id: g.id, label: g.label, count: g.load ? null : groupCount(g) }));
				state.set({ id: selection.id, groups: [], loading: true, failed: false, preview });
			})
			.catch(() => {});
		store
			.nodeResponse(collection, key)
			.then((response) => {
				if (ac.signal.aborted) return;
				const neighbors = neighborsOf(response);
				const totals = bucketTotals(response);
				let groups = withUnresolvedAppeals(
					buildGroups(collection, neighbors, totals),
					(response.node.props ?? {}) as Record<string, unknown>
				);
				const pending = new Set(groups.filter((g) => g.load).map((g) => g.id));
				state.set({ id: selection.id, groups, loading: pending.size > 0, failed: false });
				const ctx = {
					node: response.node,
					neighbors,
					totals,
					nodeResponse: store.nodeResponse,
					signal: ac.signal
				};
				for (const def of groups) {
					if (!def.load) continue;
					LOADERS[def.load](ctx)
						.then(({ rows, total, mentions, order, years, judgmentsOf }) => {
							if (ac.signal.aborted) return;
							groups = groups.map((g) => {
								if (g.id === def.id) return { ...g, rows, total, mentions, order, years };
								const judgments = judgmentsOf?.[g.id];
								if (judgments == null) return g;
								// Its other bronnen as counted, and the judgments as the API counts them.
								const others = g.rows.filter((r) => r.ref.collection !== 'judgments');
								const loaded = judgments.rows.length
									? judgments.rows
									: g.rows.filter((r) => r.ref.collection === 'judgments');
								return {
									...g,
									rows: [...others, ...loaded],
									total: (g.total ?? others.length) + judgments.total,
									capped: false
								};
							});
						})
						.catch(() => {
							// A group that cannot be filled is left out, like an empty one.
						})
						.finally(() => {
							if (ac.signal.aborted) return;
							pending.delete(def.id);
							state.set({ id: selection.id, groups, loading: pending.size > 0, failed: false });
						});
				}
			})
			.catch(() => {
				if (!ac.signal.aborted)
					state.set({ id: selection.id, groups: [], loading: false, failed: true });
			});
	};

	return {
		subscribe: state.subscribe,
		load,
		reload: () => {
			current = null;
			load(last);
		},
		destroy: () => controller?.abort()
	};
}

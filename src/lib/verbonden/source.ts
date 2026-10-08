// One load of the verbindingen of the selected bron, read by the panel, the table,
// the legend of the network and the margin of the reader. The groups come from the
// group table; a group with a loader fills in as its request answers.
import { bucketTotals, lidCountsOf, neighborsOf } from '$lib/api/nodes';
import type { GraphStore } from '$lib/graph/graph-store';
import type { GraphNode } from '$lib/graph/types';
import { get, writable, type Readable } from 'svelte/store';
import { getNodeFirst, getNodeVerbonden } from '$lib/api/records';
import { getBuckets, type Neighbor } from '$lib/api/nodes';
import type { Collection } from '$lib/vocabulary';
import {
	buildGroups,
	groupCount,
	GROUPS,
	naarSoort,
	withUnresolvedAppeals,
	type Group,
	type Loader,
	type Match
} from './groups';
import { LOADERS } from './loaders';

/**
 * Loaders that read the rows of the node itself (an article's groups): a kind that has one
 * keeps the whole node. The others draw from five per bucket, ask a group's rows when it is
 * opened and a loader's buckets when it needs them (Thijs, 9 Oct: "alles zo lazy mogelijk").
 */
const MET_BUREN: ReadonlySet<Loader> = new Set<Loader>([
	'article-explanatory',
	'article-judgments',
	'article-cited-by',
	'article-changes'
]);

/** Whether Verbonden of this kind can start from five per bucket. */
export const luiTeLaden = (collection: Collection): boolean =>
	collection !== 'articles' &&
	(GROUPS[collection] ?? []).every((d) => !d.load || !MET_BUREN.has(d.load));

const neighborKey = (n: Neighbor) => `${n.relation}|${n.direction}|${n.collection}/${n.key}`;

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
	/** The verbindingen per lid of an article, from the light node, before the rows are in. */
	lidTellingen?: Map<string, number> | null;
};

export type VerbondenSource = Readable<VerbondenState> & {
	load: (selection: GraphNode | null) => void;
	/** Load the same bron again, after a failed request. */
	reload: () => void;
	/** The rows of one group, when it is opened: its own buckets, up to 200 each. */
	groep: (id: string) => void;
	/** Every row, for a filter, the table or an export: the whole node. */
	volledig: () => Promise<void>;
	destroy: () => void;
};

const EMPTY: VerbondenState = { id: null, groups: [], loading: false, failed: false };

export function createVerbondenSource(store: GraphStore): VerbondenSource {
	const state = writable<VerbondenState>(EMPTY);
	let controller: AbortController | null = null;
	let current: string | null = null;
	let last: GraphNode | null = null;
	// What the groups of the current bron are built from, so a group opened adds its rows.
	let basis: {
		id: string;
		collection: Collection;
		key: string;
		props: Record<string, unknown>;
		neighbors: Neighbor[];
		totals: Map<string, number>;
		signal: AbortSignal;
		volledig: boolean;
		geopend: Set<string>;
	} | null = null;
	let groups: Group[] = [];

	const bouw = (b: NonNullable<typeof basis>) => {
		const fresh = naarSoort(
			withUnresolvedAppeals(buildGroups(b.collection, b.neighbors, b.totals), b.props),
			b.props
		);
		// A loader's group keeps what its loader brought.
		return fresh.map((g) => (g.load ? (groups.find((x) => x.id === g.id) ?? g) : g));
	};
	const herbouw = () => {
		if (!basis) return;
		groups = bouw(basis);
		const st = get(state);
		state.set({ ...st, groups });
	};

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
				const preview = naarSoort(
					buildGroups(collection, neighborsOf(first), bucketTotals(first)),
					first.node.props as Record<string, unknown>
				)
					.filter((g) => g.load || g.rows.length > 0)
					.map((g) => ({ id: g.id, label: g.label, count: g.load ? null : groupCount(g) }));
				state.set({
					id: selection.id,
					groups: [],
					loading: true,
					failed: false,
					preview,
					lidTellingen: lidCountsOf(first)
				});
			})
			.catch(() => {});
		const lui = luiTeLaden(collection);
		basis = null;
		groups = [];
		(lui ? getNodeVerbonden(collection, key) : store.nodeResponse(collection, key))
			.then((response) => {
				if (ac.signal.aborted) return;
				const neighbors = neighborsOf(response);
				const totals = bucketTotals(response);
				const props = (response.node.props ?? {}) as Record<string, unknown>;
				basis = {
					id: selection.id,
					collection,
					key,
					props,
					neighbors,
					totals,
					signal: ac.signal,
					volledig: !lui,
					geopend: new Set()
				};
				groups = bouw(basis);
				const pending = new Set(groups.filter((g) => g.load).map((g) => g.id));
				state.set({ id: selection.id, groups, loading: pending.size > 0, failed: false });
				const ctx = {
					node: response.node,
					neighbors,
					totals,
					buren: (match: Match[]) =>
						lui ? getBuckets(collection, key, match, ac.signal) : Promise.resolve(neighbors),
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
		groep: (id) => {
			const b = basis;
			if (!b || b.volledig || b.geopend.has(id)) return;
			const def = (GROUPS[b.collection] ?? []).find((d) => d.id === id);
			if (!def?.match) return;
			b.geopend.add(id);
			getBuckets(b.collection, b.key, def.match, b.signal).then((found) => {
				if (b !== basis) return;
				const seen = new Set(b.neighbors.map(neighborKey));
				for (const n of found) {
					if (seen.has(neighborKey(n))) continue;
					seen.add(neighborKey(n));
					b.neighbors.push(n);
				}
				herbouw();
			});
		},
		volledig: () => {
			const b = basis;
			if (!b || b.volledig) return Promise.resolve();
			b.volledig = true;
			return store
				.nodeResponse(b.collection, b.key)
				.then((response) => {
					if (b !== basis) return;
					b.neighbors = neighborsOf(response);
					b.totals = bucketTotals(response);
					herbouw();
				})
				.catch(() => {
					b.volledig = false;
				});
		},
		destroy: () => controller?.abort()
	};
}

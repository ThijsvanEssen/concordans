// One load of the verbindingen of the selected bron, read by the panel, the table,
// the legend of the network and the margin of the reader. The groups come from the
// group table; a group with a loader fills in as its request answers.
import type { GraphStore } from '$lib/graph/store/types';
import type { GraphNode } from '$lib/graph/types';
import { get, writable, type Readable } from 'svelte/store';
import { getNodeFirst, getNodeVerbonden } from '$lib/api/records';
import { withoutHeaderDupes } from './header-dupes';
import { isAborted, report } from '$lib/api/errors';
import {
	bucketKey,
	bucketTotals,
	getBucketPages,
	getBuckets,
	lidCountsByCollection,
	lidCountsOf,
	neighborsOf,
	sumLidCounts,
	type Neighbor,
	type NodeGraph
} from '$lib/api/nodes';
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
import {
	DEFAULT_LOADER_OPTIONS,
	LOADERS,
	startOptions,
	type Loaded,
	type LoaderOptions
} from './loaders';
import { isInhoudGroep, isKernGroep } from '$lib/bron/behoort';
import type { LoadState } from '$lib/util/load.svelte';

/**
 * Whether Verbonden of a bron can start from five per bucket: a group's rows are asked when
 * it is opened, a loader's buckets when it needs them (Thijs, 9 Oct: "alles zo lazy mogelijk").
 * An article only where the API counts its leden (`lid_counts`, API 0.79.17): five rows per
 * bucket cannot count them. Counts still being counted (`lid_counts_pending`, API 0.79.44)
 * come with the full node: the API counts them, so it stays lazy.
 */
export const luiTeLaden = (collection: Collection, first: NodeGraph | null): boolean =>
	collection !== 'articles' ||
	(first != null && (first.lid_counts_pending === true || lidCountsOf(first) != null));

const neighborKey = (n: Neighbor) => `${n.relation}|${n.direction}|${n.collection}/${n.key}`;

/** The groups Verbonden lists: what its kern and its inhoud show elsewhere is left out. */
export const listedGroups = <G extends { id: string }>(collection: Collection, groups: G[]): G[] =>
	groups.filter((g) => !isKernGroep(collection, g) && !isInhoudGroep(collection, g));

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
	preview?: {
		id: string;
		label: string;
		count: number | null;
		/** The kind of its rows (a judgment's row is taller) and its section head, as drawn. */
		noun?: string;
		section?: string;
		/** Its order can be chosen: the line of that choice holds its place. */
		ordered?: boolean;
	}[];
	/** The verbindingen per lid of an article, as the API counts them (`lid_counts`). */
	lidTellingen?: Map<string, number> | null;
	/** The same per collection of the buckets, for the bronfilter (`memberCountsUnder`). */
	lidPerBak?: Map<string, Map<string, number>> | null;
	/** Whether the groups hold every row, not the first five per bucket. */
	volledig?: boolean;
	/**
	 * The groups whose loader is still under way and may have rows: each keeps its place in
	 * the order of the group table with "laden…", so nothing is put in above what stands
	 * (UX-toets 10 Oct: the judgments of 6:162 BW came after 10 s at the top).
	 */
	wachtend?: string[];
	/** Per waiting group, the rows the light node counts in its buckets: its place's height. */
	verwacht?: Record<string, number>;
	/** What the reader chose for the loaders: kept from bron to bron. */
	options: LoaderOptions;
	/** What the API counts per bucket (`relation/collection/direction`): the counts per soort. */
	buckets?: Map<string, number> | null;
	/** The groups with a further page of rows (`groep` asks it): "Meer laden". */
	meer?: ReadonlySet<string>;
};

type VerbondenSource = Readable<VerbondenState> & {
	load: (selection: GraphNode | null) => void;
	/** Load the same bron again, after a failed request. */
	reload: () => void;
	/** Choose another order or year for a group's loader: only that group is asked again. */
	reloadGroup: (id: string, options: Partial<LoaderOptions>) => void;
	/**
	 * The rows of one group, when it is opened or drawn: its own buckets, up to 200 each.
	 * Settles once they are in the groups.
	 */
	groep: (id: string) => Promise<void>;
	/** Every row, for a filter, the table or an export: the whole node. */
	volledig: () => Promise<void>;
	destroy: () => void;
};

const EMPTY = { id: null, groups: [], loading: false, failed: false };

/** A failed load of the verbindingen, for LoadState to say in the panel and the table. */
export const LOAD_FAILED = { status: 'error', error: null } as const satisfies LoadState<never>;

export function createVerbondenSource(store: GraphStore): VerbondenSource {
	let options = DEFAULT_LOADER_OPTIONS;
	const state = writable<VerbondenState>({ ...EMPTY, options });
	/** What the API counts per bucket of the current bron (`bucketTotals`), as soon as known. */
	let buckets: Map<string, number> | null = null;
	/** The groups with a further page: kept with every state. */
	let meer = new Set<string>();
	const put = (st: Omit<VerbondenState, 'options' | 'buckets' | 'meer'>) =>
		state.set({
			...st,
			groups: basis ? withoutHeaderDupes(st.groups, basis) : st.groups,
			options,
			buckets,
			meer
		});
	/** Runs the loader of a group of the current bron again; null before its groups stand. */
	let rerun: ((id: string) => void) | null = null;
	let controller: AbortController | null = null;
	let current: string | null = null;
	let last: GraphNode | null = null;
	// What the groups of the current bron are built from, so a group opened adds its rows.
	/** The whole node was asked for before `basis` stood. */
	let wilVolledig = false;
	let basis: {
		id: string;
		collection: Collection;
		key: string;
		props: Record<string, unknown>;
		neighbors: Neighbor[];
		totals: Map<string, number>;
		signal: AbortSignal;
		volledig: boolean;
		geopend: Map<string, Promise<void>>;
		/** Per group, where the next page of each of its buckets starts (null: at the end). */
		pages: Map<string, (number | null)[]>;
	} | null = null;
	let groups: Group[] = [];
	// A loader's rest, asked when its group is opened, the table or an export (`Loaded.meer`).
	const vervolg = new Map<string, () => Promise<Loaded>>();
	// A loader's next page, asked by "Meer laden" (`Loaded.page`): never all at once (T11).
	const pageOf = new Map<string, () => Promise<Loaded>>();
	const setNextPage = (id: string, page: (() => Promise<Loaded>) | undefined) => {
		if (page) pageOf.set(id, page);
		else pageOf.delete(id);
		if (page ? meer.has(id) : !meer.has(id)) return;
		meer = new Set(meer);
		if (page) meer.add(id);
		else meer.delete(id);
	};
	const takeOver = (id: string, loaded: Loaded) => {
		const { rows, total, mentions, years, courts, areas, cutBy, capped } = loaded;
		groups = groups.map((g) =>
			g.id === id
				? { ...g, rows, total, mentions, years, courts, areas, cutBy, capped: !!capped }
				: g
		);
		setNextPage(id, loaded.page);
		put({ ...get(state), groups });
	};
	const nextPage = (id: string): Promise<void> => {
		const page = pageOf.get(id);
		if (!page) return Promise.resolve();
		pageOf.delete(id);
		const b = basis;
		return page()
			.then((loaded) => {
				if (b === basis) takeOver(id, loaded);
			})
			.catch((e) => {
				report(`Verbonden ${id}, following page`, e);
				if (b === basis) pageOf.set(id, page);
			});
	};
	const vervolgVan = (id: string): Promise<void> => {
		const meer = vervolg.get(id);
		if (!meer) return Promise.resolve();
		vervolg.delete(id);
		const b = basis;
		return meer()
			.then((loaded) => {
				if (b === basis) takeOver(id, loaded);
			})
			.catch((e) => {
				report(`Verbonden ${id}, de rest`, e);
				// Asked again the next time it is opened.
				if (b === basis) vervolg.set(id, meer);
			});
	};

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
		put({ ...st, groups, volledig: basis.volledig });
	};

	const load = (selection: GraphNode | null) => {
		if (selection?.id === current) return;
		last = selection;
		controller?.abort();
		current = selection?.id ?? null;
		if (!selection) {
			buckets = null;
			put(EMPTY);
			return;
		}
		const ac = new AbortController();
		controller = ac;
		options = startOptions(selection.collection);
		buckets = null;
		put({ id: selection.id, groups: [], loading: true, failed: false });
		const { collection, key } = selection;
		let perBak: Map<string, Map<string, number>> | null = null;
		const first = getNodeFirst(collection, key);
		first
			.then((first) => {
				if (ac.signal.aborted) return;
				if (!buckets) {
					buckets = bucketTotals(first);
					if (get(state).groups.length > 0) put({ ...get(state) });
				}
				if (get(state).groups.length > 0) return;
				// The groups as they will stand, from the first paint (UX-toets e7a2f95, #1): a
				// loader's group by the buckets it reads, counted by the light node; a group the
				// node cannot foretell (its own endpoint: Toelichting, Wijzigingen) and an empty one
				// left out, as the full list puts them last or not at all.
				const tel = bucketTotals(first);
				const eigen = (first.node.props ?? {}) as Record<string, unknown>;
				const gebouwd = buildGroups(collection, neighborsOf(first), tel);
				const groepVan = new Map(gebouwd.map((g) => [g.id, g]));
				const preview = naarSoort(gebouwd, eigen)
					.map((g) => ({
						id: g.id,
						label: g.label,
						noun: g.noun,
						section: g.section,
						ordered: !!g.orders,
						onvoorspelbaar: !!g.load && !g.bakken && !g.section,
						count: g.load
							? g.bakken
								? g.bakken.reduce(
										(som, b) =>
											som + (tel.get(bucketKey(b.relation, b.collection, b.direction)) ?? 0),
										0
									)
								: null
							: groupCount(g)
					}))
					.filter((p) => !p.onvoorspelbaar && p.count !== 0)
					// What Verbonden leaves to the band and the reader (kern, inhoud) is not in it either.
					.filter((p) => {
						const g = groepVan.get(p.id);
						return !g || (!isKernGroep(collection, g) && !isInhoudGroep(collection, g));
					})
					.map(({ onvoorspelbaar: _, ...p }) => p);
				put({
					id: selection.id,
					groups: [],
					loading: true,
					failed: false,
					preview,
					lidTellingen: lidCountsOf(first),
					lidPerBak: lidCountsByCollection(first)
				});
			})
			// The groups come without their heads first; the full load says whether it failed.
			.catch((e) => report('Verbonden, lichte knoop', e));
		basis = null;
		rerun = null;
		wilVolledig = false;
		groups = [];
		vervolg.clear();
		pageOf.clear();
		let lui = true;
		// An article waits for its light node, to see whether the API counts its leden.
		// Without it, from the full node.
		(collection === 'articles'
			? first.catch((e) => {
					report('Verbonden, lichte knoop', e);
					return null;
				})
			: Promise.resolve(null)
		)
			.then((first) => {
				if (first) perBak = lidCountsByCollection(first);
				lui = luiTeLaden(collection, first);
				return lui ? getNodeVerbonden(collection, key) : store.nodeResponse(collection, key);
			})
			.then((response) => {
				if (ac.signal.aborted) return;
				// Counts the light node did not have yet (pending) are in the full one.
				perBak ??= lidCountsByCollection(response);
				const neighbors = neighborsOf(response);
				const totals = bucketTotals(response);
				buckets = totals;
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
					geopend: new Map(),
					pages: new Map()
				};
				meer = new Set();
				groups = bouw(basis);
				const pending = new Set(groups.filter((g) => g.load).map((g) => g.id));
				// A loader whose buckets the node counts empty will bring nothing: no place for it.
				const kanRijen = (id: string) => {
					const bakken = (GROUPS[collection] ?? []).find((d) => d.id === id)?.bakken;
					if (!bakken) return true;
					return bakken.some(
						// The node lists every bucket it has: one it does not list is empty (#36: on
						// HR 2019:2007 "Artikelen" stood 100 ms and went).
						(b) => (totals.get(bucketKey(b.relation, b.collection, b.direction)) ?? 0) > 0
					);
				};
				// What a waiting group will hold, where its buckets are counted (UX-toets 0.79.43, #1).
				const verwacht = Object.fromEntries(
					[...pending].flatMap((id) => {
						const bakken = (GROUPS[collection] ?? []).find((d) => d.id === id)?.bakken;
						if (!bakken) return [];
						const n = bakken.reduce(
							(som, b) => som + (totals.get(bucketKey(b.relation, b.collection, b.direction)) ?? 0),
							0
						);
						return n > 0 ? [[id, n]] : [];
					})
				);
				const zet = () =>
					put({
						id: selection.id,
						groups,
						loading: pending.size > 0,
						wachtend: [...pending].filter(kanRijen),
						verwacht,
						failed: false,
						lidTellingen: perBak ? sumLidCounts(perBak) : null,
						lidPerBak: perBak,
						volledig: basis?.volledig ?? false
					});
				zet();
				// A group whose rows show where a judgment cites: its edges again, with their
				// passages, once it has rows to show (not for the canvas: the payload grows 62%).
				for (const g of groups)
					if (g.rows.length && (GROUPS[collection] ?? []).find((d) => d.id === g.id)?.passages)
						groep(g.id, true).catch((e) => report('Verbonden passages', e));
				// The node now; a loader's further rows (`meer`) once the loaders are in.
				const alsGevraagd = () => {
					if (!wilVolledig) return;
					if (pending.size === 0) wilVolledig = false;
					volledig().catch((e) => report('Verbonden volledig', e));
				};
				alsGevraagd();
				const ctx = {
					node: response.node,
					neighbors,
					totals,
					buren: (match: Match[]) =>
						lui ? getBuckets(collection, key, match, ac.signal) : Promise.resolve(neighbors),
					signal: ac.signal
				};
				// The latest run of each group: an answer to an earlier choice is dropped.
				const runs = new Map<string, number>();
				const run = (id: string, load: Loader) => {
					const n = (runs.get(id) ?? 0) + 1;
					runs.set(id, n);
					const stale = () => ac.signal.aborted || runs.get(id) !== n;
					void LOADERS[load]({ ...ctx, options })
						.then(
							({
								rows,
								total,
								mentions,
								years,
								courts,
								areas,
								cutBy,
								judgmentsOf,
								meer: rest,
								page,
								capped
							}) => {
								if (stale()) return;
								if (rest) vervolg.set(id, rest);
								setNextPage(id, page);
								groups = groups.map((g) => {
									if (g.id === id)
										return {
											...g,
											rows,
											total,
											mentions,
											years,
											courts,
											areas,
											cutBy,
											capped: !!capped
										};
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
							}
						)
						.catch((e) => {
							// Broken off is no failure: the group then has no rows, not "kon niet laden".
							if (stale() || isAborted(e)) return;
							// It keeps its place, with "kon niet laden" and Opnieuw.
							report(`Verbonden ${load}`, e);
							groups = groups.map((g) => (g.id === id ? { ...g, failed: true, error: e } : g));
						})
						.finally(() => {
							if (stale()) return;
							pending.delete(id);
							zet();
							alsGevraagd();
						});
				};
				for (const def of groups) if (def.load) run(def.id, def.load);
				// Another order or year: the group waits in its place for its new rows.
				rerun = (id) => {
					const load = groups.find((g) => g.id === id)?.load;
					if (!load) return;
					vervolg.delete(id);
					setNextPage(id, undefined);
					pending.add(id);
					groups = groups.map((g) => (g.id === id ? { ...g, rows: [], failed: false } : g));
					zet();
					run(id, load);
				};
			})
			.catch((e) => {
				// Broken off by another than this reader: nothing to show, but no failure either.
				if (!ac.signal.aborted)
					put({ id: selection.id, groups: [], loading: false, failed: !isAborted(e) });
			});
	};

	function volledig(): Promise<void> {
		const rest = Promise.all([...vervolg.keys()].map(vervolgVan));
		const b = basis;
		// Asked before the first rows are in (an address with ?tabel=1): asked again then.
		if (!b) wilVolledig = true;
		if (!b || b.volledig) return rest.then(() => {});
		b.volledig = true;
		const node = store
			.nodeResponse(b.collection, b.key)
			.then((response) => {
				if (b !== basis) return;
				b.neighbors = neighborsOf(response);
				b.totals = bucketTotals(response);
				herbouw();
			})
			.catch((e) => {
				report('Verbonden, hele knoop', e);
				b.volledig = false;
			});
		return Promise.all([rest, node]).then(() => {});
	}

	return {
		subscribe: state.subscribe,
		load,
		reload: () => {
			current = null;
			load(last);
		},
		reloadGroup: (id, chosen) => {
			options = { ...options, ...chosen };
			state.update((st) => ({ ...st, options }));
			rerun?.(id);
		},
		groep,
		volledig,
		destroy: () => controller?.abort()
	};

	/**
	 * A group's own buckets, a page further each time (fifty a bucket, `BUCKET_PAGE`; never
	 * the whole at once, T11): the first page, then the next while there is one. With their
	 * passages where it shows them.
	 */
	function groep(id: string, zelfsVolledig = false): Promise<void> {
		if (vervolg.has(id)) return vervolgVan(id);
		if (pageOf.has(id)) return nextPage(id);
		const b = basis;
		if (!b || (b.volledig && !zelfsVolledig)) return Promise.resolve();
		const bezig = b.geopend.get(id);
		if (bezig) return bezig;
		const def = (GROUPS[b.collection] ?? []).find((d) => d.id === id);
		if (!def?.match) return Promise.resolve();
		const startAt = b.pages.get(id) ?? def.match.map(() => 0);
		const asks = def.match
			.map((bucket, i) => ({ bucket, offset: startAt[i], i }))
			.filter((a): a is { bucket: typeof a.bucket; offset: number; i: number } => a.offset != null);
		if (asks.length === 0) return Promise.resolve();
		const klaar = getBucketPages(
			b.collection,
			b.key,
			asks,
			b.signal,
			def.passages ? 'passages' : undefined
		)
			.then(({ items, next }) => {
				if (b !== basis) return;
				const following = [...startAt];
				asks.forEach((a, j) => (following[a.i] = next[j]));
				b.pages.set(id, following);
				meer = new Set(meer);
				if (following.some((o) => o != null)) meer.add(id);
				else meer.delete(id);
				const seen = new Map(b.neighbors.map((n, i) => [neighborKey(n), i]));
				for (const n of items) {
					const i = seen.get(neighborKey(n));
					// A row the light node gave already takes its passages from this one.
					if (i != null) {
						if (def.passages) b.neighbors[i] = n;
						continue;
					}
					seen.set(neighborKey(n), b.neighbors.length);
					b.neighbors.push(n);
				}
				herbouw();
			})
			.catch((e) => {
				report(`Verbonden ${id}, eigen bakken`, e);
			})
			.finally(() => {
				if (b === basis) b.geopend.delete(id);
			});
		b.geopend.set(id, klaar);
		return klaar;
	}
}

import type { QueryOf, Schema } from '$lib/api/types';
import { NODE_TYPES, type Collection, type Relation } from '$lib/vocabulary';
import { ApiError, api, clientFor, unwrap } from './client';
import { isNotFound } from './errors';
import { once } from './records';

// Keys are lower case in the API and the routes are case-sensitive.
const path = (collection: Collection, key: string) => ({ collection, key: key.toLowerCase() });

/** The most the API gives per bucket of a node. */
export const NODE_BUCKET = 200;

export const getNodeGraph = (
	collection: Collection,
	key: string,
	opts: {
		limit?: number;
		signal?: AbortSignal;
		/** One bucket or a few: their relations, node types and direction. */
		relations?: string;
		nodeTypes?: string;
		direction?: 'inbound' | 'outbound';
		/** Neighbours to skip in every bucket (a next page, `next_offset`). */
		offset?: number;
		/** `canvas`: the neighbours with only what the canvas draws (500 a page, API 0.79.45). */
		props?: 'full' | 'canvas';
		/** `passages`: an edge of a judgment's citation with the places it cites (API 0.79.55),
		 *  asked only where a row or a card shows them, not for the canvas. */
		edgeMeta?: 'passages';
		/**
		 * A node waits as long as the API does: a full one can take a cold API more than 10 s
		 * (art. 3:2 Awb, 651 kB, prod 9 Oct), and is then not cut off and asked again. `short`:
		 * a light node (one neighbour per bucket), the ordinary 10 s.
		 */
		wait?: 'short' | 'long';
	} = {}
) =>
	unwrap(
		clientFor(opts.wait).GET('/api/nodes/{collection}/{key}', {
			params: {
				path: path(collection, key),
				query: {
					limit: opts.limit,
					relations: opts.relations,
					node_types: opts.nodeTypes,
					direction: opts.direction,
					offset: opts.offset,
					props: opts.props,
					edge_meta: opts.edgeMeta
				}
			},
			signal: opts.signal
		})
	);

export type NodeGraph = Schema<'NodeGraphResponse'>;
export type Neighbor = Schema<'NeighborDTO'>;

/** One bucket or a few of one direction: a group's or a loader's. */
export type Bucket = {
	relation: Relation | Relation[];
	direction?: 'inbound' | 'outbound';
	collection: Collection | Collection[];
};

/**
 * The rows of these buckets of a bron, up to NODE_BUCKET each, one request per bucket; one that
 * fails fails them all, so no group stands with part of its rows as if whole.
 */
export const getBuckets = (
	collection: Collection,
	key: string,
	buckets: Bucket[],
	signal?: AbortSignal,
	edgeMeta?: 'passages'
): Promise<Neighbor[]> =>
	Promise.all(
		buckets.map((b) =>
			getNodeGraph(collection, key, {
				limit: NODE_BUCKET,
				relations: [b.relation].flat().join(','),
				nodeTypes: [b.collection]
					.flat()
					.map((c) => NODE_TYPES[c])
					.join(','),
				direction: b.direction,
				signal,
				edgeMeta
			})
		)
	).then((results) => results.flatMap(neighborsOf));

/** The bucket of one relation, direction and collection in a node response, where it has one. */
export const findBucket = (
	response: NodeGraph | null | undefined,
	b: { relation: string; direction: string; collection: string }
) =>
	response?.neighbors.buckets?.find(
		(x) => x.relation === b.relation && x.direction === b.direction && x.collection === b.collection
	);

/** The neighbours of a node response, whatever bucket they are in. */
export const neighborsOf = (response: NodeGraph): Neighbor[] =>
	response.neighbors.buckets?.flatMap((b) => b.items) ?? [];

export const bucketKey = (relation: string | null, collection: string, direction: string) =>
	`${relation}/${collection}/${direction}`;

/** How many neighbours each bucket has in the database. */
export function bucketTotals(response: NodeGraph): Map<string, number> {
	const totals = new Map<string, number>();
	for (const b of response.neighbors.buckets ?? []) {
		totals.set(bucketKey(b.relation, b.collection, b.direction), b.total);
	}
	return totals;
}

/**
 * The verbindingen per lid of an article, over every bucket as a whole (API 0.79.17,
 * `lid_counts`; "" for none that names a lid); null where the API gives none.
 */
export function lidCountsOf(response: NodeGraph): Map<string, number> | null {
	const per = lidCountsByCollection(response);
	return per ? sumLidCounts(per) : null;
}

/** The counts per lid of each collection's buckets (`lid_counts`); null where the API gives none. */
export function lidCountsByCollection(
	response: NodeGraph
): Map<string, Map<string, number>> | null {
	let per: Map<string, Map<string, number>> | null = null;
	for (const b of response.neighbors.buckets ?? []) {
		const lid = b.lid_counts;
		if (!lid) continue;
		per ??= new Map();
		const of = per.get(b.collection) ?? new Map<string, number>();
		per.set(b.collection, of);
		for (const [k, n] of Object.entries(lid)) of.set(k, (of.get(k) ?? 0) + n);
	}
	return per;
}

/** The counts per lid of these collections together (all of them without `keep`). */
export function sumLidCounts(
	per: Map<string, Map<string, number>>,
	keep: (collection: string) => boolean = () => true
): Map<string, number> {
	const counts = new Map<string, number>();
	for (const [collection, of] of per) {
		if (!keep(collection)) continue;
		for (const [k, n] of of) counts.set(k, (counts.get(k) ?? 0) + n);
	}
	return counts;
}

/** Every node and edge within `depth` hops, in one traversal. */
export const getNodeNeighborhood = (
	collection: Collection,
	key: string,
	opts: {
		depth?: number;
		cap?: number;
		relations?: string[];
		nodeTypes?: string[];
		/** `canvas`: the other nodes with only what the canvas draws (API 0.79.41, #472); an
		 *  API that does not know it gives every prop, as `full`. */
		props?: 'full' | 'canvas';
		/** Collections the walk reaches but does not go through (API 0.80.1, #871). */
		stopAt?: readonly Collection[];
		signal?: AbortSignal;
	} = {}
) =>
	unwrap(
		api.GET('/api/nodes/{collection}/{key}/neighborhood', {
			params: {
				path: path(collection, key),
				query: {
					depth: opts.depth ?? 3,
					cap: opts.cap ?? 200,
					relations: opts.relations?.join(','),
					node_types: opts.nodeTypes?.join(','),
					props: opts.props,
					stop_at: opts.stopAt?.join(',')
				}
			},
			signal: opts.signal
		})
	);

/** The paths between bronnen (`/api/paths`). */
export const getPaths = (query: QueryOf<'/api/paths'>) =>
	unwrap(api.GET('/api/paths', { params: { query } }));

/**
 * What two to five bronnen share: the neighbours of each of them, per collection, a page of
 * each, with the edges by which every one hangs at each bron asked (`links`). The weergave
 * Verband of the werkplek (besluit 39).
 */
export async function getShared(
	query: QueryOf<'/api/nodes/shared'>,
	signal?: AbortSignal
): Promise<Schema<'SharedNeighborsResponse'> | null> {
	// From API 0.80.8 (A200, #937); a 404 all the same says: not there.
	return unwrap(api.GET('/api/nodes/shared', { params: { query }, signal })).catch((e) => {
		if (!isNotFound(e)) throw e;
		return null;
	});
}

/**
 * The surroundings of a stuk, zaak, stemming, toezegging or activiteit in one answer (API
 * 0.80.8, #948): its indieners, its dossier as one node, the laws it changes or names, the
 * votes on it, what it answers and where it was made. Null for another kind or a bron not there.
 */
export const getSurroundings = (collection: Collection, key: string) =>
	once(`nodes/${collection}/${key}/surroundings`, () =>
		unwrap(
			api.GET('/api/nodes/{collection}/{key}/surroundings', {
				params: { path: { collection, key } }
			})
		).catch((e) => {
			if (isNotFound(e) || (e instanceof ApiError && e.status === 422)) return null;
			throw e;
		})
	);

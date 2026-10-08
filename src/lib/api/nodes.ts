import type { Schema } from '$lib/api/types';
import { NODE_TYPES, type Collection, type Relation } from '$lib/vocabulary';
import { api, unwrap, zoekApi } from './client';

// Keys are lower case in the API and the routes are case-sensitive.
const path = (collection: Collection, key: string) => ({ collection, key: key.toLowerCase() });

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
	} = {}
) =>
	// A full node can take a cold API more than 10 s (art. 3:2 Awb, 651 kB, prod 9 Oct): it
	// waits as long as the API does, so the work is not cut off and asked again.
	unwrap(
		((opts.limit ?? 0) > 1 ? zoekApi : api).GET('/api/nodes/{collection}/{key}', {
			params: {
				path: path(collection, key),
				query: {
					limit: opts.limit,
					relations: opts.relations,
					node_types: opts.nodeTypes,
					direction: opts.direction
				}
			},
			signal: opts.signal
		})
	);

type NodeGraph = Schema<'NodeGraphResponse'>;
export type Neighbor = Schema<'NeighborDTO'>;

/** One bucket or a few of one direction: a group's or a loader's. */
export type Bucket = {
	relation: Relation | Relation[];
	direction?: 'inbound' | 'outbound';
	collection: Collection | Collection[];
};

/** The rows of these buckets of a bron, up to 200 each, one request per bucket. */
export const getBuckets = (
	collection: Collection,
	key: string,
	buckets: Bucket[],
	signal?: AbortSignal
): Promise<Neighbor[]> =>
	Promise.allSettled(
		buckets.map((b) =>
			getNodeGraph(collection, key, {
				limit: 200,
				relations: [b.relation].flat().join(','),
				nodeTypes: [b.collection]
					.flat()
					.map((c) => NODE_TYPES[c])
					.join(','),
				direction: b.direction,
				signal
			})
		)
	).then((results) =>
		results.flatMap((r) => (r.status === 'fulfilled' ? neighborsOf(r.value) : []))
	);

/** The neighbours of a node response, whatever bucket they are in. An API before 0.5 lists them flat. */
export const neighborsOf = (response: NodeGraph): Neighbor[] =>
	response.neighbors.buckets?.flatMap((b) => b.items) ??
	(response.neighbors as { all?: Neighbor[] }).all ??
	[];

export const bucketKey = (relation: string | null, collection: string, direction: string) =>
	`${relation}/${collection}/${direction}`;

/** How many neighbours each bucket has in the database; empty for an API before 0.5. */
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
	let counts: Map<string, number> | null = null;
	for (const b of response.neighbors.buckets ?? []) {
		const lid = (b as { lid_counts?: Record<string, number> | null }).lid_counts;
		if (!lid) continue;
		counts ??= new Map();
		for (const [k, n] of Object.entries(lid)) counts.set(k, (counts.get(k) ?? 0) + n);
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
					node_types: opts.nodeTypes?.join(',')
				}
			},
			signal: opts.signal
		})
	);

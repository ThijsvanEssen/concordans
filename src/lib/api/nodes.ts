import type { Schema } from '$lib/api/types';
import type { Collection } from '$lib/vocabulary';
import { api, unwrap } from './client';

// Keys are lower case in the API and the routes are case-sensitive.
const path = (collection: Collection, key: string) => ({ collection, key: key.toLowerCase() });

export const getNodeGraph = (
	collection: Collection,
	key: string,
	opts: { limit?: number; signal?: AbortSignal } = {}
) =>
	unwrap(
		api.GET('/api/nodes/{collection}/{key}', {
			params: { path: path(collection, key), query: { limit: opts.limit } },
			signal: opts.signal
		})
	);

type NodeGraph = Schema<'NodeGraphResponse'>;
export type Neighbor = Schema<'NeighborDTO'>;

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

/** Every node and edge within `depth` hops, in one traversal. */
export const getNodeNeighborhood = (
	collection: Collection,
	key: string,
	opts: { depth?: number; cap?: number; signal?: AbortSignal } = {}
) =>
	unwrap(
		api.GET('/api/nodes/{collection}/{key}/neighborhood', {
			params: {
				path: path(collection, key),
				query: { depth: opts.depth ?? 3, cap: opts.cap ?? 200 }
			},
			signal: opts.signal
		})
	);

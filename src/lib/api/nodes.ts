import type { Collection } from '$lib/vocabulary';
import { api, unwrap } from './client';

// Keys are lower case in the API and the routes are case-sensitive.
const path = (collection: Collection, key: string) => ({ collection, key: key.toLowerCase() });

export const getNodeGraph = (
	collection: Collection,
	key: string,
	opts: { neighborLimit?: number; signal?: AbortSignal } = {}
) =>
	unwrap(
		api.GET('/api/nodes/{collection}/{key}', {
			params: { path: path(collection, key), query: { neighbor_limit: opts.neighborLimit } },
			signal: opts.signal
		})
	);

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

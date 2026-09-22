import { getNodeGraph, getNodeNeighborhood } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import { nodeId } from '$lib/vocabulary';
import { get } from 'svelte/store';
import { relationOf } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createExpansion(
	ctx: GraphContext
): Pick<GraphStore, 'expandNode' | 'expandNeighborhood' | 'nodeResponse'> {
	const {
		nodes,
		cache,
		filtersStore,
		emit,
		touchNode,
		addEdge,
		drawable,
		passesThreshold,
		mergeResponse,
		signal
	} = ctx;

	// One request per bron serves the canvas and the panel Verbonden. The API applies
	// `limit` after its cap per relation and collection, so a low limit cuts whole
	// groups off; this one lets every bucket through.
	const ALL_BUCKETS = 1000;
	const inflight = new Map<string, Promise<Schema<'NodeGraphResponse'>>>();

	const nodeResponse: GraphStore['nodeResponse'] = (collection, key, opts = {}) => {
		const id = nodeId(collection, key.toLowerCase());
		const cached = opts.force ? undefined : cache.get(id);
		if (cached) return Promise.resolve(cached);
		let request = inflight.get(id);
		if (!request) {
			request = getNodeGraph(collection, key, { limit: ALL_BUCKETS, signal: signal() })
				.then((response) => {
					cache.set(id, response);
					return response;
				})
				.finally(() => inflight.delete(id));
			inflight.set(id, request);
		}
		return request;
	};

	return {
		nodeResponse,

		expandNode: async (collection, key, opts = {}) => {
			const id = nodeId(collection, key.toLowerCase());
			const response = await nodeResponse(collection, key, opts);
			const draw = opts.neighborLimit ?? get(filtersStore).neighborLimit;
			return nodes.get(mergeResponse(response, draw) ?? id) ?? null;
		},

		expandNeighborhood: async (collection, key, opts = {}) => {
			const response = await getNodeNeighborhood(collection, key, { ...opts, signal: signal() });

			const drawn = new Set<string>();
			for (const node of response.nodes) {
				const graphNode = drawable(node);
				if (!graphNode) continue;
				touchNode(graphNode.id, graphNode);
				drawn.add(graphNode.id);
			}

			// An edge to an instrument is left out: instruments are drawn as clusters.
			for (const e of response.edges) {
				const relation = relationOf(e.relation);
				const source = drawn.has(e.source) && drawn.has(e.target) ? nodes.get(e.source) : null;
				if (!relation || !source || !passesThreshold(relation, source.kind, e.confidence)) continue;
				addEdge(e.source, e.target, relation, { confidence: e.confidence, status: e.status });
			}

			emit();
			return nodes.get(response.focal_id) ?? null;
		}
	};
}

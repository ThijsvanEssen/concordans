import { getNodeGraph, getNodeNeighborhood } from '$lib/api/nodes';
import { nodeId } from '$lib/vocabulary';
import { get } from 'svelte/store';
import { relationOf } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createExpansion(
	ctx: GraphContext
): Pick<GraphStore, 'expandNode' | 'expandNeighborhood'> {
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

	return {
		expandNode: async (collection, key, opts = {}) => {
			const id = nodeId(collection, key.toLowerCase());
			let response = opts.force ? undefined : cache.get(id);
			if (!response) {
				const neighborLimit = opts.neighborLimit ?? get(filtersStore).neighborLimit;
				response = await getNodeGraph(collection, key, { neighborLimit, signal: signal() });
				cache.set(id, response);
			}
			return nodes.get(mergeResponse(response) ?? id) ?? null;
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

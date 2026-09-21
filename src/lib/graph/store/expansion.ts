import { recordInstrument, ensureInstrumentMeta } from '$lib/api/instrument-cache';
import { getNodeGraph, getNodeNeighborhood } from '$lib/api/nodes';
import {
	graphNodeId,
	nodeToGraphNode,
	detectNodeKind,
	classifyEdgeKind,
	SCAFFOLDING_RELATIONS
} from '../types';
import { DEFAULT_EXPANSION } from './types';
import { get } from 'svelte/store';
import type { NodeNeighborhoodResponse, BaseNode } from '$lib/api/types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createExpansion(
	ctx: GraphContext
): Pick<GraphStore, 'expandNode' | 'expandNeighborhood'> {
	const { nodes, edges, cache, filtersStore, updateNodes, updateEdges, touchNode, mergeResponse } =
		ctx;

	return {
		expandNode: async (collection, key, opts = {}) => {
			const f = get(filtersStore);
			const normalizedOpts = {
				...DEFAULT_EXPANSION,
				neighborLimit: f.neighborLimit ?? DEFAULT_EXPANSION.neighborLimit,
				semanticConfidenceThreshold:
					f.semanticThreshold ?? DEFAULT_EXPANSION.semanticConfidenceThreshold,
				...opts
			};
			const nodeId = graphNodeId(collection, key);
			if (!normalizedOpts.force && cache.has(nodeId)) {
				const cachedResponse = cache.get(nodeId);
				if (cachedResponse) {
					mergeResponse(cachedResponse, normalizedOpts);
					return nodes.get(nodeId) ?? null;
				}
			}
			const response = await getNodeGraph(collection, key, {
				neighborLimit: normalizedOpts.neighborLimit
			});
			cache.set(nodeId, response);
			mergeResponse(response, normalizedOpts);
			// The API may normalise the key (e.g. lowercase), so look up by the
			// actual id returned in the response rather than the caller-supplied one.
			const actualId = graphNodeId(response.node.collection, response.node.key);
			return nodes.get(actualId) ?? nodes.get(nodeId) ?? null;
		},
		expandNeighborhood: async (collection, key, opts = {}) => {
			const f = get(filtersStore);
			const resp: NodeNeighborhoodResponse = await getNodeNeighborhood(collection, key, {
				depth: opts.depth ?? 3,
				cap: opts.cap ?? 200
			});

			// Pass 1: register every discovered node. Instruments stay
			// metadata-only (they're rendered as clusters, not nodes); seed the
			// instrument cache so cluster labels resolve.
			const nodeById = new Map<string, BaseNode>();
			for (const n of resp.nodes) {
				nodeById.set(n.id, n);
				if (detectNodeKind(n) === 'instrument') {
					const p = (n.props ?? {}) as Record<string, unknown>;
					recordInstrument({
						key: n.key,
						bwb_id: (p['bwb_id'] as string | null) ?? null,
						display_name: n.display_name,
						title: (p['title'] as string | null) ?? null,
						citation_title: (p['citation_title'] as string | null) ?? null,
						short_title: (p['short_title'] as string | null) ?? null
					});
					continue;
				}
				const gn = nodeToGraphNode(n);
				touchNode(gn.id, gn);

				// Seed instrument cache from article display names — same as
				// mergeResponse(), so article hover labels still resolve.
				if (n.collection === 'instrument_articles') {
					const np = (n.props ?? {}) as Record<string, unknown>;
					const bwb = (np['bwb_id'] as string | null) ?? null;
					const dn = n.display_name ?? '';
					const m = dn.match(/^Artikel\s+\S+\s+(.+?)\.?\s*$/);
					if (bwb && m) {
						recordInstrument({ bwb_id: bwb, short_title: m[1] });
						ensureInstrumentMeta(bwb);
					}
				}
			}

			// Pass 2: register edges between known nodes. Skip edges whose
			// endpoint is an instrument (cluster) — they're modelled visually.
			for (const e of resp.edges) {
				const rel = e.relation ?? '';
				if (!f.showScaffolding && SCAFFOLDING_RELATIONS.has(rel)) continue;
				const srcNode = nodeById.get(e.source);
				const tgtNode = nodeById.get(e.target);
				if (!srcNode || !tgtNode) continue;
				if (detectNodeKind(srcNode) === 'instrument' || detectNodeKind(tgtNode) === 'instrument') {
					continue;
				}
				const sourceId = graphNodeId(srcNode.collection, srcNode.key);
				const targetId = graphNodeId(tgtNode.collection, tgtNode.key);
				const targetKind = detectNodeKind(tgtNode);
				const sourceKind = detectNodeKind(srcNode);
				const kind = classifyEdgeKind(
					rel,
					sourceKind,
					targetKind === 'judgment' ? 'judgment' : undefined
				);
				if (
					kind === 'citation' &&
					e.confidence != null &&
					e.confidence < (f.semanticThreshold ?? 0)
				) {
					continue;
				}
				const edgeId = `${sourceId}->${targetId}:${rel || kind}`;
				edges.set(edgeId, {
					id: edgeId,
					source: sourceId,
					target: targetId,
					kind,
					label: rel || kind,
					directed: true,
					confidence: e.confidence,
					relation: rel || null,
					meta: null
				});
			}

			// Publish the BFS payload to subscribers. Without this the convergence
			// walk in expandWithConvergencePaths reads a stale `get(store.edges)`
			// and can't find any deeper paths — every BFS hop past the initial
			// expandNode would be invisible to the keep-set computation.
			updateNodes();
			updateEdges();

			// Return the focal node so callers can chain (set selection etc.).
			const focal = nodeById.get(resp.focal_id);
			if (!focal) return null;
			const focalId = graphNodeId(focal.collection, focal.key);
			return nodes.get(focalId) ?? null;
		}
	};
}

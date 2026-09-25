import { getNodeGraph, getNodeNeighborhood } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import {
	containerIdFor,
	containerKindOf,
	getContainerGroup,
	isContainerMembership,
	recordContainerMember
} from '../container-membership';
import { nodeId } from '$lib/vocabulary';
import { get } from 'svelte/store';
import { nodeToGraphNode, relationOf } from '../types';
import type { GraphContext } from './context';
import type { GraphStore } from './types';

export function createExpansion(
	ctx: GraphContext
): Pick<GraphStore, 'expandNode' | 'expandNeighborhood' | 'nodeResponse'> {
	const {
		nodes,
		cache,
		pinned,
		selectionStore,
		filtersStore,
		emit,
		touchNode,
		addEdge,
		drawable,
		lawAnchor,
		recordContainerFor,
		passesThreshold,
		mergeResponse,
		pruneToIds,
		signal
	} = ctx;

	// One request per bron serves the canvas and the panel Verbonden. API 0.5 applies
	// `limit` per bucket (relation, collection, direction) and allows at most 200; every
	// bucket then comes with its total.
	const ALL_BUCKETS = 200;
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
			const additive = !!opts.relations || !!opts.additive;

			const byId = new Map(response.nodes.map((n) => [`${n.collection}/${n.key}`, n]));
			const drawn = new Set<string>();
			for (const node of response.nodes) {
				// The requested bron itself is drawn even when it is a container: it stays
				// selectable for the reader, though `GraphView` never draws it as a canvas
				// node. A container met only as a neighbour is folded into a hull instead.
				const isFocal = `${node.collection}/${node.key}` === response.focal_id;
				if (isFocal) {
					const containerKind = containerKindOf(node.collection);
					if (containerKind) recordContainerFor(node, containerKind);
				}
				const graphNode = isFocal ? nodeToGraphNode(node) : drawable(node);
				if (!graphNode) continue;
				touchNode(graphNode.id, graphNode);
				drawn.add(graphNode.id);
			}

			// An edge to a container is recorded rather than drawn, whether the container
			// is a neighbour left out above or the bron this neighbourhood is centred on
			// (`isContainerMembership`: any relation, except a wet, where only PART_OF —
			// an article — counts; a stuk that merely AMENDS or REFERS_TO the wet is not
			// one of its articles and stays a dropped edge, not a member of its hull).
			for (const e of response.edges) {
				const relation = relationOf(e.relation);
				if (!relation) continue;
				const targetNode = byId.get(e.target);
				const targetKind = targetNode && containerKindOf(targetNode.collection);
				if (targetKind && isContainerMembership(targetKind, relation) && drawn.has(e.source)) {
					recordContainerMember(targetKind, containerIdFor(targetNode!), e.source, relation);
					continue;
				}
				// A wet a drawn stuk changes is drawn as its anchor (`lawAnchor`).
				const changed = targetNode && drawn.has(e.source) && lawAnchor(targetNode, relation);
				if (changed) {
					drawn.add(changed.id);
					addEdge(e.source, changed.id, relation, { confidence: e.confidence, status: e.status });
					continue;
				}
				const sourceNode = byId.get(e.source);
				const sourceKind = sourceNode && containerKindOf(sourceNode.collection);
				if (sourceKind && isContainerMembership(sourceKind, relation) && drawn.has(e.target)) {
					recordContainerMember(sourceKind, containerIdFor(sourceNode!), e.target, relation);
					continue;
				}
				if (!drawn.has(e.source) || !drawn.has(e.target)) continue;
				const source = nodes.get(e.source);
				if (!source || !passesThreshold(relation, source.kind, e.confidence)) continue;
				addEdge(e.source, e.target, relation, { confidence: e.confidence, status: e.status });
			}

			// A neighbourhood request replaces the canvas's exploratory context: without
			// this, a bron revisited after browsing elsewhere keeps edges from every stop
			// along the way, so it looks more cited than its own neighbourhood shows. Pinned
			// bronnen and the selection are the only things that survive a refocus.
			// A request narrowed to some relations, or asked to add, replaces nothing.
			if (additive) {
				emit();
				return nodes.get(response.focal_id) ?? null;
			}
			const keep = new Set(drawn);
			keep.add(response.focal_id);
			for (const id of pinned) keep.add(id);
			const selectedId = get(selectionStore)?.id;
			if (selectedId) keep.add(selectedId);
			// This request's own edges share one cap across every relation, so a focal
			// commissie or fractie with hundreds of activiteiten can crowd its own leden
			// out entirely. The earlier, per-bucket bron response has no such ceiling;
			// keep what it already recorded as this container's members.
			const focalNode = byId.get(response.focal_id);
			const focalContainerKind = focalNode && containerKindOf(focalNode.collection);
			if (focalContainerKind) {
				const group = getContainerGroup(containerIdFor(focalNode!) ?? '');
				if (group) for (const id of group.members) keep.add(id);
			}
			pruneToIds(keep);

			emit();
			return nodes.get(response.focal_id) ?? null;
		}
	};
}

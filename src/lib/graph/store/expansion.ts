import { getNodeNeighborhood } from '$lib/api/nodes';
import {
	abortable,
	CANVAS_BUCKET,
	getNode,
	getNodeCanvas,
	getNodeFirst,
	getNodeHull
} from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { containerIdFor, containerKindOf, focusKindOf } from '../container-membership';
import { ACTORS, withoutDetours } from '../neighborhood';
import { NODE_TYPES, nodeId, type Collection } from '$lib/vocabulary';
import { get, writable } from 'svelte/store';
import { lawIdOf, nodeToGraphNode, relationOf } from '../types';
import { COLLECTION_ROLE } from '../collection-role';
import type { GraphContext } from './context';
import { isPublication, periodOf, placeConnection, type End } from './placement';
import {
	NEIGHBORHOOD_CAP,
	NEIGHBORHOOD_DEPTH,
	type GraphStore,
	type NeighborhoodReach
} from './types';

export function createExpansion(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'peekNode'
	| 'expandNode'
	| 'expandNeighborhood'
	| 'askNeighborhood'
	| 'nodeResponse'
	| 'neighborhood'
> {
	const {
		nodes,
		cache,
		pinned,
		containers,
		selectionStore,
		filtersStore,
		emit,
		touchNode,
		addEdge,
		drawable,
		anchorContainer,
		threshold,
		mergeResponse,
		pruneToIds,
		trimToCap,
		signal
	} = ctx;

	const neighborhoodStore = writable<NeighborhoodReach | null>(null);

	// One request per bron serves the canvas, the panel Verbonden and a reader (`getNode`:
	// 200 per bucket, the most API 0.5 allows; every bucket comes with its total).
	// The neighbourhood without the kinds the canvas does not draw around a focus (a zaak,
	// a version: COLLECTION_ROLE): they would take the cap. A member's 1,019 zaken
	// filled all 150 places and the canvas showed the member alone (UX test 10 Oct, #11).
	const drawnTypes = (focus: Collection) =>
		(Object.keys(NODE_TYPES) as Collection[])
			.filter((c) => c === focus || COLLECTION_ROLE[c].neighbour)
			.map((c) => NODE_TYPES[c]);

	const nodeResponse: GraphStore['nodeResponse'] = (collection, key) => {
		const id = nodeId(collection, key.toLowerCase());
		const cached = cache.get(id);
		if (cached) return Promise.resolve(cached);
		// getNode shares one request between all who ask (once); a reader that wants a bucket of
		// the same node (a lid's AUTHORED) gets it too. A reset of the canvas drops this answer,
		// not the request.
		return abortable(getNode(collection, key), signal()).then((response) => {
			cache.set(id, response);
			return response;
		});
	};

	type SubNode = Schema<'NodeNeighborhoodResponse'>['nodes'][number];
	type SubEdge = Schema<'NodeNeighborhoodResponse'>['edges'][number];

	/**
	 * Draws the nodes and edges of a subgraph (a neighbourhood) by the canvas's rules: a container becomes a hull, a wet a stuk changes its
	 * anchor, an edge under the threshold stays out. Returns what it drew.
	 */
	function mergeSubgraph(nodesIn: SubNode[], edgesIn: SubEdge[], focalId: string | null) {
		const byId = new Map<string, SubNode>(nodesIn.map((n) => [nodeId(n.collection, n.key), n]));
		const drawn = new Set<string>();
		for (const node of nodesIn) {
			// The requested bron itself is drawn even when it is not drawn as a neighbour (a
			// zaak): it stays selectable for the reader. A container in focus is
			// drawn as its anchor, as the centre of a node response is; one met only as a
			// neighbour is folded into a hull instead.
			const id = nodeId(node.collection, node.key);
			const anchored = id === focalId;
			const graphNode =
				anchored && focusKindOf(node.collection)
					? anchorContainer(node)
					: id === focalId
						? nodeToGraphNode(node)
						: drawable(node);
			if (!graphNode) continue;
			touchNode(graphNode.id, graphNode);
			drawn.add(graphNode.id);
		}

		// Where each edge lands is `placeConnection`'s to say: an edge to a container is
		// recorded in its hull rather than drawn (a stuk that merely AMENDS or REFERS_TO a wet
		// is not one of its articles and stays off), a wet a drawn stuk changes is drawn as its
		// anchor.
		// The focus is the hull it is drawn as then (`focusKindOf`).
		const kindOf = (id: string, node: SubNode) =>
			id === focalId ? focusKindOf(node.collection) : containerKindOf(node.collection);
		const endOf = (id: string, node: SubNode | undefined): End => ({
			publication: isPublication(node),
			hull: node ? kindOf(id, node) : null,
			drawn: drawn.has(id),
			drawClass: nodes.get(id)?.drawClass ?? 'other'
		});
		for (const e of edgesIn) {
			const relation = relationOf(e.relation);
			if (!relation) continue;
			const ends = { source: byId.get(e.source), target: byId.get(e.target) };
			const placement = placeConnection({
				relation,
				source: endOf(e.source, ends.source),
				target: endOf(e.target, ends.target),
				confidence: e.confidence,
				threshold: threshold()
			});
			const id = { source: e.source, target: e.target };
			if (placement.anchor) {
				const point = anchorContainer(ends[placement.anchor]!);
				if (!point) continue;
				drawn.add(point.id);
				id[placement.anchor] = point.id;
			}
			if (placement.place === 'member') {
				const hull = ends[placement.hull]!;
				const member = placement.hull === 'source' ? id.target : id.source;
				containers.recordMember(
					kindOf(e[placement.hull], hull)!,
					containerIdFor(hull),
					member,
					relation,
					placement.seat ? periodOf(e.meta) : null
				);
			} else if (placement.place === 'line') {
				addEdge(id.source, id.target, relation, { confidence: e.confidence, status: e.status });
			} else if (placement.anchor === 'source' && isPublication(ends.source)) {
				// A publication states what it enacts or changes: a line to the wet of that article,
				// where the wet is on the canvas (Netwerkcanvas, Staatsblad-publicatie).
				const law = lawIdOf(ends.target?.props);
				const wet = law ? nodes.get(nodeId('instruments', law.toLowerCase())) : undefined;
				if (wet?.anchor)
					addEdge(id.source, wet.id, relation, { confidence: e.confidence, status: e.status });
			}
		}
		return { byId, drawn };
	}

	const askNeighborhood: GraphStore['askNeighborhood'] = (collection, key, opts = {}) => {
		// The canvas draws only its nodes' names and kinds: the light props (CANVAS_PROPS, audited
		// 10 Oct). The amendments timetable asks the same route with every prop. A full
		// neighbourhood stops at a lid, fractie, commissie or kabinet: its cap goes to what
		// the focus itself touches (#871).
		const asked = getNodeNeighborhood(collection, key, {
			...opts,
			nodeTypes: opts.nodeTypes ?? drawnTypes(collection),
			props: 'canvas',
			stopAt: opts.relations ? undefined : ACTORS,
			signal: signal()
		});
		// Asked ahead of its merge: a failure is the merge's to report, not an unhandled one.
		asked.catch(() => {});
		return asked;
	};

	return {
		nodeResponse,

		askNeighborhood,

		// The bron itself before its neighbours: from the light node (`getNodeFirst`), so the
		// reader and the panels start while the full node is still on its way.
		peekNode: async (collection, key) => {
			const id = nodeId(collection, key.toLowerCase());
			const known = nodes.get(id);
			if (known) return known;
			const response = await abortable(getNodeFirst(collection, key), signal());
			const node = nodeToGraphNode(response.node);
			if (!node) return null;
			touchNode(node.id, node);
			emit();
			return nodes.get(node.id) ?? null;
		},

		expandNode: async (collection, key, opts = {}) => {
			const id = nodeId(collection, key.toLowerCase());
			const draw = opts.neighborLimit ?? get(filtersStore).neighborLimit;
			// A bron that draws few neighbours asks few, unless its whole node is in already.
			const response =
				Number.isFinite(draw) && draw <= CANVAS_BUCKET && !cache.has(id)
					? await abortable(getNodeCanvas(collection, key), signal())
					: opts.hull && collection === 'instruments' && !cache.has(id)
						? await abortable(getNodeHull(collection, key), signal())
						: await nodeResponse(collection, key);
			return nodes.get(mergeResponse(response, draw) ?? id) ?? null;
		},

		neighborhood: { subscribe: neighborhoodStore.subscribe },

		expandNeighborhood: async (collection, key, opts = {}) => {
			const { onCut, asked, ...request } = opts;
			const response = await (asked ?? askNeighborhood(collection, key, request));
			const additive = !!opts.relations || !!opts.additive;
			// The API gives one more than the cap when it cut the neighbourhood off: a step
			// further then gives the same bronnen (art. 3:7 Awb is full at two steps).
			const capped = response.nodes.length > (opts.cap ?? NEIGHBORHOOD_CAP);
			onCut?.(capped);
			// An additive request (a netwerk's steps) leaves the reach of the focus alone.
			if (!opts.relations && !opts.additive)
				neighborhoodStore.set({
					focal: response.focal_id,
					depth: opts.depth ?? NEIGHBORHOOD_DEPTH,
					capped,
					cap: opts.cap ?? NEIGHBORHOOD_CAP,
					buckets: response.buckets ?? []
				});

			// A full neighbourhood without detours through a law (`withoutDetours`); one
			// narrowed to some relations is drawn as asked.
			const shown = opts.relations
				? response
				: withoutDetours(
						response.nodes,
						response.edges,
						response.focal_id,
						opts.depth ?? NEIGHBORHOOD_DEPTH
					);
			const { byId, drawn } = mergeSubgraph(shown.nodes, shown.edges, response.focal_id);

			// A neighbourhood request replaces the canvas's exploratory context: without
			// this, a bron revisited after browsing elsewhere keeps edges from every stop
			// along the way, so it looks more cited than its own neighbourhood shows. Pinned
			// bronnen and the selection are the only things that survive a refocus.
			// A request narrowed to some relations, or asked to add, replaces nothing.
			if (additive) {
				if (opts.additive) trimToCap(response.focal_id);
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
			const focalContainerKind = focalNode && focusKindOf(focalNode.collection);
			if (focalContainerKind) {
				const group = containers.get(containerIdFor(focalNode!) ?? '');
				if (group) for (const id of group.members) keep.add(id);
			}
			pruneToIds(keep);

			emit();
			return nodes.get(response.focal_id) ?? null;
		}
	};
}

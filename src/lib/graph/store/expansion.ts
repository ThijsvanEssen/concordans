import { getNodeGraph, getNodeNeighborhood, neighborsOf } from '$lib/api/nodes';
import { inPool } from '$lib/api/pool';
import {
	abortable,
	CANVAS_BUCKET,
	getNode,
	getNodeCanvas,
	getNodeFirst,
	getNodeHull
} from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import {
	containerIdFor,
	containerKindOf,
	getContainerGroup,
	isContainerMembership,
	markLone,
	recordContainerMember
} from '../container-membership';
import { foldVersions } from '../paths';
import { withoutLawHops } from '../neighborhood';
import { NODE_TYPES, nodeId, type Collection } from '$lib/vocabulary';
import { get, writable } from 'svelte/store';
import { isVersionCollection, nodeToGraphNode, relationOf, type BaseNode } from '../types';
import type { GraphContext } from './context';
import {
	NEIGHBORHOOD_CAP,
	NEIGHBORHOOD_DEPTH,
	type GraphStore,
	type NeighborhoodReach
} from './types';
import { behoudenBuckets, behoudenIds, meldSoort, type SoortenGeladen } from './soorten';

export function createExpansion(
	ctx: GraphContext
): Pick<
	GraphStore,
	| 'peekNode'
	| 'expandNode'
	| 'expandNeighborhood'
	| 'nodeResponse'
	| 'mergePaths'
	| 'neighborhood'
	| 'laadSoort'
> {
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
		anchorContainer,
		recordContainerFor,
		passesThreshold,
		mergeResponse,
		pruneToIds,
		signal
	} = ctx;

	const neighborhoodStore = writable<NeighborhoodReach | null>(null);
	// The kinds of the focus loaded in full ("Alle laden"): a neighbourhood around the same
	// focus keeps them (soorten.ts).
	let soortenGeladen: SoortenGeladen | null = null;

	// One request per bron serves the canvas, the panel Verbonden and a reader (`getNode`:
	// 200 per bucket, the most API 0.5 allows; every bucket comes with its total).
	// The neighbourhood without the kinds the canvas does not draw around a focus (a zaak,
	// a version; context.ts `drawable`): they would take the cap. A member's 1,019 zaken
	// filled all 150 places and the canvas showed the member alone (UX test 10 Oct, #11).
	const getekend = (focus: Collection) =>
		(Object.keys(NODE_TYPES) as Collection[])
			.filter((c) => c === focus || (c !== 'cases' && !isVersionCollection(c)))
			.map((c) => NODE_TYPES[c]);

	const inflight = new Map<string, Promise<Schema<'NodeGraphResponse'>>>();

	const nodeResponse: GraphStore['nodeResponse'] = (collection, key, opts = {}) => {
		const id = nodeId(collection, key.toLowerCase());
		const cached = opts.force ? undefined : cache.get(id);
		if (cached) return Promise.resolve(cached);
		let request = inflight.get(id);
		if (!request) {
			// Shared with a reader that wants a bucket of the same node (a lid's AUTHORED); a
			// reset of the canvas drops this answer, not the request.
			request = abortable(getNode(collection, key), signal())
				.then((response) => {
					cache.set(id, response);
					return response;
				})
				.finally(() => inflight.delete(id));
			inflight.set(id, request);
		}
		return request;
	};

	type SubNode = Schema<'NodeNeighborhoodResponse'>['nodes'][number];
	type SubEdge = Schema<'NodeNeighborhoodResponse'>['edges'][number];

	/**
	 * Draws the nodes and edges of a subgraph (a neighbourhood, the paths between chosen
	 * bronnen) by the canvas's rules: a container becomes a hull, a wet a stuk changes its
	 * anchor, an edge under the threshold stays out. Returns what it drew.
	 */
	function mergeSubgraph(
		nodesIn: SubNode[],
		edgesIn: SubEdge[],
		focalId: string | null,
		/** Paths: a step to a container is drawn to its hull, not dropped (Sr, VVD). */
		naarOmtrek = false
	) {
		const byId = new Map(nodesIn.map((n) => [`${n.collection}/${n.key}`, n]));
		const drawn = new Set<string>();
		for (const node of nodesIn) {
			// The requested bron itself is drawn even when it is a container: it stays
			// selectable for the reader, though `GraphView` never draws it as a canvas
			// node. A container met only as a neighbour is folded into a hull instead.
			const isFocal = `${node.collection}/${node.key}` === focalId;
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
		for (const e of edgesIn) {
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
			// On a path every step ties: a stuk that REFERS_TO a chosen wet ends on the wet's
			// hull, or the wet stands as "zonder verbinding" with the path drawn up to it.
			const sourceNode = byId.get(e.source);
			if (naarOmtrek) {
				const naar = targetKind && drawn.has(e.source) ? anchorContainer(targetNode!) : null;
				const sourceKindHier = sourceNode && containerKindOf(sourceNode.collection);
				const van =
					!naar && sourceKindHier && drawn.has(e.target) ? anchorContainer(sourceNode!) : null;
				if (naar || van) {
					const [s, t] = naar ? [e.source, naar.id] : [van!.id, e.target];
					drawn.add(naar?.id ?? van!.id);
					addEdge(s, t, relation, { confidence: e.confidence, status: e.status });
					continue;
				}
			}
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
		return { byId, drawn };
	}

	return {
		nodeResponse,

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
				!opts.force && Number.isFinite(draw) && draw <= CANVAS_BUCKET && !cache.has(id)
					? await abortable(getNodeCanvas(collection, key), signal())
					: opts.hull && collection === 'instruments' && !opts.force && !cache.has(id)
						? await abortable(getNodeHull(collection, key), signal())
						: await nodeResponse(collection, key, opts);
			return nodes.get(mergeResponse(response, draw) ?? id) ?? null;
		},

		mergePaths: async (response) => {
			// A path through a wet by one of its articles (stuk → Awb ← art. 3:7, PART_OF) says
			// no more than that the stuk names the wet the article is in: it is left out, and
			// with it what only it brought.
			// Unless the API widened the wet to its articles (`expand=members`): then the
			// article's PART_OF is how the wet is reached, and the path is wanted.
			const membership = new Set(
				response.paths.flatMap(
					(p) => (p as { membership_edge_ids?: string[] }).membership_edge_ids ?? []
				)
			);
			const throughLaw = new Set(
				response.edges
					.filter(
						(e) =>
							e.relation === 'PART_OF' &&
							e.target.startsWith('instruments/') &&
							!membership.has(e.id)
					)
					.map((e) => e.id)
			);
			const paths = response.paths.filter((p) => !p.edge_ids.some((id) => throughLaw.has(id)));
			const onPath = new Set(paths.flatMap((p) => p.node_ids));
			const edgeIds = new Set(paths.flatMap((p) => p.edge_ids));
			// A version of an article is no bron: the hop through it folds onto the article.
			const folded = foldVersions(
				response.nodes.filter((n) => onPath.has(`${n.collection}/${n.key}`)),
				response.edges.filter((e) => edgeIds.has(e.id))
			);
			const { drawn } = mergeSubgraph(folded.nodes, folded.edges, null, true);
			// The dossier a stuk on a path is in, as a hull around it: the MvT of 33328 shows
			// the bill it explains (BE-49). From the stuk's light node (its one PART_OF dossier;
			// 9 kB, not 42), four at a time and for at most twelve stukken, so one composition
			// stays within the API's limit. The paths are drawn without waiting for it.
			void inPool(
				[...drawn].filter((id) => id.startsWith('documents/')),
				async (id) => {
					const key = id.slice('documents/'.length);
					const r = await abortable(getNodeFirst('documents', key), signal()).catch(() => null);
					const dossier = r
						? neighborsOf(r).find(
								(n) =>
									n.relation === 'PART_OF' &&
									n.collection === 'dossiers' &&
									n.direction === 'outbound'
							)
						: undefined;
					if (!dossier) return;
					recordContainerFor(dossier as unknown as BaseNode, 'dossier');
					const container = containerIdFor(dossier);
					recordContainerMember('dossier', container, id, 'PART_OF');
					markLone(container);
				},
				{ parallel: 4, max: 12 }
			).then(() => emit());
			emit();
			// The chosen bronnen at the ends of a path that is drawn: they are tied.
			const tied = paths.flatMap((p) => [p.source, p.target]);
			return { onPath: [...drawn], tied: [...new Set(tied)] };
		},

		neighborhood: { subscribe: neighborhoodStore.subscribe },

		laadSoort: async (collection, key, soort, opts = {}) => {
			const grens = opts.grens ?? 5000;
			const focus = nodeId(collection, key.toLowerCase());
			const ids = new Set<string>();
			let offset = 0;
			for (;;) {
				const response = await getNodeGraph(collection, key, {
					limit: 500,
					offset,
					nodeTypes: NODE_TYPES[soort],
					props: 'canvas',
					signal: opts.signal ?? signal()
				});
				for (const n of neighborsOf(response)) ids.add(nodeId(n.collection as Collection, n.key));
				soortenGeladen = meldSoort(soortenGeladen, focus, soort, ids);
				// The same bronnen as the neighbourhood's on their id: drawn once.
				mergeResponse(response);
				neighborhoodStore.update((r) =>
					r && r.focal === focus
						? {
								...r,
								buckets: r.buckets.map((b) =>
									b.collection === soort ? { ...b, kept: Math.max(b.kept, ids.size) } : b
								)
							}
						: r
				);
				const volgende = (response.neighbors.buckets ?? [])
					.map((b) => (b as { next_offset?: number | null }).next_offset)
					.filter((n): n is number => typeof n === 'number');
				if (!volgende.length || ids.size >= grens) break;
				offset = Math.min(...volgende);
			}
			return ids.size;
		},

		expandNeighborhood: async (collection, key, opts = {}) => {
			// The canvas draws only its nodes' names and kinds: the light props (CANVAS_PROPS, audited
			// 10 Oct). The amendments timetable asks the same route with every prop.
			const response = await getNodeNeighborhood(collection, key, {
				...opts,
				nodeTypes: opts.nodeTypes ?? getekend(collection),
				props: 'canvas',
				signal: signal()
			});
			const additive = !!opts.relations || !!opts.additive;
			// The API gives one more than the cap when it cut the neighbourhood off: a step
			// further then gives the same bronnen (art. 3:7 Awb is full at two steps).
			if (!opts.relations)
				neighborhoodStore.set({
					focal: response.focal_id,
					depth: opts.depth ?? NEIGHBORHOOD_DEPTH,
					capped: response.nodes.length > (opts.cap ?? NEIGHBORHOOD_CAP),
					cap: opts.cap ?? NEIGHBORHOOD_CAP,
					buckets: behoudenBuckets(response.buckets ?? [], soortenGeladen, response.focal_id)
				});

			// A full neighbourhood without the detour through a law (`withoutLawHops`); one
			// narrowed to some relations is drawn as asked.
			const shown = opts.relations
				? response
				: withoutLawHops(
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
				emit();
				return nodes.get(response.focal_id) ?? null;
			}
			const keep = new Set(drawn);
			keep.add(response.focal_id);
			for (const id of pinned) keep.add(id);
			for (const id of behoudenIds(soortenGeladen, response.focal_id))
				if (nodes.has(id)) keep.add(id);
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

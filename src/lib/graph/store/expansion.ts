import { getNodeGraph, getNodeNeighborhood, neighborsOf } from '$lib/api/nodes';
import { inPool } from '$lib/api/pool';
import { report } from '$lib/api/errors';
import {
	abortable,
	CANVAS_BUCKET,
	getNode,
	getNodeCanvas,
	getNodeFirst,
	getNodeHull
} from '$lib/api/records';
import type { Schema } from '$lib/api/types';
import { containerIdFor, containerKindOf } from '../container-membership';
import { foldVersions } from '../paths';
import { withoutLawHops } from '../neighborhood';
import { NODE_TYPES, nodeId, parseNodeId, type Collection } from '$lib/vocabulary';
import { get, writable } from 'svelte/store';
import { nodeToGraphNode, relationOf } from '../types';
import { COLLECTION_ROLE } from '../collection-role';
import type { GraphContext } from './context';
import { periodOf, placeConnection, type End } from './placement';
import {
	NEIGHBORHOOD_CAP,
	NEIGHBORHOOD_DEPTH,
	type GraphStore,
	type NeighborhoodReach
} from './types';
import { behoudenBuckets, behoudenIds, meldSoort, type SoortenGeladen } from './soorten';

/** "Alles laden" of one kind: at most this many bronnen, asked a page of this many at a time. */
const LOAD_ALL_CAP = 5000;
const LOAD_ALL_PAGE = 500;

/** The dossiers of the stukken on a path: four at a time, for at most twelve stukken. */
const PATH_DOSSIERS = { parallel: 4, max: 12 };

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
		containers,
		selectionStore,
		filtersStore,
		emit,
		touchNode,
		addEdge,
		drawable,
		anchorContainer,
		recordContainerFor,
		threshold,
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
	// a version: COLLECTION_ROLE): they would take the cap. A member's 1,019 zaken
	// filled all 150 places and the canvas showed the member alone (UX test 10 Oct, #11).
	const getekend = (focus: Collection) =>
		(Object.keys(NODE_TYPES) as Collection[])
			.filter((c) => c === focus || COLLECTION_ROLE[c].neighbour)
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
		/**
		 * The chosen bronnen of a path. A container among them is drawn as its anchor, as the
		 * focus is; a container between them ties: a step to it ends at its anchor (Sr, VVD).
		 */
		chosen: ReadonlySet<string> | null = null
	) {
		const byId = new Map<string, SubNode>(nodesIn.map((n) => [nodeId(n.collection, n.key), n]));
		const drawn = new Set<string>();
		for (const node of nodesIn) {
			// The requested bron itself is drawn even when it is not drawn as a neighbour (a
			// zaak): it stays selectable for the reader. A container in focus or chosen is
			// drawn as its anchor, as the centre of a node response is; one met only as a
			// neighbour is folded into a hull instead.
			const id = nodeId(node.collection, node.key);
			const anchored = id === focalId || !!chosen?.has(id);
			const graphNode =
				anchored && containerKindOf(node.collection)
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
		// anchor, and on a path a step to a container ends at its anchor.
		const endOf = (id: string, node: SubNode | undefined): End => ({
			hull: node ? containerKindOf(node.collection) : null,
			drawn: drawn.has(id),
			drawClass: nodes.get(id)?.drawClass ?? 'other',
			ties: !!chosen && !chosen.has(id)
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
					containerKindOf(hull.collection)!,
					containerIdFor(hull),
					member,
					relation,
					placement.seat ? periodOf(e.meta) : null
				);
			} else if (placement.place === 'line') {
				addEdge(id.source, id.target, relation, { confidence: e.confidence, status: e.status });
			}
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
			const membership = new Set(response.paths.flatMap((p) => p.membership_edge_ids ?? []));
			const throughLaw = new Set(
				response.edges
					.filter(
						(e) =>
							e.relation === 'PART_OF' &&
							parseNodeId(e.target)?.collection === 'instruments' &&
							!membership.has(e.id)
					)
					.map((e) => e.id)
			);
			const paths = response.paths.filter((p) => !p.edge_ids.some((id) => throughLaw.has(id)));
			const onPath = new Set(paths.flatMap((p) => p.node_ids));
			const edgeIds = new Set(paths.flatMap((p) => p.edge_ids));
			// A version of an article is no bron: the hop through it folds onto the article.
			const folded = foldVersions(
				response.nodes.filter((n) => onPath.has(nodeId(n.collection, n.key))),
				response.edges.filter((e) => edgeIds.has(e.id))
			);
			const { drawn } = mergeSubgraph(folded.nodes, folded.edges, null, new Set(response.ids));
			// The dossier a stuk on a path is in, as a hull around it: the MvT of 33328 shows
			// the bill it explains (BE-49). From the stuk's light node (its one PART_OF dossier;
			// 9 kB, not 42), within PATH_DOSSIERS, so one composition stays within the API's
			// limit. The paths are drawn without waiting for it.
			inPool(
				[...drawn].flatMap((id) => {
					const ref = parseNodeId(id);
					return ref?.collection === 'documents' ? [{ id, key: ref.key }] : [];
				}),
				async ({ id, key }) => {
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
					recordContainerFor(dossier, 'dossier');
					const container = containerIdFor(dossier);
					containers.recordMember('dossier', container, id, 'PART_OF');
					containers.markLone(container);
				},
				PATH_DOSSIERS
			)
				.then(() => emit())
				.catch((e) => report('Netwerk dossiers', e));
			emit();
			// The chosen bronnen at the ends of a path that is drawn: they are tied.
			const tied = paths.flatMap((p) => [p.source, p.target]);
			return { onPath: [...drawn], tied: [...new Set(tied)] };
		},

		neighborhood: { subscribe: neighborhoodStore.subscribe },

		laadSoort: async (collection, key, soort, opts = {}) => {
			const grens = opts.grens ?? LOAD_ALL_CAP;
			const focus = nodeId(collection, key.toLowerCase());
			const ids = new Set<string>();
			let offset = 0;
			for (;;) {
				const response = await getNodeGraph(collection, key, {
					limit: LOAD_ALL_PAGE,
					offset,
					nodeTypes: NODE_TYPES[soort],
					props: 'canvas',
					signal: opts.signal ?? signal()
				});
				for (const n of neighborsOf(response)) ids.add(nodeId(n.collection, n.key));
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
					.map((b) => b.next_offset)
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
				const group = containers.get(containerIdFor(focalNode!) ?? '');
				if (group) for (const id of group.members) keep.add(id);
			}
			pruneToIds(keep);

			emit();
			return nodes.get(response.focal_id) ?? null;
		}
	};
}

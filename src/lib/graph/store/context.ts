import { textOf } from '$lib/text/words';
import { primeInstrumentNames, recordInstrument } from '$lib/api/instrument-cache';
import { neighborsOf } from '$lib/api/nodes';
import type { Schema } from '$lib/api/types';
import {
	containerIdFor,
	containerKindOf,
	createContainerGroups,
	isContainerMembership,
	isContainment,
	type ContainerKind,
	type Period
} from '../container-membership';
import { isCollection, type Collection, type Relation } from '$lib/vocabulary';
import { COLLECTION_ROLE } from '../collection-role';
import { get, writable } from 'svelte/store';
import {
	buildNodeLabel,
	edgeCategory,
	kindOfCollection,
	lawIdOf,
	nodeToGraphNode,
	relationOf,
	type BaseNode,
	type GraphEdge,
	type GraphNode,
	type GraphNodeKind
} from '../types';
import { DEFAULT_FILTERS, SOFT_NODE_CAP, type GraphFilters } from './types';

const edgeId = (source: string, target: string, relation: Relation) =>
	`${source}->${target}:${relation}`;

/**
 * Shared mutable state and the primitives every loader builds on: node and
 * edge maps, the writable stores that mirror them, trimming and the
 * derived nodes and edges. Loader modules receive this object and never
 * create their own copies.
 */
export function createGraphContext() {
	const nodes = new Map<string, GraphNode>();
	const edges = new Map<string, GraphEdge>();
	/** Expansion responses by node id. */
	const cache = new Map<string, Schema<'NodeGraphResponse'>>();
	const pinned = new Set<string>();
	// On one object because a destructured `let` would freeze its value.
	const state = { seq: 0 };
	// Insertion sequence per node: the order in which the soft cap trims.
	const insertedAt = new Map<string, number>();
	// The hulls around the bronnen a suppressed container holds.
	const containers = createContainerGroups();

	const nodesStore = writable<GraphNode[]>([]);
	const edgesStore = writable<GraphEdge[]>([]);
	const selectionStore = writable<GraphNode | null>(null);
	const pinnedStore = writable<Set<string>>(new Set());
	const filtersStore = writable<GraphFilters>({
		...DEFAULT_FILTERS,
		hiddenRelations: new Set(DEFAULT_FILTERS.hiddenRelations),
		hiddenGroups: new Set(DEFAULT_FILTERS.hiddenGroups)
	});
	const trimmedCountStore = writable(0);

	// ── Requests in flight ────────────────────────────────────────────────────
	// A load that replaces the canvas cancels every request that would still
	// write into the old one.
	let controller = new AbortController();
	const signal = () => controller.signal;
	const supersede = () => {
		controller.abort();
		controller = new AbortController();
		return controller.signal;
	};

	// ── Derived edges ─────────────────────────────────────────────────────────
	// Rebuilt from scratch on every emit, so prunes and deloads stay consistent.
	// Each one stands for an API relation the loaded nodes imply but the loaded
	// edges do not show.
	const addEdge = (
		source: string,
		target: string,
		relation: Relation,
		extra: Partial<Pick<GraphEdge, 'label' | 'confidence' | 'status' | 'meta'>> = {}
	) => {
		if (intoHull(source, target, relation)) return;
		const id = edgeId(source, target, relation);
		// A neighbourhood edge carries no meta; it does not wipe what a node response said.
		const meta = extra.meta ?? edges.get(id)?.meta;
		edges.set(id, { id, source, target, relation, label: '', directed: true, ...extra, meta });
	};

	/**
	 * A bron "onderdeel van" a container on the canvas (its anchor: a dossier shared by two
	 * chosen stukken, a row put on the canvas) goes into the container's hull instead of on a
	 * line to it (`isContainment`). Every edge passes here, so no loader draws one.
	 */
	const intoHull = (source: string, target: string, relation: Relation) => {
		const container = nodes.get(target)?.raw;
		const kind = container ? containerKindOf(container.collection) : null;
		const bron = nodes.get(source)?.raw;
		if (!container || !kind || !isContainment(kind, relation)) return false;
		if (bron && containerKindOf(bron.collection)) return false;
		containers.recordMember(kind, containerIdFor(container), source, relation);
		return true;
	};

	const emit = () => {
		nodesStore.set([...nodes.values()]);
		edgesStore.set([...edges.values()]);
		containers.prune(new Set(nodes.keys()));
	};

	const focusInternal = (id: string) => {
		const target = nodes.get(id);
		if (!target) return null;
		selectionStore.set(target);
		return target;
	};

	// ── Canvas lifecycle ──────────────────────────────────────────────────────
	const clearCanvas = () => {
		nodes.clear();
		edges.clear();
		cache.clear();
		insertedAt.clear();
		state.seq = 0;
		trimmedCountStore.set(0);
	};

	const reset = () => {
		supersede();
		clearCanvas();
		containers.clear();
		pinned.clear();
		pinnedStore.set(new Set());
		selectionStore.set(null);
		emit();
	};

	/** Adds a node, or replaces it and keeps its place in the trim order. */
	const touchNode = (id: string, node: GraphNode) => {
		if (!nodes.has(id)) insertedAt.set(id, ++state.seq);
		nodes.set(id, node);
	};

	/** `keep`: the bron a response was just merged for, not yet selected but never the one to go. */
	const trimToCap = (keep?: string) => {
		if (nodes.size <= SOFT_NODE_CAP) return;
		const selected = get(selectionStore);
		const protect = new Set(pinned);
		if (keep) protect.add(keep);
		if (selected) {
			protect.add(selected.id);
			// A selected container has no edges of its own to protect its children by
			// (they are containment, not peer edges): protect its current hull instead.
			const selectedContainerKind = selected.raw && containerKindOf(selected.raw.collection);
			const selectedContainerId =
				selected.raw && selectedContainerKind && containerIdFor(selected.raw);
			const group = selectedContainerId ? containers.get(selectedContainerId) : undefined;
			if (group) for (const id of group.members) protect.add(id);
			for (const e of edges.values()) {
				if (e.source === selected.id) protect.add(e.target);
				if (e.target === selected.id) protect.add(e.source);
			}
		}
		const drop = nodes.size - SOFT_NODE_CAP;
		const oldest = [...nodes.keys()]
			.filter((id) => !protect.has(id))
			.sort((a, b) => (insertedAt.get(a) ?? 0) - (insertedAt.get(b) ?? 0))
			.slice(0, drop);
		for (const id of oldest) {
			nodes.delete(id);
			insertedAt.delete(id);
		}
		trimmedCountStore.update((n) => n + oldest.length);
		for (const [id, e] of [...edges]) {
			if (!nodes.has(e.source) || !nodes.has(e.target)) edges.delete(id);
		}
	};

	// ── Nodes and edges from API responses ────────────────────────────────────
	/**
	 * Records a container's own name (an instrument's through `instrumentMetaStore`,
	 * the rest through `containers.recordMeta`) so the hull around its children has a
	 * label, whether the container is a neighbour or the bron navigated to.
	 */
	const recordContainerFor = (node: BaseNode, containerKind: ContainerKind) => {
		const p = node.props ?? {};
		if (containerKind === 'instrument') {
			recordInstrument({
				key: node.key,
				bwb_id: p.bwb_id,
				display_name: node.display_name,
				title: p.title,
				citation_title: p.citation_title,
				short_title: p.short_title
			});
		} else {
			// Short on the hull, in full on hover: a dossier by its number, a commissie or
			// fractie by its abbreviation.
			const name = textOf(p.name) ?? textOf(node.display_name);
			const short =
				containerKind === 'dossier'
					? textOf(p.label)
					: (textOf(p.abbreviation) ??
						buildNodeLabel(node, kindOfCollection(node.collection as Collection)));
			const full =
				containerKind === 'dossier' ? [short, textOf(p.title)].filter(Boolean).join(', ') : name;
			containers.recordMeta(containerKind, containerIdFor(node), short ?? '', full ?? '');
		}
	};

	/**
	 * The node to draw for an API node. A container (a wet, fractie, commissie or
	 * dossier) is drawn as a hull around its children instead of as a bron, so it
	 * is only recorded; null for it and for collections this app does not know.
	 */
	const drawable = (node: BaseNode): GraphNode | null => {
		// Not a zaak or a version (COLLECTION_ROLE.neighbour): 37014's one Zaak is the bill.
		if (!isCollection(node.collection) || !COLLECTION_ROLE[node.collection].neighbour) return null;
		const p = node.props ?? {};
		const containerKind = containerKindOf(node.collection);
		if (containerKind) {
			recordContainerFor(node, containerKind);
			return null;
		}
		const graphNode = nodeToGraphNode(node);
		const law = graphNode?.kind === 'article' ? lawIdOf(p) : null;
		if (law) {
			recordInstrument({ bwb_id: law, citation_title: p.instrument_citation_title });
			primeInstrumentNames();
			containers.recordMember('instrument', law, graphNode!.id);
		}
		return graphNode;
	};

	/**
	 * The seat an edge records (`meta.from_date`, `meta.to_date`), or null when it records
	 * none. A bewindspersoon's SERVED_IN lists the posts in the cabinet (`meta.posts`): the
	 * seat runs from the first post to the end of the last, open while one is open.
	 */
	const periodOf = (meta: unknown): Period | null => {
		const m = (meta ?? {}) as Record<string, unknown>;
		const date = (v: unknown) => (typeof v === 'string' && v ? v.slice(0, 10) : null);
		if (Array.isArray(m.posts) && m.posts.length > 0) {
			const seats = m.posts.map((post) => periodOf(post));
			if (seats.some((seat) => seat === null)) return null;
			const froms = seats.map((seat) => seat!.from);
			const tos = seats.map((seat) => seat!.to);
			return {
				from: froms.includes(null) ? null : (froms as string[]).sort()[0],
				to: tos.includes(null) ? null : (tos as string[]).sort().at(-1)!
			};
		}
		const from = date(m.from_date);
		const to = date(m.to_date);
		return from || to ? { from, to } : null;
	};

	/** The relations by which a stuk changes a wet; the wet is then drawn as an anchor. */
	const CHANGES = new Set<Relation>(['AMENDS', 'INTRODUCES', 'REPEALS']);

	/** The anchor of a wet that a drawn bron changes: a member of the wet's own hull. */
	const lawAnchor = (node: BaseNode, relation: Relation): GraphNode | null => {
		if (node.collection !== 'instruments' || !CHANGES.has(relation)) return null;
		const anchor = nodeToGraphNode(node);
		if (!anchor) return null;
		anchor.anchor = true;
		recordContainerFor(node, 'instrument');
		containers.recordMember('instrument', containerIdFor(node), anchor.id);
		touchNode(anchor.id, anchor);
		return anchor;
	};

	/** Whether an edge passes the semantic threshold; only semantic edges carry a confidence worth checking. */
	const passesThreshold = (
		relation: Relation,
		sourceKind: GraphNodeKind,
		confidence: number | null | undefined
	) =>
		confidence == null ||
		edgeCategory(relation, sourceKind) !== 'semantic' ||
		confidence >= get(filtersStore).semanticThreshold;

	/**
	 * Puts a node and its neighbours on the canvas. Returns the id of the node.
	 *
	 * The centre is always recorded, even when it is itself a container (a wet,
	 * fractie, commissie or dossier navigated to directly): the bron stays
	 * selectable for the reader and the Verbonden panel, but `GraphView` never
	 * draws a container as a canvas node, so its children are what a hull groups.
	 */
	const mergeResponse = (
		response: Schema<'NodeGraphResponse'>,
		draw = Number.POSITIVE_INFINITY
	): string | null => {
		const id = mergeInto(response, draw);
		if (!id) return null;
		// The centre went in first, so it is the oldest: without this, a wet with more
		// articles than the cap trimmed itself and its link said it was not in the dataset.
		trimToCap(id);
		emit();
		return id;
	};

	/**
	 * `mergeResponse` without the trim and the emit, and limited to the neighbours
	 * `keep` accepts by node id: a composed netwerk draws only what ties its bronnen.
	 * A container `joins` accepts is drawn as a point with a verbinding to the centre,
	 * not as a hull around it: a commissie two chosen bronnen share ties them, and a
	 * hull around both would pull them onto each other. A bron "onderdeel van" it (a stuk
	 * of a dossier two chosen stukken share) is in its hull all the same (`intoHull`).
	 */
	const mergeInto = (
		response: Schema<'NodeGraphResponse'>,
		draw = Number.POSITIVE_INFINITY,
		keep?: (id: string) => boolean,
		joins?: (id: string) => boolean
	): string | null => {
		const center = nodeToGraphNode(response.node);
		if (!center) return null;
		const centerContainerKind = containerKindOf(response.node.collection);
		// A fractie, commissie, dossier or wet is its hull, and its anchor the point what is
		// not in it ties to (VVD's stemmingen, "100 stemmingen"): without it those lines had
		// no end and their bronnen went unseen.
		if (centerContainerKind) {
			center.anchor = true;
			recordContainerFor(response.node, centerContainerKind);
			containers.recordMember(centerContainerKind, containerIdFor(response.node), center.id);
		}
		touchNode(center.id, center);

		for (const neighbor of neighborsOf(response).slice(0, draw)) {
			if (keep && !keep(`${neighbor.collection}/${neighbor.key}`)) continue;
			const relation = relationOf(neighbor.relation);
			const other = relation && drawable(neighbor);

			const neighborContainerKind = relation && containerKindOf(neighbor.collection);
			if (relation && neighborContainerKind && joins?.(`${neighbor.collection}/${neighbor.key}`)) {
				const point = anchorContainer(neighbor);
				if (point) {
					const [source, target] =
						neighbor.direction === 'outbound' ? [center.id, point.id] : [point.id, center.id];
					addEdge(source, target, relation, {
						confidence: neighbor.confidence,
						status: neighbor.status,
						meta: neighbor.meta
					});
				}
				continue;
			}
			if (
				relation &&
				neighborContainerKind &&
				isContainerMembership(neighborContainerKind, relation)
			) {
				containers.recordMember(
					neighborContainerKind,
					containerIdFor(neighbor),
					center.id,
					relation,
					periodOf(neighbor.meta)
				);
				continue;
			}
			if (
				relation &&
				other &&
				centerContainerKind &&
				isContainerMembership(centerContainerKind, relation)
			) {
				touchNode(other.id, other);
				containers.recordMember(
					centerContainerKind,
					containerIdFor(response.node),
					other.id,
					relation,
					periodOf(neighbor.meta)
				);
				continue;
			}

			const changed = relation && !other && lawAnchor(neighbor, relation);
			if (relation && changed && neighbor.direction === 'outbound') {
				addEdge(center.id, changed.id, relation, {
					confidence: neighbor.confidence,
					status: neighbor.status
				});
				continue;
			}
			if (!relation || !other) continue;
			const [source, target] =
				neighbor.direction === 'outbound' ? [center, other] : [other, center];
			if (!passesThreshold(relation, source.kind, neighbor.confidence)) continue;
			touchNode(other.id, other);
			addEdge(source.id, target.id, relation, {
				confidence: neighbor.confidence,
				status: neighbor.status,
				meta: neighbor.meta
			});
		}
		return center.id;
	};

	/**
	 * Draws a container (a wet, fractie, commissie or dossier) as the point its hull is
	 * drawn around, as `lawAnchor` does for a wet a stuk changes: a chosen container
	 * stays on the canvas with nothing of its own drawn around it yet.
	 */
	const anchorContainer = (node: BaseNode): GraphNode | null => {
		const kind = containerKindOf(node.collection);
		const anchor = kind && nodeToGraphNode(node);
		if (!kind || !anchor) return null;
		anchor.anchor = true;
		recordContainerFor(node, kind);
		containers.recordMember(kind, containerIdFor(node), anchor.id);
		touchNode(anchor.id, anchor);
		return anchor;
	};

	/** Drops every node not in `keepIds`, and the edges that touched it. Does not emit. */
	const pruneToIds = (keepIds: Set<string>) => {
		for (const id of [...nodes.keys()]) {
			if (keepIds.has(id)) continue;
			nodes.delete(id);
			insertedAt.delete(id);
		}
		for (const [id, e] of [...edges]) {
			if (!keepIds.has(e.source) || !keepIds.has(e.target)) edges.delete(id);
		}
	};

	return {
		nodes,
		edges,
		cache,
		pinned,
		insertedAt,
		containers,
		nodesStore,
		edgesStore,
		selectionStore,
		pinnedStore,
		filtersStore,
		trimmedCountStore,
		state,
		signal,
		supersede,
		emit,
		addEdge,
		drawable,
		lawAnchor,
		recordContainerFor,
		passesThreshold,
		mergeResponse,
		mergeInto,
		anchorContainer,
		trimToCap,
		pruneToIds,
		touchNode,
		reset,
		focusInternal
	};
}

export type GraphContext = ReturnType<typeof createGraphContext>;

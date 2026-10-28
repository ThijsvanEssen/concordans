<script lang="ts">
	import { fallbackLawName } from '$lib/text/enacted-law';
	import { lineStrength } from '$lib/graph/line-strength';
	import { redundantAnchors } from '$lib/graph/redundant-anchors';
	import { forEachRealNeighbor, realDegree } from '$lib/graph/layout';
	import {
		bundledInto,
		inSameGroup,
		repeatsHull,
		telBundels,
		type Bundels,
		type Lijn
	} from './edge-bundles';
	import {
		anchorWithHull,
		EDGE_GAP,
		HULL_MARGIN,
		hullLinkOf,
		LABEL_GAP,
		LABEL_HEIGHT,
		layoutHulls,
		type Hull,
		type HullGroups,
		type HullHitArea,
		type HullLink
	} from './hulls';
	import Picto from '$lib/components/ui/Picto.svelte';
	import type { Vorm } from '$lib/bron/vormen';
	import { onDestroy, onMount } from 'svelte';
	import type SigmaType from 'sigma';
	import type Graph from 'graphology';
	import { edgeKey, readEdge } from '$lib/verbonden/edge-meta';
	import { keyEcli } from '$lib/text/ecli';
	import { parseNodeId } from '$lib/vocabulary';
	import type { GraphFilters } from '$lib/graph/store/types';
	import type { NodeCounts } from '$lib/api/overlays';
	import { EDGE_WEIGHT, type DrawClass } from '$lib/graph/types';
	import { lineKindOf } from '$lib/graph/line-kind';
	import {
		hoverPlaats,
		lijnLabelPlaats,
		planLabels,
		type LabelCandidate,
		type Rect as LabelRect
	} from './label-place';
	import { fitBox, insetsOf, NAME_BELOW, type Insets } from './fit-box';
	import type { Collection, Relation } from '$lib/vocabulary';
	import { relationLabel } from '$lib/verbonden/relation-words';
	import type { FilterGroup, HiddenKind, Rechter } from '$lib/verbonden/filter';
	import { getInstrumentMeta } from '$lib/api/instrument-cache';
	import { lawName } from '$lib/text/instrument-meta';
	import {
		formerMembers,
		isDrawnGroup,
		type ContainerGroup,
		type Period
	} from '$lib/graph/container-membership';
	import { untilDate, vandaag } from '$lib/text/datum';
	import { metGroepVerborgen } from '$lib/graph/met-groep';
	import { pointInPolygon } from '$lib/graph/hull';
	import {
		spriteForVorm,
		badgeAxisOffset,
		edgeColorFor,
		edgeStyleFor,
		dimColor,
		towardPaper,
		withAlpha,
		tokens,
		lineThickness,
		arrowLength
	} from './nodeSprites';
	import { BEND, MIN_ARROW_PX } from '$lib/graph/line-shape';

	export type GraphCanvasApi = {
		refresh: () => void;
		fit: () => void;
		/** Zoom in (factor > 1) or out (< 1) around the centre. */
		zoom: (factor: number) => void;
		restoreCamera: (state: { x: number; y: number; ratio: number }) => void;
	};

	let {
		graph,
		focusedId = null as string | null,
		filters = null as GraphFilters | null,
		hiddenKinds = new Set<HiddenKind>() as ReadonlySet<HiddenKind>,
		pinnedIds = new Set<string>() as Set<string>,
		coreIds = null as ReadonlySet<string> | null,
		containerGroups = new Map<string, ContainerGroup>() as Map<string, ContainerGroup>,
		focusContainerId = null as string | null,
		groupPeriod = null as Period | null,
		yearPeriod = null as Period | null,
		rechter = null as Rechter | null,
		selectedEdgeId = null as string | null,
		lineLids = new Map() as ReadonlyMap<string, string>,
		inFluxMap = new Map() as NodeCounts,
		onNodeClick,
		onNodeDoubleClick,
		onNodeHover,
		onEdgeClick,
		onStageClick,
		onReady,
		onCameraChange,
		onDrawn,
		externalHoveredId = null as string | null,
		notitieIds = new Set() as ReadonlySet<string>
	}: {
		graph: Graph;
		focusedId?: string | null;
		filters?: GraphFilters | null;
		/** Kinds of bron the bronfilter hides: not drawn, and their edges not drawn. */
		hiddenKinds?: ReadonlySet<HiddenKind>;
		/** The chosen bronnen of a netwerk: always named, a little larger. */
		pinnedIds?: Set<string>;
		/** While a netwerk is drawn, its chosen bronnen and what ties them; the rest is context and steps back. */
		coreIds?: ReadonlySet<string> | null;
		/** A container's children currently on canvas: drawn as a hull, not a bron. */
		containerGroups?: Map<string, ContainerGroup>;
		/**
		 * The container id of the selected bron, when it is a wet, fractie, commissie
		 * or dossier: there is no one focal node to boost or dim around then, so its
		 * own children (not the noise a step further out) count as in focus instead.
		 */
		focusContainerId?: string | null;
		/** The time a lid's commissies and fracties are drawn for (`isDrawnGroup`). */
		groupPeriod?: Period | null;
		/** The years of the bronfilter: a dated bron outside them is hidden, as in the panel. */
		yearPeriod?: Period | null;
		/** The rechter of the bronfilter: a judgment of another court is hidden, as in the panel. */
		rechter?: Rechter | null;
		/** The edge whose card is open: drawn wider. */
		selectedEdgeId?: string | null;
		/** The lid a line names, by its edge (`edgeKey`), where its row or card knows it: the
		 *  light meta of the canvas names none where the source cites several places. */
		lineLids?: ReadonlyMap<string, string>;
		/** The bronnen drawn, after every change of what is hidden: what the Legenda counts. */
		onDrawn?: (drawn: ReadonlySet<string>) => void;
		inFluxMap?: NodeCounts;
		onNodeClick?: (id: string) => void;
		onNodeDoubleClick?: (id: string) => void;
		onNodeHover?: (id: string, vx: number, vy: number) => void;
		onEdgeClick?: (id: string) => void;
		onStageClick?: () => void;
		onReady?: (api: GraphCanvasApi) => void;
		onCameraChange?: (state: { x: number; y: number; ratio: number }) => void;
		/** Keeps the dim/highlight pass alive while the hover panel is open. */
		externalHoveredId?: string | null;
		/** The bronnen with a note of the reader's (Bundels): a quiet mark beside each. */
		notitieIds?: ReadonlySet<string>;
	} = $props();

	let wrap: HTMLDivElement;
	let destroyed = false;
	/** Where each name stands in this frame: its hover stands there too, not beside it. */
	let labelsAt = new Map<string, LabelRect>();
	/** A phone's width, where the canvas names only the bronnen that matter most. */
	const narrow = typeof window === 'undefined' ? null : window.matchMedia('(max-width: 768px)');
	/** The hulls' names as they stand: a bron's name keeps clear of them. Set before a frame. */
	let hullNames: LabelRect[] = [];
	/** Where the names of this frame stand (`planLabels`), made at its first name. */
	let labelPlan: Map<string, LabelRect> | null = null;
	/** The signs of the bronnen in this frame: a hull's name keeps clear of them. */
	let glyphRects: LabelRect[] = [];
	const labelWidths = new Map<string, number>();
	/**
	 * The places taken before the names are drawn (UX test 10 Oct, #25: names over one another):
	 * the hulls' labels, a layer of their own drawn after sigma's names, as they stand.
	 */
	function voorbehouden(): LabelRect[] {
		const taken: LabelRect[] = [];
		if (!renderer || !wrap) return taken;
		const box = wrap.getBoundingClientRect();
		for (const el of wrap.querySelectorAll<HTMLElement>('.hull-label, .hull-link-label')) {
			const r = el.getBoundingClientRect();
			if (r.width > 0)
				taken.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
		}
		return taken;
	}
	/** Higher goes first: the focus, the chosen bronnen, a cluster, the bronnen in the hover. */
	const rankOf = (id: string, cluster: boolean) =>
		latestPinnedIds.has(id)
			? 4
			: cluster
				? 3
				: id === hoveredId
					? 2
					: hoveredNeighbours.has(id)
						? 1
						: 0;
	/**
	 * The names of this frame and where they stand (UX review N4): every bron drawn, its sign;
	 * every bron with a name, a candidate for `planLabels`, in the order of its rank.
	 */
	function makeLabelPlan(
		view: SigmaType,
		context: CanvasRenderingContext2D,
		settings: { labelSize: number; labelRenderedSizeThreshold: number }
	): Map<string, LabelRect> {
		const candidates: LabelCandidate[] = [];
		const glyphs: LabelRect[] = [];
		const h = settings.labelSize + 4;
		graph.forEachNode((id) => {
			const d = view.getNodeDisplayData(id);
			if (!d || d.hidden) return;
			const { x, y } = view.framedGraphToViewport(d);
			const size = view.scaleSize(d.size);
			glyphs.push({ x: x - size, y: y - size, w: 2 * size, h: 2 * size });
			if (!d.label || (!d.forceLabel && size < settings.labelRenderedSizeThreshold)) return;
			let w = labelWidths.get(d.label);
			if (w === undefined) labelWidths.set(d.label, (w = context.measureText(d.label).width + 4));
			const cluster = !!(d as { cluster?: boolean }).cluster;
			candidates.push({
				id,
				x,
				y,
				size,
				w,
				h,
				rank: rankOf(id, cluster),
				always: id === focusedId
			});
		});
		glyphRects = glyphs;
		const dpr = window.devicePixelRatio || 1;
		const room = { width: context.canvas.width / dpr, height: context.canvas.height / dpr };
		// Netwerkcanvas: hooguit 12 namen in rust; on a phone fewer, the chosen bronnen first.
		const max = hoveredId !== null ? undefined : narrow?.matches ? 6 : 12;
		return planLabels(candidates, room, hullNames, glyphs, max);
	}
	/** Zoomed in past this camera ratio, a hull of a netwerk without a chosen bron is named. */
	const HULL_LABEL_ZOOM = 0.6;
	let renderer: SigmaType | null = null;
	let resizeObserver: ResizeObserver | null = null;
	// The mobile tab strip mounts this canvas behind `display: none`, where sigma
	// measures a 0×0 viewport; it never notices the resize on its own once the tab
	// becomes visible.
	let lastObservedSize = { width: 0, height: 0 };
	// The camera is where the last fit put it: no wheel or drag on the canvas since. Then a
	// change of the canvas's size (the reader opening beside it) fits again, instead of
	// leaving the drawing where it was framed for the old width.
	let framedByFit = false;

	// Plain mutable refs read inside sigma reducer closures, not reactive state.
	let latestFilters: GraphFilters | null = null;
	let latestHiddenKinds: ReadonlySet<HiddenKind> = new Set();
	let latestPinnedIds = new Set<string>();
	let latestCoreIds: ReadonlySet<string> | null = null;
	let latestSelectedEdge: string | null = null;
	let latestLineLids: ReadonlyMap<string, string> = new Map();
	let latestInFluxMap: NodeCounts = new Map();
	let latestContainerGroups: Map<string, ContainerGroup> = new Map();
	/**
	 * Members of the focused hull whose seat in it has ended, with its last day: drawn in the
	 * hull but quiet, "tot <datum>" on a hover, never as a line out of it (Orchestrator, 10 Oct).
	 */
	let latestGewezen: ReadonlyMap<string, string> = new Map();
	// Which group(s) each bron belongs to, so two members of the same hull can be
	// told apart from a connection that actually crosses into or out of it.
	let nodeGroupIds: Map<string, Set<string>> = new Map();
	let hiddenGroupKinds: ReadonlySet<string> = new Set();

	let sigmaHoveredId: string | null = null;
	let hoveredId: string | null = null;
	let hoveredEdgeId: string | null = null;
	let hoveredNeighbours: Set<string> = new Set();
	let promotedEdges: string[] = [];

	function promoteEdgesForHover(nodeId: string | null) {
		for (const e of promotedEdges) if (graph.hasEdge(e)) graph.setEdgeAttribute(e, 'zIndex', 0);
		promotedEdges = [];
		if (!nodeId || !graph.hasNode(nodeId)) return;
		graph.forEachEdge((e, _attrs, source, target) => {
			if (source === nodeId || target === nodeId) {
				graph.setEdgeAttribute(e, 'zIndex', 2);
				promotedEdges.push(e);
			}
		});
	}
	function setHoveredId(next: string | null) {
		if (hoveredId === next) return;
		hoveredId = next;
		hoveredNeighbours = new Set();
		if (hoveredId && graph.hasNode(hoveredId))
			forEachRealNeighbor(graph, hoveredId, (n) => hoveredNeighbours.add(n));
		promoteEdgesForHover(hoveredId);
		renderer?.refresh();
	}

	$effect(() => {
		latestInFluxMap = inFluxMap ?? new Map();
		updateViewportLabels();
		redrawInFrame();
	});

	$effect(() => {
		latestContainerGroups = containerGroups ?? new Map();
		// A grouping switched off draws no hull; its bronnen stand loose and keep their lines.
		// A wet goes with its articles (Thijs, 9 Oct): articles off, no law hull either.
		hiddenGroupKinds = new Set([
			...(filters?.hiddenGroups ?? []),
			...(hiddenKinds.has('artikelen') ? ['instrument'] : [])
		]);
		const byNode = new Map<string, Set<string>>();
		for (const group of latestContainerGroups.values()) {
			if (hiddenGroupKinds.has(group.kind)) continue;
			for (const id of group.members) {
				let set = byNode.get(id);
				if (!set) {
					set = new Set();
					byNode.set(id, set);
				}
				set.add(group.id);
			}
		}
		nodeGroupIds = byNode;
		void groupPeriod;
		void focusedId;
		recomputeStrays();
		recomputeLinesIntoGroup();
		computeHulls();
		redrawInFrame();
	});

	/** Context of a netwerk: on the canvas, but not chosen nor tying chosen bronnen. */
	const isContext = (id: string) =>
		latestCoreIds !== null &&
		!latestCoreIds.has(id) &&
		id !== focusedId &&
		!graph.getNodeAttribute(id, 'cluster');

	/** Per bron and hull: how many lines it draws into that hull, and the one that stands
	 *  for them (see edge-bundles). */
	let bundels: Bundels = { linesIntoGroup: new Map(), bundles: new Map() };
	function recomputeLinesIntoGroup() {
		const lines: Lijn[] = [];
		graph.forEachEdge((id, attrs, source, target) => {
			if (!attrs.layoutOnly) lines.push({ id, source, target });
		});
		bundels = telBundels(lines, nodeGroupIds);
	}

	$effect(() => {
		const focusGroup = focusContainerId ? containerGroups.get(focusContainerId) : undefined;
		latestGewezen = formerMembers(focusGroup, vandaag());
		redrawInFrame();
	});

	$effect(() => {
		setHoveredId(sigmaHoveredId ?? externalHoveredId);
	});

	$effect(() => {
		latestFilters = filters;
		latestHiddenKinds = hiddenKinds;
		void rechter;
		void yearPeriod;
		latestPinnedIds = pinnedIds;
		latestCoreIds = coreIds;
		recomputeStrays();
		latestSelectedEdge = selectedEdgeId;
		latestLineLids = lineLids;
		redrawInFrame();
	});

	/** A bron a lopend wetsvoorstel wil wijzigen (Netwerkcanvas, Openstaand): a dot at its top right. */
	type OpenstaandStip = { id: string; vx: number; vy: number };
	let openstaand = $state<OpenstaandStip[]>([]);
	/** A bron with a note of the reader's: its mark, in ink while it is open or in focus. */
	type NotitieMerk = { id: string; vx: number; vy: number; open: boolean; dim: boolean };
	let notitieMerken = $state<NotitieMerk[]>([]);

	// The hulls, their names and the lines between them (hulls.ts), in screen pixels.
	let hulls = $state<Hull[]>([]);
	let hullLinks = $state<HullLink[]>([]);
	// The hull under the pointer (its shape or its label), found in `onpointermove`.
	let hoveredHullId: string | null = null;
	let hullHitAreas: HullHitArea[] = [];

	/** The groups of the canvas as the hulls read them; also what the edge reducer asks. */
	const hullGroups = (): HullGroups => ({
		graph,
		groups: latestContainerGroups,
		groupsOf: nodeGroupIds,
		drawn: drawnGroup,
		hiddenKinds: hiddenGroupKinds,
		alone: aloneAnchors
	});

	const lawAnchor = (id: string) =>
		graph.hasNode(id) &&
		!!graph.getNodeAttribute(id, 'anchor') &&
		graph.getNodeAttribute(id, 'collection') === 'instruments';

	function onHullPointer(event: PointerEvent) {
		const box = wrap.getBoundingClientRect();
		const p = { x: event.clientX - box.left, y: event.clientY - box.top };
		// The last hull drawn is the one on top; a label counts as its hull.
		let hit: string | null = null;
		for (const area of hullHitAreas) {
			const r = area.label;
			const onLabel = p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
			if (onLabel || pointInPolygon(p, area.polygon)) hit = area.id;
		}
		if (hit === hoveredHullId) return;
		hoveredHullId = hit;
		computeHulls();
	}

	// Around the nodes on a fit: the hull margin and a little air. Above them, the
	// label pill of a hull (6 px gap, 22 px pill) and the edge gap on top of that.
	const STAGE_PADDING = HULL_MARGIN + 6;
	// STAGE_PADDING already holds the hull margin and 6 px of it.
	const LABEL_ROOM = LABEL_GAP + LABEL_HEIGHT + EDGE_GAP - 6;

	/** Between what stands over the canvas and the nearest bron's sign. */
	const EDGE_AIR = 16;
	/**
	 * What a fit keeps free on each side, beyond STAGE_PADDING: a hull's name above, a bron's
	 * name below, and what stands over the canvas (`[data-over-doek]`: the zoom) with a little air.
	 */
	function freeEdges(): Insets {
		const over = wrap?.parentElement
			? [...wrap.parentElement.querySelectorAll<HTMLElement>(':scope > [data-over-doek]')].map(
					(el) => el.getBoundingClientRect()
				)
			: [];
		const covered = wrap ? insetsOf(wrap.getBoundingClientRect(), over) : null;
		const beyond = (px: number | undefined) =>
			px ? Math.max(0, px - STAGE_PADDING + EDGE_AIR) : 0;
		return {
			top: Math.max(LABEL_ROOM, beyond(covered?.top)),
			right: beyond(covered?.right),
			bottom: Math.max(NAME_BELOW, beyond(covered?.bottom)),
			left: beyond(covered?.left)
		};
	}

	// The width of a hull label, to keep it on the canvas: its text in the pill's face
	// (.hull-label), plus the padding and border.
	let labelMeasure: CanvasRenderingContext2D | null = null;
	function labelWidth(text: string): number {
		labelMeasure ??= document.createElement('canvas').getContext('2d');
		if (!labelMeasure) return 0;
		labelMeasure.font = `600 13px ${tokens().fontSerif}`;
		return labelMeasure.measureText(text).width + 18;
	}

	/** The anchors that stand as an ordinary bron: nothing of their group drawn. */
	let aloneAnchors: ReadonlyMap<string, string> = new Map();

	function computeHulls() {
		if (!renderer) {
			if (hulls.length) hulls = [];
			return;
		}
		const view = renderer;
		const layout = layoutHulls({
			...hullGroups(),
			isHidden: isHiddenNode,
			toViewport: (p) => view.graphToViewport(p),
			radiusOf: (id) => view.getNodeDisplayData(id)?.size ?? 4,
			namesOf: (group) => {
				const meta = group.kind === 'instrument' ? getInstrumentMeta(group.id) : null;
				// A law whose meta is not loaded: by its publication or CELEX number, so its articles
				// still stand in a named hull.
				return {
					short:
						(meta ? (meta.shortTitle ?? meta.citationTitle) : group.label) ||
						group.label ||
						(group.kind === 'instrument' ? fallbackLawName(group.id) : ''),
					full: lawName(meta, group.fullLabel)
				};
			},
			labelWidth,
			width: view.getDimensions().width,
			zoomedOut: view.getCamera().ratio > HULL_LABEL_ZOOM,
			// Nothing floats over the canvas of the werkplek (besluit 39).
			avoid: null,
			hoveredHullId,
			hoveredId,
			hoveredNeighbours,
			focusedId,
			pinnedIds: latestPinnedIds,
			focusName: focusedId ? labelsAt.get(focusedId) : undefined,
			glyphs: glyphRects
		});
		const was = [...aloneAnchors].join();
		aloneAnchors = layout.alone;
		// An anchor without a hull is a bron now (or no longer): its name and its lines follow.
		if ([...aloneAnchors].join() !== was) renderer?.refresh({ schedule: true });
		hulls = layout.hulls;
		hullLinks = layout.links;
		hullHitAreas = layout.hitAreas;
	}

	function updateViewportLabels() {
		const sizeDivisor = renderer
			? Math.min(Math.sqrt(renderer.getCamera().getState().ratio), 1.5)
			: 1;

		if (renderer && latestInFluxMap.size > 0) {
			const stippen: OpenstaandStip[] = [];
			graph.forEachNode((id, attrs) => {
				if (attrs.hidden || isHiddenNode(id, attrs)) return;
				if ((latestInFluxMap.get(id) ?? 0) <= 0) return;
				// A hull's anchor is a point, not a sign: only an anchor standing as a bron has one.
				if (attrs.anchor && !aloneAnchors.has(id)) return;
				const size = (attrs.anchor ? attrs.ownSize : attrs.size) as number | undefined;
				const baseR = (size ?? 5) / sizeDivisor;
				const vp = renderer!.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				// Beside the sign, on its edge at the top right, not over it.
				const offset = baseR * badgeAxisOffset(attrs.vorm as Vorm) + 3;
				stippen.push({ id, vx: vp.x + offset, vy: vp.y - offset });
			});
			openstaand = stippen;
		} else if (openstaand.length) {
			openstaand = [];
		}

		const merken: NotitieMerk[] = [];
		if (renderer)
			for (const id of notitieIds) {
				if (!graph.hasNode(id)) continue;
				const attrs = graph.getNodeAttributes(id);
				if (attrs.hidden || isHiddenNode(id, attrs)) continue;
				const baseR = ((attrs.size as number) ?? 5) / sizeDivisor;
				const vp = renderer.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				// Above the bron at its left, where the badge of a change (right) does not stand.
				const offset = baseR * badgeAxisOffset(attrs.vorm as Vorm) + 2;
				merken.push({
					id,
					vx: vp.x - offset,
					vy: vp.y - offset,
					open: id === hoveredId || id === focusedId,
					dim: hoveredId !== null && id !== hoveredId && !hoveredNeighbours.has(id)
				});
			}
		if (merken.length || notitieMerken.length) notitieMerken = merken;

		computeHulls();
	}

	$effect(() => {
		void notitieIds;
		updateViewportLabels();
	});

	// A hidden kind is not drawn; the focus is always drawn.
	const drawnGroup = (group: ContainerGroup) =>
		isDrawnGroup(group, focusContainerId, focusedId, groupPeriod);

	// A bron that is left with nothing to show it by is not shown: not in a hull that is
	// drawn (the activities of a commissie the lid left years ago), and every line of it
	// to a bron that is hidden (the co-signers of a stuk outside the chosen years).
	let strays = new Set<string>();
	function recomputeStrays() {
		const next = new Set<string>();
		const endsOf = (id: string) => {
			const ends: string[] = [];
			if (graph.hasNode(id)) forEachRealNeighbor(graph, id, (n) => ends.push(n));
			return ends;
		};
		// A grouping switched off takes along what is in it (the stukken of a dossier).
		const metGroep = metGroepVerborgen({
			groups: latestContainerGroups.values(),
			uit: new Set(latestFilters?.hiddenGroups ?? []),
			houd: (id) => id === focusedId
		});
		for (const id of metGroep.keys()) if (graph.hasNode(id)) next.add(id);
		const hiddenEnd = (id: string) =>
			id !== focusedId &&
			!latestPinnedIds.has(id) &&
			(metGroep.has(id) || hiddenByFilter(graph.getNodeAttributes(id)));
		graph.forEachNode((id, attrs) => {
			// A chosen bron of a netwerk is drawn whether or not anything ties it.
			if (id === focusedId || latestPinnedIds.has(id) || next.has(id) || hiddenByFilter(attrs))
				return;
			const groups = [...(nodeGroupIds.get(id) ?? [])].map((g) => latestContainerGroups.get(g));
			if (groups.some((g) => g && drawnGroup(g))) return;
			if (attrs.inHull) return;
			const shown = graph.someEdge(
				id,
				(_e, a, src, tgt) => !a.layoutOnly && !hiddenEnd(src === id ? tgt : src)
			);
			if (!shown) next.add(id);
		});
		// A container's anchor that only repeats its hull: the bronnen it ties are in it. Not the
		// focus's own: it is the bron the canvas is about, in the list for the keyboard too (N5).
		const anchors: string[] = [];
		graph.forEachNode((id, attrs) => {
			if (!attrs.anchor || id === focusedId) return;
			if (focusContainerId && nodeGroupIds.get(id)?.has(focusContainerId)) return;
			anchors.push(id);
		});
		const leftOut = redundantAnchors({
			anchors,
			groupsOf: (id) =>
				[...(nodeGroupIds.get(id) ?? [])].flatMap((g) => latestContainerGroups.get(g) ?? []),
			neighboursOf: endsOf,
			drawnMember: (id) =>
				graph.hasNode(id) &&
				!graph.getNodeAttribute(id, 'anchor') &&
				!hiddenByFilter(graph.getNodeAttributes(id))
		});
		for (const id of leftOut) next.add(id);
		strays = next;
		reportDrawn();
	}

	let drawn: ReadonlySet<string> | null = null;
	/** Tells `onDrawn` what is drawn now, when that changed. */
	function reportDrawn() {
		const now = new Set<string>();
		let stepBack = 0;
		let standing = 0;
		graph.forEachNode((id, attrs) => {
			if (isHiddenNode(id, attrs)) return;
			standing++;
			if (isDimmedNode(id, attrs)) stepBack++;
			else now.add(id);
		});
		nodeCount = standing;
		dimmedCount = stepBack;
		if (!onDrawn) return;
		if (drawn && drawn.size === now.size && [...now].every((id) => drawn!.has(id))) return;
		drawn = now;
		onDrawn(now);
	}

	/** The bronnen standing on the canvas, and how many of them are dimmed (outside the period). */
	let nodeCount = $state(0);
	let dimmedCount = $state(0);

	/** A dated bron outside the chosen period stays, dimmed with its lines (Tijdstrook, 28 %). */
	const isDimmedNode = (id: string, attrs: Record<string, unknown>) =>
		id !== focusedId && !latestPinnedIds.has(id) && outsideYears(attrs.date);

	const outsideYears = (date: unknown) =>
		typeof date === 'string' &&
		yearPeriod !== null &&
		((yearPeriod.from !== null && date < yearPeriod.from) ||
			(yearPeriod.to !== null && date > yearPeriod.to));

	const otherCourt = (attrs: Record<string, unknown>) =>
		rechter !== null && attrs.collection === 'judgments' && attrs.rechter !== rechter;

	const hiddenByFilter = (attrs: Record<string, unknown>) =>
		(!!latestFilters?.hiddenAnnexes && attrs.drawClass === 'other') ||
		latestHiddenKinds.has(attrs.filterGroup as FilterGroup) ||
		(!!attrs.stuksoort && latestHiddenKinds.has(`stuksoort:${attrs.stuksoort}` as HiddenKind)) ||
		otherCourt(attrs);

	// The focus and the chosen bronnen stay drawn under every filter: Soort off for their own
	// kind leaves them standing, so the choice can be undone (R3-N B1).
	const isHiddenNode = (id: string, attrs: Record<string, unknown>) =>
		id !== focusedId && !latestPinnedIds.has(id) && (hiddenByFilter(attrs) || strays.has(id));

	/**
	 * What this component's $effects change is drawn in the next frame, once for all of them:
	 * a step of the focus woke five, each a render of the whole canvas. Nothing they do reads
	 * the drawing back; a fit or a measurement after a refresh stays synchronous.
	 */
	/** Half a finger's 44 px target: a tap this near a bron chooses it (touch only). */
	const TAP_RADIUS = 22;
	/** The bron nearest to a tap, within the radius of a finger's target; touch only. */
	function tapTarget(x: number, y: number): string | null {
		if (!renderer || !window.matchMedia('(pointer: coarse)').matches) return null;
		const r = renderer;
		let best: string | null = null;
		let bestD = TAP_RADIUS;
		graph.forEachNode((id, attrs) => {
			if (attrs.anchor) return;
			const d = r.getNodeDisplayData(id);
			if (!d || d.hidden) return;
			const p = r.framedGraphToViewport(d);
			const dist = Math.hypot(p.x - x, p.y - y);
			if (dist < bestD) {
				bestD = dist;
				best = id;
			}
		});
		return best;
	}

	const redrawInFrame = () => renderer?.refresh({ schedule: true });

	function refresh() {
		recomputeFocusLevel1();
		recomputeStrays();
		recomputeLinesIntoGroup();
		renderer?.refresh();
	}

	function zoom(factor: number) {
		const camera = renderer?.getCamera();
		if (!camera) return;
		camera.animate({ ratio: camera.ratio / factor }, { duration: 200 });
	}

	function fit() {
		if (!renderer) return;
		// A container measured too early (before layout settles, e.g. right after the
		// reader panel beside it changes size) leaves sigma's own coordinate scaling
		// calibrated to the wrong size, so every node renders far outside the visible
		// area even though its graph position is correct. Resizing before every fit
		// recalibrates it from the canvas's current, real size.
		renderer.resize();
		let minX = Infinity,
			maxX = -Infinity,
			minY = Infinity,
			maxY = -Infinity;
		let count = 0;
		graph.forEachNode((id, attrs) => {
			if (isHiddenNode(id, attrs)) return;
			const x = (attrs.x as number) ?? 0;
			const y = (attrs.y as number) ?? 0;
			minX = Math.min(minX, x);
			maxX = Math.max(maxX, x);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
			count++;
		});
		if (count > 0) {
			// One bron (the first of a netwerk) spans no box: centre it in one.
			if (maxX - minX < 1) [minX, maxX] = [minX - 50, maxX + 50];
			if (maxY - minY < 1) [minY, maxY] = [minY - 50, maxY + 50];
			// The nodes fill the canvas up to STAGE_PADDING px, which holds a hull's own margin;
			// each side keeps more free (fitBox): a hull's name pill above, a bron's name below the
			// lowest bron, the zoom at the side (UX review N8).
			renderer.setCustomBBox(
				fitBox(
					{ x: minX, y: minY },
					{ x: maxX, y: maxY },
					renderer.getDimensions(),
					STAGE_PADDING,
					freeEdges()
				)
			);
		} else {
			renderer.setCustomBBox(null);
		}
		// setCustomBBox only schedules a render; sigma reads the box into its
		// normalization in `process`, which runs on refresh. Without it the canvas keeps
		// the previous fit's scale until something else refreshes (a hover).
		renderer.refresh();
		renderer.getCamera().animatedReset({ duration: 300 });
		framedByFit = true;
	}

	function restoreCamera(state: { x: number; y: number; ratio: number }) {
		renderer?.getCamera().setState(state);
	}

	/** `haalt aan, lid 2, r.o. 5.1`: what an edge says on hover or when selected. */
	function edgeLabel(
		data: Record<string, unknown>,
		sourceCollection: Collection,
		source: string,
		targetCollection: Collection,
		target: string
	): string {
		const relation = data.relation as Relation;
		const meta = (data.meta ?? {}) as Record<string, unknown>;
		// In the words of relation-words.ts, read from the source: a member `diende in` or `ondertekende
		// als minister-president`; a bijlage is `bijlage bij` its letter.
		const parts = [relationLabel(relation, sourceCollection, targetCollection, meta)];
		// The source cites: the line says what the card and the row of its target say.
		const { lid, position } = readEdge(meta, {
			direction: 'inbound',
			citingEcli: sourceCollection === 'judgments' ? keyEcli(parseNodeId(source)?.key ?? '') : null
		});
		const ofRow = latestLineLids.get(edgeKey(source, target, relation));
		if (lid ?? ofRow) parts.push(`lid ${lid ?? ofRow}`);
		if (position) parts.push(position);
		if (data.status === 'voorgesteld') parts.push('voorgesteld');
		return parts.join(', ');
	}

	onMount(async () => {
		// The mobile tab strip toggles this wrapper's `display`, and sigma only ever
		// measures its container once; watch for the container going from zero size
		// to real size (a tab becoming active) and resize and refit when it does.
		resizeObserver = new ResizeObserver((entries) => {
			const box = entries[0]?.contentRect;
			if (!box || box.width === 0 || box.height === 0) return;
			const wasHidden = lastObservedSize.width === 0 || lastObservedSize.height === 0;
			const changed =
				Math.abs(box.width - lastObservedSize.width) > 1 ||
				Math.abs(box.height - lastObservedSize.height) > 1;
			lastObservedSize = { width: box.width, height: box.height };
			renderer?.resize();
			if (wasHidden || (changed && framedByFit)) fit();
		});
		resizeObserver.observe(wrap);
		// The reader's own hand on the camera: from then on a resize keeps its view.
		const handMoved = () => (framedByFit = false);
		wrap.addEventListener('wheel', handMoved, { passive: true });
		wrap.addEventListener('pointerdown', handMoved);

		const [{ default: Sigma }, { createNodeImageProgram }, { stippelProgrammas }] =
			await Promise.all([
				import('sigma'),
				import('@sigma/node-image'),
				import('./DashedEdgeProgram')
			]);
		// Left before sigma had loaded (a quick step to the next bron): no container to draw in.
		if (destroyed) return;
		const t = tokens();
		/**
		 * The name of a verbinding: level, at the middle of its line, on paper, the same for
		 * every line (Thijs, 10 Oct: a solid line's name ran along it, a dashed one's lay level).
		 */
		const tekenLijnLabel = (
			context: CanvasRenderingContext2D,
			data: { label?: string | null },
			source: { x: number; y: number },
			target: { x: number; y: number },
			settings: { edgeLabelSize: number; edgeLabelWeight: string; edgeLabelFont: string }
		) => {
			if (!data.label) return;
			const size = settings.edgeLabelSize;
			context.font = `${settings.edgeLabelWeight} ${size}px ${settings.edgeLabelFont}`;
			const w = context.measureText(data.label).width + 6;
			const h = size + 4;
			const room = context.canvas.width / (window.devicePixelRatio || 1);
			// The middle of the curve, not of the chord: both ends shift by half the bend.
			const len = Math.hypot(target.x - source.x, target.y - source.y) || 1;
			const bx = (-(target.y - source.y) / len) * BEND * len * 0.5;
			const by = ((target.x - source.x) / len) * BEND * len * 0.5;
			const p = lijnLabelPlaats(
				source.x + bx,
				source.y + by,
				target.x + bx,
				target.y + by,
				w,
				h,
				room
			);
			context.fillStyle = t.paper;
			context.fillRect(p.x, p.y, w, h);
			context.fillStyle = t.ink;
			context.fillText(data.label, p.x + 3, p.y + h / 2 + size / 3);
		};
		/** A program of sigma's with that one name for its lines. */
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const metLijnLabel = <P extends new (...a: any[]) => object>(Program: P): P =>
			class extends Program {
				drawLabel = tekenLijnLabel;
			};
		const NodeImageProgram = createNodeImageProgram({
			keepWithinCircle: true,
			drawingMode: 'background',
			padding: 0
		});

		const stippel = stippelProgrammas(arrowLength());
		renderer = new Sigma(graph, wrap, {
			// Every node is its vorm, a sprite (nodeSprites): the image program alone, which reads
			// `color` as the ground behind the sprite.
			nodeProgramClasses: { image: NodeImageProgram },
			edgeProgramClasses: {
				arrow: metLijnLabel(stippel.arrow as never),
				submitter: metLijnLabel(stippel.submitter as never),
				dashed: metLijnLabel(stippel.dashed as never),
				dotted: metLijnLabel(stippel.dotted as never),
				dashdot: metLijnLabel(stippel.dashdot as never),
				lid: metLijnLabel(stippel.lid as never),
				arrowDraad: metLijnLabel(stippel.arrowDraad as never),
				submitterDraad: metLijnLabel(stippel.submitterDraad as never),
				dashedDraad: metLijnLabel(stippel.dashedDraad as never),
				dottedDraad: metLijnLabel(stippel.dottedDraad as never),
				dashdotDraad: metLijnLabel(stippel.dashdotDraad as never)
			},
			defaultDrawEdgeLabel: tekenLijnLabel as never,
			// The thinnest a line gets, dimmed or zoomed out: its arrowhead stays 5.5 px long
			// (Netwerkcanvas, Maten).
			minEdgeThickness: MIN_ARROW_PX / arrowLength(),
			defaultNodeType: 'image',
			defaultEdgeType: 'arrow',
			zIndex: true,

			// Labels in the text face; an edge label only on hover or selection.
			renderEdgeLabels: true,
			labelFont: t.fontSerif,
			labelSize: 13,
			labelWeight: '400',
			labelColor: { color: t.ink2 },
			edgeLabelColor: { color: t.ink },
			edgeLabelFont: t.fontLabel,
			edgeLabelSize: 11.5,
			// Every name is asked for: which stand is the plan's to say (planLabels).
			labelDensity: 1000,
			labelGridCellSize: 60,
			labelRenderedSizeThreshold: 3,

			// An edge is selectable.
			enableEdgeEvents: true,
			allowInvalidContainer: true,

			stagePadding: STAGE_PADDING,
			zoomToSizeRatioFunction: (ratio: number) => Math.min(Math.sqrt(ratio), 1.5),
			// A wet's anchor is a point, not a bron: its hull shows the name on hover.
			// Een naam staat op een papieren ondergrond, zodat verbindingen hem niet
			// doorsnijden.
			defaultDrawNodeLabel: (context, data, settings) => {
				if (!data.label) return;
				const size = settings.labelSize;
				context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
				// Where the plan of this frame puts it: right of the bron, left, above or below it,
				// where no other name or bron stands; the focus always ($lib label-place). A name
				// with no free place, or past the frame's sixty, waits for a hover.
				// Sigma draws its first frame before `new Sigma` returns: no plan without it.
				if (!renderer) return;
				labelPlan ??= makeLabelPlan(renderer, context, settings);
				const key = (data as { key?: string }).key ?? '';
				const at = labelPlan.get(key);
				if (!at) return;
				labelsAt.set(key, at);
				const x = at.x + 2;
				const y = at.y + 2 + size / 2;
				context.save();
				context.globalAlpha = 1;
				context.fillStyle = t.paper;
				context.fillRect(at.x, at.y, at.w, at.h);
				context.restore();
				context.fillStyle = settings.labelColor.attribute
					? (((data as Record<string, unknown>)[settings.labelColor.attribute] as string) ??
						settings.labelColor.color ??
						t.ink)
					: (settings.labelColor.color ?? t.ink);
				context.fillText(data.label, x, y + size / 3);
			},
			// A hovered or focused bron's name, once: where its name stands, raised (a frame and a
			// shadow), else beside the bron on the side that keeps it inside the canvas and clear
			// of the Netwerk card (Thijs, 10 Oct: the name stood twice, the second one cut off).
			defaultDrawNodeHover: (context, data, settings) => {
				if (data.anchor || !data.label) return;
				const size = settings.labelSize;
				context.font = `${settings.labelWeight} ${size}px ${settings.labelFont}`;
				const w = context.measureText(data.label).width + 4;
				const h = size + 4;
				const room = context.canvas.width / (window.devicePixelRatio || 1);
				const plek = labelsAt.get((data as { key?: string }).key ?? '') ?? {
					...hoverPlaats(data.x, data.y, data.size, w, h, room),
					w,
					h
				};
				context.save();
				context.shadowColor = withAlpha(t.ink, 0.18);
				context.shadowBlur = 6;
				context.fillStyle = t.paper;
				context.beginPath();
				context.arc(data.x, data.y, data.size + 2, 0, Math.PI * 2);
				context.fill();
				context.fillRect(plek.x - 2, plek.y - 1, plek.w + 4, plek.h + 2);
				context.restore();
				context.strokeStyle = t.ruleStrong;
				context.lineWidth = 1;
				context.strokeRect(plek.x - 1.5, plek.y - 0.5, plek.w + 3, plek.h + 1);
				context.fillStyle = t.ink;
				context.fillText(data.label, plek.x + 2, plek.y + 2 + size / 2 + size / 3);
			},

			nodeReducer: (id, own) => {
				// An anchor with nothing of its hull drawn stands as an ordinary bron.
				const alone = aloneAnchors.get(id);
				const data =
					own.anchor && alone
						? { ...own, anchor: false, image: own.ownImage, size: own.ownSize, label: alone }
						: own;
				if (isHiddenNode(id, data)) return { ...data, hidden: true };
				if (data.anchor) return { ...data, label: '', forceLabel: false };
				if (isDimmedNode(id, data))
					return {
						...data,
						hidden: false,
						label: '',
						color: t.paper2,
						image: spriteForVorm(data.vorm as Vorm, true, false)
					};

				const f0 = latestFilters;
				// No single node to focus around when the selection is a container (a wet,
				// fractie, commissie or dossier draws no node of its own): its own children
				// count as in focus instead, so the rest of a busy view still dims.
				// The werkplek draws every bron of its order in full (mockup A197); only the context
				// added around the chosen bronnen steps back.
				const dimStale = isContext(id) && f0?.dimStaleContext !== false;

				const inHover = hoveredId !== null;
				const inFocusGroup = !inHover || id === hoveredId || hoveredNeighbours.has(id);
				const gewezen = latestGewezen.get(id);
				if (gewezen && id !== focusedId) {
					const zelf = id === hoveredId;
					return {
						...data,
						hidden: false,
						label: zelf ? `${data.label as string}, ${untilDate(gewezen)}` : '',
						forceLabel: zelf,
						color: t.paper2,
						image: spriteForVorm(data.vorm as Vorm, true, false)
					};
				}
				if (inHover && !inFocusGroup) {
					return {
						...data,
						hidden: false,
						label: '',
						color: t.paper2
					};
				}

				if (dimStale && !inHover) {
					return {
						...data,
						hidden: false,
						label: '',
						color: t.paper2,
						// The colour above is the ground behind the sprite: the vorm steps back as its outline.
						image: spriteForVorm(data.vorm as Vorm, true, false)
					};
				}

				// Every bron its short name, as the mockup draws them (A197); where names would cover
				// each other sigma leaves some out, never those of the hover, the focus, the chosen
				// bronnen and a cluster bron, whose name ("250 uitspraken") is what it says.
				const chosen = latestPinnedIds.has(id);
				// A cluster says its count in its circle; its name ("56 uitspraken") on a hover.
				const cluster = !!data.cluster;
				const forceLabel =
					(inHover && inFocusGroup && (!cluster || id === hoveredId)) || id === focusedId || chosen;
				// On a phone only those names: the others would cover each other (UX-toets T10b).
				const label =
					cluster && id !== hoveredId
						? ''
						: forceLabel || !narrow?.matches
							? (data.label as string)
							: '';

				if (id !== focusedId && chosen)
					return {
						...data,
						hidden: false,
						label,
						forceLabel,
						size: ((data.size as number) ?? 4) * 1.3,
						zIndex: 1
					};
				if (id !== focusedId) return { ...data, hidden: false, label, forceLabel };
				return {
					...data,
					hidden: false,
					label,
					forceLabel,
					image: spriteForVorm(
						data.vorm as Vorm,
						!!data.stub,
						true,
						data.kleur as string | undefined
					),
					size: ((data.size as number) ?? 4) * 1.6,
					zIndex: 2
				};
			},
			edgeReducer: (edge, data) => {
				if (data.layoutOnly) return { ...data, hidden: true };
				const src = graph.source(edge);
				const tgt = graph.target(edge);
				const srcAttrs = graph.getNodeAttributes(src);
				const tgtAttrs = graph.getNodeAttributes(tgt);
				if (isHiddenNode(src, srcAttrs) || isHiddenNode(tgt, tgtAttrs))
					return { ...data, hidden: true };

				const relation = data.relation as Relation;
				if (latestFilters?.hiddenLines.has(lineKindOf(relation, srcAttrs.drawClass as DrawClass)))
					return { ...data, hidden: true };
				const h = hullGroups();
				if (hullLinkOf(src, tgt, h) || anchorWithHull(src, h) || anchorWithHull(tgt, h))
					return { ...data, hidden: true };
				// A line to a wet whose articles are switched off goes with them.
				if (hiddenGroupKinds.has('instrument') && (lawAnchor(src) || lawAnchor(tgt)))
					return { ...data, hidden: true };

				const sourceClass = srcAttrs.drawClass as DrawClass;
				const style = edgeStyleFor(relation, data.status as string | null, sourceClass);
				const renderColor = edgeColorFor(relation, sourceClass);
				const edgeType = style === 'solid' ? 'arrow' : style;
				/** A thread has no arrow. */
				const draadType = edgeType === 'lid' ? edgeType : `${edgeType}Draad`;
				// A cluster's one line weighs 1 (Netwerkcanvas, Cluster).
				const restSize = lineThickness(
					srcAttrs.cluster || tgtAttrs.cluster
						? 1
						: Math.max(EDGE_WEIGHT[relation], style === 'dashed' ? 0.7 : 0)
				);
				const sourceCollection = srcAttrs.collection as Collection;

				if (edge === latestSelectedEdge) {
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: t.focus,
						size: restSize * 2.4,
						label: edgeLabel(data, sourceCollection, src, tgtAttrs.collection as Collection, tgt),
						forceLabel: true,
						zIndex: 3
					};
				}
				if (edge === hoveredEdgeId) {
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: renderColor,
						size: restSize * 1.8,
						label: edgeLabel(data, sourceCollection, src, tgtAttrs.collection as Collection, tgt),
						forceLabel: true,
						zIndex: 3
					};
				}

				// A line of a bron outside the period steps back with it.
				if (isDimmedNode(src, srcAttrs) || isDimmedNode(tgt, tgtAttrs))
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: dimColor(0.28),
						size: restSize * 0.7,
						label: ''
					};

				if (hoveredId !== null) {
					const incident = src === hoveredId || tgt === hoveredId;
					if (incident) {
						return {
							...data,
							hidden: false,
							type: edgeType,
							color: renderColor,
							size: restSize * 1.3,
							label: edgeLabel(data, sourceCollection, src, tgtAttrs.collection as Collection, tgt),
							forceLabel: true,
							zIndex: 2
						};
					}
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: dimColor(0.14),
						size: restSize,
						label: '',
						zIndex: 0
					};
				}

				// A line to context, or through a bron between the chosen ones, steps back behind the
				// chosen bronnen and what ties them directly.
				if ((isContext(src) || isContext(tgt)) && !touchesChosen(src, tgt)) {
					return {
						...data,
						hidden: false,
						type: draadType,
						color: dimColor(0.2),
						size: restSize * 0.7,
						label: ''
					};
				}

				if (focusedId !== null) {
					// The focus's own verbindingen carry the view: in full when they are few,
					// as a fan in their own colour when there are hundreds, so the fan reads as
					// one shape and a single line still shows on hover.
					if (touchesChosen(src, tgt)) {
						return {
							...data,
							hidden: false,
							type: edgeType,
							color: towardPaper(renderColor, fanStrength(renderColor, focusLevel1.size)),
							size: restSize,
							label: ''
						};
					}
					// A line between two other bronnen is context. Where it only repeats a hull
					// (inside one, or one of several from a judgment into the same law) it waits
					// for a hover; otherwise it is a trace in its own colour.
					if (repeatsHull(src, tgt, bundels, nodeGroupIds, latestPinnedIds))
						return { ...data, hidden: true };
					return {
						...data,
						hidden: false,
						type: draadType,
						color: towardPaper(renderColor, 0.25),
						// A thread: 0,6 of the thickness (Netwerkcanvas, Maten).
						size: restSize * 0.6,
						label: ''
					};
				}

				// A hull already says these two belong together; the line between them
				// repeats that, so it steps back instead of adding to the clutter.
				if (inSameGroup(src, tgt, nodeGroupIds)) {
					return {
						...data,
						hidden: false,
						type: draadType,
						color: dimColor(0.3),
						size: restSize * 0.6,
						label: ''
					};
				}

				// Without a focus, several lines from one bron into one hull are one line; the
				// others show on a hover.
				if (
					bundledInto(
						{ id: edge, source: src, target: tgt },
						bundels,
						nodeGroupIds,
						latestPinnedIds
					)
				)
					return { ...data, hidden: true };

				// Without a focus, a member with a hundred stukken draws a hundred lines: the
				// fan pales by the size of its busier end, as the focus's own fan does.
				const degree = Math.max(realDegree(graph, src), realDegree(graph, tgt));
				return {
					...data,
					hidden: false,
					type: edgeType,
					color: towardPaper(renderColor, fanStrength(renderColor, degree)),
					size: restSize,
					label: ''
				};
			}
		});

		let cameraChangeTimer: ReturnType<typeof setTimeout> | null = null;
		renderer.getCamera().on('updated', () => {
			const state = renderer!.getCamera().getState();
			if (onCameraChange) {
				if (cameraChangeTimer) clearTimeout(cameraChangeTimer);
				cameraChangeTimer = setTimeout(() => {
					onCameraChange({ x: state.x, y: state.y, ratio: state.ratio });
				}, 400);
			}
		});

		renderer.on('beforeRender', () => {
			hullNames = voorbehouden();
			labelPlan = null;
			labelsAt = new Map();
		});
		renderer.on('afterRender', updateViewportLabels);

		renderer.on('clickNode', ({ node }) => onNodeClick?.(node));
		renderer.on('doubleClickNode', ({ node, event }) => {
			event.preventSigmaDefault();
			onNodeDoubleClick?.(node);
		});
		renderer.on('clickEdge', ({ edge }) => onEdgeClick?.(edge));
		renderer.on('clickStage', ({ event }) => {
			// A finger is no pixel: a tap within 22 px of a bron (a 44 px target) chooses it.
			const hit = tapTarget(event.x, event.y);
			if (hit) onNodeClick?.(hit);
			else onStageClick?.();
		});
		renderer.on('enterNode', ({ node, event }) => {
			sigmaHoveredId = node;
			setHoveredId(node);
			onNodeHover?.(node, event.x, event.y);
		});
		renderer.on('leaveNode', () => {
			sigmaHoveredId = null;
			setHoveredId(externalHoveredId ?? null);
		});
		renderer.on('enterEdge', ({ edge }) => {
			hoveredEdgeId = edge;
			wrap.style.cursor = 'pointer';
			renderer?.refresh();
		});
		renderer.on('leaveEdge', () => {
			hoveredEdgeId = null;
			wrap.style.cursor = '';
			renderer?.refresh();
		});

		onReady?.({ refresh, fit, restoreCamera, zoom });
	});

	/** How strong a line of a fan of `n` lines is drawn: in full up to nine, paler beyond, readable. */
	const fanStrength = (color: string, n: number) => lineStrength(color, tokens().paper, n);
	/** A line of a chosen bron or of the focus: not context, not a thread. */
	const touchesChosen = (src: string, tgt: string) =>
		src === focusedId || tgt === focusedId || latestPinnedIds.has(src) || latestPinnedIds.has(tgt);

	let focusLevel1 = new Set<string>();
	function recomputeFocusLevel1() {
		focusLevel1 = new Set();
		if (!focusedId || !graph.hasNode(focusedId)) return;
		forEachRealNeighbor(graph, focusedId, (n) => focusLevel1.add(n));
	}
	$effect(() => {
		void focusedId;
		recomputeFocusLevel1();
		redrawInFrame();
	});

	onDestroy(() => {
		destroyed = true;
		resizeObserver?.disconnect();
		renderer?.kill();
		renderer = null;
	});
</script>

<div
	bind:this={wrap}
	class="canvas-wrap"
	data-nodes={nodeCount}
	data-dimmed={dimmedCount}
	onpointermove={onHullPointer}
	onpointerleave={() => {
		if (hoveredHullId !== null) {
			hoveredHullId = null;
			computeHulls();
		}
		if (sigmaHoveredId !== null) {
			sigmaHoveredId = null;
			setHoveredId(externalHoveredId ?? null);
		}
	}}
>
	{#if hulls.length > 0}
		<svg class="hull-overlay" aria-hidden="true">
			{#each hulls as h (h.id)}
				<path
					class="hull"
					class:is-dim={h.dim}
					d={h.path}
					fill={withAlpha(h.color, 0.05)}
					stroke={h.color}
					stroke-dasharray={h.dash}
				/>
			{/each}
			{#each hullLinks as l (l.id)}
				<g class="hull-link" class:is-dim={l.dim}>
					<path
						d={l.d}
						stroke={l.color}
						stroke-width={l.width}
						stroke-dasharray={l.dash}
						fill="none"
					/>
					{#if l.arrow}<path d={l.arrow} fill={l.color} />{/if}
				</g>
			{/each}
		</svg>
		<div class="hull-label-overlay" aria-hidden="true">
			{#each hulls.filter((h) => h.label) as h (h.id)}
				<span
					class="hull-label"
					class:is-dim={h.dim}
					class:is-long={h.long}
					style="--x:{h.labelX}px; --y:{h.labelY}px; --hull-color:{h.color}">{h.label}</span
				>
			{/each}
			{#each hullLinks as l (l.id)}
				{#if l.label}
					<span
						class="hull-link-label"
						style="--x:{l.labelX}px; --y:{l.labelY}px; --link-color:{l.color}">{l.label}</span
					>
				{/if}
			{/each}
		</div>
	{/if}
	{#if notitieMerken.length > 0}
		<div class="notitie-overlay" aria-hidden="true">
			{#each notitieMerken as m (m.id)}
				<span
					class="notitie-merk"
					class:is-open={m.open}
					class:is-dim={m.dim}
					style="left:{m.vx}px; top:{m.vy}px"><Picto naam="bewaard" size={10} /></span
				>
			{/each}
		</div>
	{/if}
	{#if openstaand.length > 0}
		<div class="openstaand-overlay" aria-hidden="true">
			{#each openstaand as b (b.id)}
				<span
					class="openstaand-stip"
					data-openstaand={b.id}
					title="Lopend wetsvoorstel"
					style="left:{b.vx}px; top:{b.vy}px"
				></span>
			{/each}
		</div>
	{/if}
</div>

<style>
	.canvas-wrap {
		width: 100%;
		height: 100%;
		position: relative;
		overflow: hidden;
		background: var(--paper);
		user-select: none;
	}

	:global(.canvas-wrap canvas) {
		display: block;
	}

	/* Behind sigma's own canvases: no z-index, and earlier in the DOM than the
	   canvases sigma appends at mount, so the default paint order puts it there. */
	.hull-overlay {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		overflow: visible;
		pointer-events: none;
	}
	.hull-overlay .hull {
		stroke-width: 1.6;
		transition: opacity var(--dur-1) var(--ease);
	}
	/* A line between hulls, in the stroke and thickness of its kind. */
	.hull-link path:first-child {
		stroke-linecap: round;
	}
	.hull-link {
		opacity: 0.8;
		transition: opacity var(--dur-1) var(--ease);
	}
	.hull.is-dim,
	.hull-link.is-dim,
	.hull-label.is-dim {
		opacity: 0.3;
	}
	.hull-link-label {
		position: absolute;
		left: 0;
		top: 0;
		transform: translate(calc(var(--x) - 50%), calc(var(--y) - 50%));
		padding: 1px var(--s-2);
		border-radius: var(--r-rond);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-label);
		color: var(--link-color);
		white-space: nowrap;
	}

	/* Above sigma's canvases, unlike the hull fill: a label buried under a dense
	   web of edges is not a label. */
	.hull-label-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 4;
	}
	/* Placed by transform, not left and top: a label that moves with the layout is no layout
	   shift (N17c). */
	.hull-label {
		position: absolute;
		left: 0;
		top: 0;
		transform: translate(calc(var(--x) - 50%), calc(var(--y) - 100%));
		padding: 1px var(--s-2);
		border-radius: var(--r-1);
		/* Pure paper, an edge of 1 px in the colour of its kind (Netwerkcanvas, Omhulling). */
		background: var(--paper);
		border: 1px solid var(--hull-color);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 18px;
		font-weight: 600;
		/* The name in ink: the lighter groups (Dossier, 3.1:1) are too faint for text. */
		color: var(--ink);
		white-space: nowrap;
		/* A dossier's title in full can be wider than the canvas: it wraps (.is-long). */
		max-width: calc(100% - 20px);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hull-label.is-long {
		width: max-content;
		white-space: normal;
		line-height: var(--lh-snug);
	}

	/* A badge on a bron with an open dossier: the count when more than one. */
	.openstaand-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 6;
	}
	/* The mark of a bron with a note: the sign of Bewaar, small and quiet, in ink when open. */
	.notitie-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 5;
	}
	.notitie-merk {
		position: absolute;
		transform: translate(-50%, -50%);
		display: inline-flex;
		padding: 1px;
		border-radius: var(--r-1);
		background: var(--paper);
		color: var(--ink-3);
		transition: opacity var(--dur-1) var(--ease);
	}
	.notitie-merk.is-open {
		color: var(--ink);
	}
	.notitie-merk.is-dim {
		opacity: 0.4;
	}
	.openstaand-stip {
		position: absolute;
		transform: translate(-50%, -50%);
		width: 6px;
		height: 6px;
		border-radius: var(--r-rond);
		background: var(--soort-parlement);
		border: 1.5px solid var(--paper);
		box-sizing: content-box;
	}
</style>

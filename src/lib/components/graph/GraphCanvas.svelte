<script lang="ts">
	import { redundantAnchors } from '$lib/graph/anchor';
	import Picto from '$lib/components/ui/Picto.svelte';
	import type { Vorm } from '$lib/bron/vormen';
	import { onDestroy, onMount, untrack } from 'svelte';
	import type SigmaType from 'sigma';
	import type Graph from 'graphology';
	import { paragraphCite } from '$lib/text/judgment-cite';
	import type { GraphFilters } from '$lib/graph/graph-store';
	import type { NodeCounts } from '$lib/api/overlays';
	import { EDGE_WEIGHT, type GraphNodeKind } from '$lib/graph/types';
	import {
		hoverPlaats,
		labelX,
		lijnLabelPlaats,
		plaatsLabel,
		type Rect as LabelRect
	} from './label-place';
	import { relationLabel, type Collection, type Relation } from '$lib/vocabulary';
	import type { BronKind, Rechter } from '$lib/verbonden/filter';
	import { getInstrumentMeta } from '$lib/api/instrument-cache';
	import { isDrawnGroup, type ContainerGroup, type Period } from '$lib/graph/container-membership';
	import { korteDatum, vandaag } from '$lib/text/datum';
	import { metGroepVerborgen } from '$lib/graph/met-groep';
	import { centroid, exitPoint, hullOutline, type Point } from '$lib/graph/hull';
	import {
		spriteFor,
		spriteForVorm,
		shapeFor,
		badgeAxisOffset,
		edgeColorFor,
		edgeStyleFor,
		hullColorFor,
		hullDashFor,
		dimColor,
		towardPaper,
		withAlpha,
		tokens,
		lijnDikte,
		pijlLengte,
		PIJL_BREED
	} from './nodeSprites';

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
		hiddenKinds = new Set<BronKind>() as ReadonlySet<BronKind>,
		pinnedIds = new Set<string>() as Set<string>,
		coreIds = null as ReadonlySet<string> | null,
		containerGroups = new Map<string, ContainerGroup>() as Map<string, ContainerGroup>,
		focusContainerId = null as string | null,
		groupPeriod = null as Period | null,
		yearPeriod = null as Period | null,
		rechter = null as Rechter | null,
		selectedEdgeId = null as string | null,
		inFluxMap = new Map() as NodeCounts,
		heatMap = new Map() as NodeCounts,
		heatActive = false,
		heatPeriodMonths = 12,
		mutatieActive = false,
		onNodeClick,
		onNodeDoubleClick,
		onNodeHover,
		onNodeLeave,
		onEdgeClick,
		onStageClick,
		onReady,
		onCameraChange,
		externalHoveredId = null as string | null,
		notitieIds = new Set() as ReadonlySet<string>,
		avoid = null as Rect | null
	}: {
		graph: Graph;
		focusedId?: string | null;
		filters?: GraphFilters | null;
		/** Kinds of bron the bronfilter hides: not drawn, and their edges not drawn. */
		hiddenKinds?: ReadonlySet<BronKind>;
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
		inFluxMap?: NodeCounts;
		heatMap?: NodeCounts;
		heatActive?: boolean;
		heatPeriodMonths?: number;
		mutatieActive?: boolean;
		onNodeClick?: (id: string) => void;
		onNodeDoubleClick?: (id: string) => void;
		onNodeHover?: (id: string, vx: number, vy: number) => void;
		onNodeLeave?: () => void;
		onEdgeClick?: (id: string) => void;
		onStageClick?: () => void;
		onReady?: (api: GraphCanvasApi) => void;
		onCameraChange?: (state: { x: number; y: number; ratio: number }) => void;
		/** Keeps the dim/highlight pass alive while the hover panel is open. */
		externalHoveredId?: string | null;
		/** The bronnen with a note of the reader's (Gemarkeerd): a quiet mark beside each. */
		notitieIds?: ReadonlySet<string>;
		/** A panel floating over the canvas, in canvas pixels: hull labels keep clear of it. */
		avoid?: Rect | null;
	} = $props();

	type Rect = { x: number; y: number; width: number; height: number };

	/**
	 * A label pill (centred on x, its bottom at y) moved clear of the floating panel: to
	 * the panel's left where it fits, else below it.
	 */
	function clearOfPanel(x: number, y: number, half: number): { x: number; y: number } {
		const r = avoid;
		if (!r) return { x, y };
		const hits =
			x + half > r.x && x - half < r.x + r.width && y > r.y && y - LABEL_HEIGHT < r.y + r.height;
		if (!hits) return { x, y };
		const left = r.x - half - EDGE_GAP;
		if (left >= half + EDGE_GAP) return { x: left, y };
		return { x, y: r.y + r.height + LABEL_HEIGHT + EDGE_GAP };
	}

	$effect(() => {
		void avoid;
		untrack(() => computeHulls());
	});

	let wrap: HTMLDivElement;
	let destroyed = false;
	/** The names drawn in this frame, so the next one stands beside them, not over them. */
	let labelsTaken: LabelRect[] = [];
	/** Where each name stands in this frame: its hover stands there too, not beside it. */
	let labelsAt = new Map<string, LabelRect>();
	/** Where the focus's name stands this frame, reserved before the others (voorbehouden). */
	let focusPlek: { x: number; y: number } | null = null;
	/**
	 * The places taken before the names are drawn (UX test 10 Oct, #25: names over one another):
	 * the hulls' labels, a layer of their own drawn after sigma's names, as they stand, and the
	 * focus's name, which always stands beside its bron. The other names find a free place
	 * around them.
	 */
	function voorbehouden(): LabelRect[] {
		const taken: LabelRect[] = [];
		focusPlek = null;
		if (!renderer || !wrap) return taken;
		const box = wrap.getBoundingClientRect();
		for (const el of wrap.querySelectorAll<HTMLElement>('.hull-label, .hull-link-label')) {
			const r = el.getBoundingClientRect();
			if (r.width > 0)
				taken.push({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
		}
		if (focusedId && graph.hasNode(focusedId)) {
			// The name as drawn, after the reducers (short on the canvas).
			const data = renderer.getNodeDisplayData(focusedId);
			const label = data?.label ?? '';
			if (label && data && !data.hidden) {
				const { x, y } = renderer.framedGraphToViewport(data);
				const size = renderer.getSetting('labelSize');
				labelMeasure ??= document.createElement('canvas').getContext('2d');
				if (labelMeasure) {
					labelMeasure.font = `${renderer.getSetting('labelWeight')} ${size}px ${renderer.getSetting('labelFont')}`;
					const w = labelMeasure.measureText(label).width + 4;
					const h = size + 4;
					const grootte = renderer.scaleSize(data.size);
					focusPlek = { x: labelX(x, grootte, w, box.width), y: y - h / 2 };
					taken.push({ ...focusPlek, w, h });
				}
			}
		}
		return taken;
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
	let latestHiddenKinds: ReadonlySet<BronKind> = new Set();
	let latestPinnedIds = new Set<string>();
	let latestCoreIds: ReadonlySet<string> | null = null;
	let latestSelectedEdge: string | null = null;
	let latestInFluxMap: NodeCounts = new Map();
	let latestHeatMap: NodeCounts = new Map();
	let latestHeatActive = false;
	let latestHeatPeriodMonths = 12;
	let latestMutatieActive = false;
	let latestContainerGroups: Map<string, ContainerGroup> = new Map();
	let latestFocusMembers: ReadonlySet<string> = new Set();
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
		for (const e of promotedEdges) {
			try {
				graph.setEdgeAttribute(e, 'zIndex', 0);
			} catch {
				/* edge gone */
			}
		}
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
		if (hoveredId) {
			try {
				graph.forEachNeighbor(hoveredId, (n) => hoveredNeighbours.add(n));
			} catch {
				/* node may be gone */
			}
		}
		promoteEdgesForHover(hoveredId);
		renderer?.refresh();
	}

	$effect(() => {
		latestInFluxMap = inFluxMap ?? new Map();
		latestHeatMap = heatMap ?? new Map();
		latestHeatActive = heatActive ?? false;
		latestHeatPeriodMonths = heatPeriodMonths ?? 12;
		latestMutatieActive = mutatieActive ?? false;
		updateViewportLabels();
		renderer?.refresh();
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
		renderer?.refresh();
	});

	/** Context of a netwerk: on the canvas, but not chosen nor tying chosen bronnen. */
	const isContext = (id: string) =>
		latestCoreIds !== null &&
		!latestCoreIds.has(id) &&
		id !== focusedId &&
		!graph.getNodeAttribute(id, 'cluster');

	/**
	 * A bron between the chosen bronnen of a netwerk ("bronnen ertussen"): faint and without a
	 * label until a hover, so the chosen bronnen and what ties them directly carry the view
	 * (UX evaluation of 8 Oct, point 1: 204 bronnen read as a tangle). A cluster of them keeps
	 * its name.
	 */
	const isTussen = (id: string) =>
		latestCoreIds !== null &&
		latestPinnedIds.size > 0 &&
		latestCoreIds.has(id) &&
		!latestPinnedIds.has(id) &&
		id !== focusedId &&
		!graph.getNodeAttribute(id, 'cluster');

	/** Whether `a` and `b` both belong to the same hull: an edge between them adds
	 *  nothing a hull did not already say, so it stays out of the way at rest. */
	/**
	 * How many lines a bron outside every hull draws into each hull (`bron|group`): a
	 * judgment citing five articles of one law draws five, and those repeat what the hull
	 * says; one line into a hull is what ties that hull to the network.
	 */
	let linesIntoGroup = new Map<string, number>();
	/**
	 * Of all lines from one bron into one hull it is not in (`bron|group`, also from inside
	 * another hull): how many, and the one that stands for them. Nine stukken of a dossier
	 * changing 44 articles of the Sr draw one line each into the Sr, not 116.
	 */
	let bundles = new Map<string, { count: number; first: string }>();
	function recomputeLinesIntoGroup() {
		const counts = new Map<string, number>();
		const bundled = new Map<string, { count: number; first: string }>();
		graph.forEachEdge((edge, attrs, source, target) => {
			if (attrs.layoutOnly) return;
			// In the direction of the line: a stuk into the articles it changes, a judgment
			// into the articles it cites. The articles are carried by their hull.
			const own = nodeGroupIds.get(source);
			for (const group of nodeGroupIds.get(target) ?? []) {
				if (own?.has(group)) continue;
				const key = `${source}|${group}`;
				const b = bundled.get(key);
				if (b) b.count++;
				else bundled.set(key, { count: 1, first: edge });
			}
			for (const [from, to] of [
				[source, target],
				[target, source]
			]) {
				if (nodeGroupIds.has(from)) continue;
				for (const group of nodeGroupIds.get(to) ?? [])
					counts.set(`${from}|${group}`, (counts.get(`${from}|${group}`) ?? 0) + 1);
			}
		});
		linesIntoGroup = counts;
		bundles = bundled;
	}
	/** Whether a line is one of several from a bron into the same hull, and not the one that
	 *  stands for them: it waits for a hover. */
	function bundledInto(edge: string, src: string, tgt: string): boolean {
		let bundled = false;
		const own = nodeGroupIds.get(src);
		for (const group of nodeGroupIds.get(tgt) ?? []) {
			if (own?.has(group)) continue;
			const b = bundles.get(`${src}|${group}`);
			if (!b || b.count === 1 || b.first === edge) return false;
			bundled = true;
		}
		return bundled;
	}
	/** Whether a line between two bronnen, neither the focus, only repeats a hull. */
	function repeatsHull(src: string, tgt: string): boolean {
		if (inSameGroup(src, tgt)) return true;
		const inA = nodeGroupIds.has(src);
		const inB = nodeGroupIds.has(tgt);
		// Between two hulls the line says why the other one is there (art. 126uba Sv → Sr).
		if (inA && inB) return false;
		const [outside, inside] = inA ? [tgt, src] : [src, tgt];
		return [...(nodeGroupIds.get(inside) ?? [])].some(
			(group) => (linesIntoGroup.get(`${outside}|${group}`) ?? 0) > 1
		);
	}

	function inSameGroup(a: string, b: string): boolean {
		const groupsOfA = nodeGroupIds.get(a);
		if (!groupsOfA) return false;
		const groupsOfB = nodeGroupIds.get(b);
		if (!groupsOfB) return false;
		for (const id of groupsOfA) if (groupsOfB.has(id)) return true;
		return false;
	}

	$effect(() => {
		const focusGroup = focusContainerId ? containerGroups.get(focusContainerId) : undefined;
		latestFocusMembers = focusGroup?.members ?? new Set();
		// Ended before the hull's own last day: a cabinet that has ended does not make all its
		// bewindspersonen former ones, only those who left before it did.
		const zetels = [...(focusGroup?.periods ?? [])];
		const eind = zetels.some(([, p]) => p.to === null)
			? vandaag()
			: (zetels
					.map(([, p]) => p.to as string)
					.sort()
					.at(-1) ?? '');
		latestGewezen = new Map(
			zetels.filter(([, p]) => p.to !== null && p.to < eind).map(([id, p]) => [id, p.to as string])
		);
		renderer?.refresh();
	});

	$effect(() => {
		setHoveredId(sigmaHoveredId ?? externalHoveredId);
	});

	$effect(() => {
		latestFilters = filters;
		latestHiddenKinds = hiddenKinds;
		void rechter;
		latestPinnedIds = pinnedIds;
		latestCoreIds = coreIds;
		recomputeStrays();
		latestSelectedEdge = selectedEdgeId;
		renderer?.refresh();
	});

	// Activity halos: HTML rings above the canvas, from rule-strong at low activity
	// to ink at saturation.
	type ActivityHalo = { id: string; vx: number; vy: number; ringPx: number; color: string };
	let activityHalos = $state<ActivityHalo[]>([]);

	function heatColor(t: number): string {
		const hex = (s: string) => parseInt(s, 16);
		const from = tokens().ruleStrong.replace('#', '');
		const to = tokens().ink.replace('#', '');
		const mix = (i: number) =>
			Math.round(
				hex(from.slice(i, i + 2)) + t * (hex(to.slice(i, i + 2)) - hex(from.slice(i, i + 2)))
			);
		return `rgb(${mix(0)},${mix(2)},${mix(4)})`;
	}

	type MutatieBadge = { id: string; vx: number; vy: number; count: number };
	let mutatieBadges = $state<MutatieBadge[]>([]);
	/** A bron with a note of the reader's: its mark, in ink while it is open or in focus. */
	type NotitieMerk = { id: string; vx: number; vy: number; open: boolean; dim: boolean };
	let notitieMerken = $state<NotitieMerk[]>([]);

	// Containment hulls: a soft outline behind a wet's artikelen, or a fractie's or
	// commissie's leden, drawn from wherever those bronnen currently sit on canvas.
	type Hull = {
		id: string;
		path: string;
		color: string;
		/** The line of its kind (`hullDashFor`): the kind reads without its colour. */
		dash: string | undefined;
		labelX: number;
		labelY: number;
		label: string;
		/** Wider than the canvas: the name wraps instead of being cut. */
		long: boolean;
		/** Out of the hover: the hovered bron is not in it and not tied to it. */
		dim: boolean;
	};
	let hulls = $state<Hull[]>([]);

	// A line from a bron in a hull to a wet's anchor (the change a dossier proposes)
	// is drawn once, hull to hull, instead of once per stuk.
	type HullLink = {
		id: string;
		d: string;
		arrow: string;
		color: string;
		dashed: boolean;
		dim: boolean;
		/** The relation in words, shown while one of its hulls is in the hover. */
		label: string | null;
		labelX: number;
		labelY: number;
	};
	let hullLinks = $state<HullLink[]>([]);

	// The hull under the pointer (its shape or its label), found in `onpointermove`.
	let hoveredHullId: string | null = null;
	let hullHitAreas: { id: string; polygon: Point[]; label: DOMRect }[] = [];

	function hullLinkOf(src: string, tgt: string): { from: string; to: string } | null {
		if (!graph.hasNode(tgt) || !graph.getNodeAttribute(tgt, 'anchor')) return null;
		const to = [...(nodeGroupIds.get(tgt) ?? [])][0];
		const from = [...(nodeGroupIds.get(src) ?? [])].find((id) => {
			const group = latestContainerGroups.get(id);
			return group && group.kind !== 'instrument' && drawnGroup(group);
		});
		return to && from ? { from, to } : null;
	}

	/**
	 * A container's anchor (a wet, a fractie) is no bron on the canvas, only its hull: a line
	 * to it is drawn to the edge of that hull, not into it (Thijs, 9 Oct). True when the
	 * anchor's hull is drawn; then the line is the overlay's, not the canvas's.
	 */
	function anchorWithHull(id: string): boolean {
		if (!graph.hasNode(id) || !graph.getNodeAttribute(id, 'anchor')) return false;
		return [...(nodeGroupIds.get(id) ?? [])].some((g) => {
			const group = latestContainerGroups.get(g);
			return !!group && drawnGroup(group) && !hiddenGroupKinds.has(group.kind);
		});
	}

	const lawAnchor = (id: string) =>
		graph.hasNode(id) &&
		!!graph.getNodeAttribute(id, 'anchor') &&
		graph.getNodeAttribute(id, 'collection') === 'instruments';

	const inside = (p: Point, polygon: Point[]) => {
		let hit = false;
		for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
			const a = polygon[i];
			const b = polygon[j];
			if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x)
				hit = !hit;
		}
		return hit;
	};

	function onHullPointer(event: PointerEvent) {
		const box = wrap.getBoundingClientRect();
		const p = { x: event.clientX - box.left, y: event.clientY - box.top };
		// The last hull drawn is the one on top; a label counts as its hull.
		let hit: string | null = null;
		for (const area of hullHitAreas) {
			const r = area.label;
			const onLabel = p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom;
			if (onLabel || inside(p, area.polygon)) hit = area.id;
		}
		if (hit === hoveredHullId) return;
		hoveredHullId = hit;
		computeHulls();
	}

	const HULL_MARGIN = 16;
	// Around the nodes on a fit: the hull margin and a little air. Above them, the
	// label pill of a hull (8 px gap, 22 px pill) and the edge gap on top of that.
	const STAGE_PADDING = HULL_MARGIN + 6;
	const LABEL_GAP = 8;
	const LABEL_HEIGHT = 22;
	const EDGE_GAP = 10;
	// STAGE_PADDING already holds the hull margin and 6 px of it.
	const LABEL_ROOM = LABEL_GAP + LABEL_HEIGHT + EDGE_GAP - 6;

	// The width of a hull label, to keep it on the canvas: its text in the pill's face
	// (.hull-label), plus the padding and border.
	let labelMeasure: CanvasRenderingContext2D | null = null;
	function labelWidth(text: string): number {
		labelMeasure ??= document.createElement('canvas').getContext('2d');
		if (!labelMeasure) return 0;
		labelMeasure.font = `600 11.5px ${tokens().fontSans}`;
		return labelMeasure.measureText(text).width + 18;
	}

	function computeHulls() {
		if (!renderer || latestContainerGroups.size === 0) {
			if (hulls.length) hulls = [];
			return;
		}
		type Drawn = Hull & { polygon: Point[]; center: Point; members: Set<string> };
		const drawn = new Map<string, Drawn>();
		// The labels placed so far, and the focus's name: a hull's label takes a free place
		// (UX test 10 Oct, #25: "Verdrag tot bescherming…" over "Richtlijn (EU) 2019/1023",
		// the focus's name covered). The labels lie over the canvas, so they decide.
		const bezet: LabelRect[] = [];
		const focusNaam = focusedId ? labelsAt.get(focusedId) : undefined;
		if (focusNaam) bezet.push(focusNaam);
		const raakt = (a: LabelRect, b: LabelRect) =>
			a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
		/** Per anchor, the hull drawn for it. */
		const anchorHull = new Map<string, Drawn>();
		for (const group of latestContainerGroups.values()) {
			if (!drawnGroup(group) || hiddenGroupKinds.has(group.kind)) continue;
			const points: { x: number; y: number }[] = [];
			let anchorPoint: { x: number; y: number } | null = null;
			for (const id of group.members) {
				if (!graph.hasNode(id)) continue;
				const attrs = graph.getNodeAttributes(id);
				if (isHiddenNode(id, attrs)) continue;
				const p = renderer!.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				if (attrs.anchor) anchorPoint = p;
				else points.push(p);
			}
			// The anchor is no bron: the hull goes round what it holds, not to where the anchor
			// is pulled (Awb with only art. 3:4 was a pill to an empty point, Thijs 9 Oct). An
			// anchor alone is its own empty hull.
			if (points.length === 0 && anchorPoint) points.push(anchorPoint);
			// One member is a hull when it is a container's anchor (the wet or fractie itself,
			// drawn as an empty hull), the dossier of a stuk on a path between chosen bronnen
			// (`lone`), or an article: an article always stands in its wet (Thijs, 9 Oct).
			const anchor = [...group.members].find(
				(id) => graph.hasNode(id) && !!graph.getNodeAttribute(id, 'anchor')
			);
			if (points.length < (anchor || group.lone || group.kind === 'instrument' ? 1 : 2)) continue;
			const meta = group.kind === 'instrument' ? getInstrumentMeta(group.id) : null;
			const label =
				(meta ? (meta.shortTitle ?? meta.citationTitle) : group.label) ||
				group.label ||
				(anchor ? ((graph.getNodeAttribute(anchor, 'anchorNaam') as string) ?? '') : '');
			if (!label) continue;
			// The full name while the hull, or a bron in it, is under the pointer.
			const inHover =
				hoveredHullId === group.id || (hoveredId !== null && group.members.has(hoveredId));
			const full = meta ? (meta.citationTitle ?? meta.title) : group.fullLabel;
			// In a netwerk, a hull of only bronnen between the chosen ones names itself on a
			// hover or zoomed in; zoomed out its name would cover the chosen bronnen' (6e).
			const stil =
				latestPinnedIds.size > 0 &&
				!inHover &&
				renderer.getCamera().ratio > HULL_LABEL_ZOOM &&
				![...group.members].some((id) => id === focusedId || latestPinnedIds.has(id));
			const shown = stil ? '' : inHover && full ? full : label;
			// The label anchors to this hull's own outline, not a raw member point: a
			// bron in several groups at once (a lid on many commissies) would otherwise
			// put every one of its hulls' labels on that one shared point.
			const { outline, polygon, path } = hullOutline(points, HULL_MARGIN);
			const top = outline.reduce((a, b) => (b.y < a.y ? b : a));
			// Above the hull's top, but never past the edge of the canvas: a hull at the
			// border (or a fit that leaves little room) would cut its label in half.
			const { width } = renderer.getDimensions();
			const half = Math.min(labelWidth(shown), width - 2 * EDGE_GAP) / 2;
			// A name wider than the canvas wraps; its lines stay below the top edge.
			const lines = Math.ceil(labelWidth(shown) / (width - 2 * EDGE_GAP));
			const at = clearOfPanel(
				Math.min(
					Math.max(top.x, half + EDGE_GAP),
					Math.max(half + EDGE_GAP, width - half - EDGE_GAP)
				),
				Math.max(top.y - LABEL_GAP, lines * LABEL_HEIGHT + EDGE_GAP),
				half
			);
			// Its own place, or a step down into its hull; with none free it waits for a hover,
			// as a bron's name does. Under the pointer it stands regardless.
			const hoog = lines * LABEL_HEIGHT;
			let plek: { x: number; y: number } | null = null;
			for (let stap = 0; stap < 4 && shown; stap++) {
				const y = at.y + stap * (LABEL_HEIGHT + 4);
				const r = { x: at.x - half, y: y - hoog, w: half * 2, h: hoog };
				if (!bezet.some((b) => raakt(r, b))) {
					plek = { x: at.x, y };
					bezet.push(r);
					break;
				}
			}
			if (!plek && inHover) plek = at;
			drawn.set(group.id, {
				id: group.id,
				path,
				color: hullColorFor(group.kind),
				dash: hullDashFor(group.kind),
				label: plek ? shown : '',
				long: lines > 1,
				labelX: (plek ?? at).x,
				labelY: (plek ?? at).y,
				dim: false,
				polygon,
				center: centroid(points),
				members: group.members
			});
			if (anchor) anchorHull.set(anchor, drawn.get(group.id)!);
		}

		// One line per pair of hulls, from where it leaves the one to where it enters the other.
		const links = new Map<
			string,
			{ from: Drawn; to: Drawn; relation: Relation; status: unknown }
		>();
		graph.forEachEdge((_e, attrs, src, tgt) => {
			const pair = !attrs.layoutOnly && hullLinkOf(src, tgt);
			const from = pair && drawn.get(pair.from);
			const to = pair && drawn.get(pair.to);
			if (!from || !to) return;
			const id = `${from.id}->${to.id}`;
			if (!links.has(id))
				links.set(id, { from, to, relation: attrs.relation as Relation, status: attrs.status });
		});

		// In the hover: the hulls that hold the hovered bron or one tied to it, or the
		// hovered hull, and every hull a line joins to those. The rest steps back.
		let active: Set<string> | null = null;
		if (hoveredHullId && drawn.has(hoveredHullId)) active = new Set([hoveredHullId]);
		else if (hoveredId !== null) {
			active = new Set();
			for (const h of drawn.values()) {
				if (h.members.has(hoveredId) || [...h.members].some((m) => hoveredNeighbours.has(m)))
					active.add(h.id);
			}
		}
		if (active) {
			for (const { from, to } of links.values()) {
				if (active.has(from.id) || active.has(to.id)) {
					active.add(from.id);
					active.add(to.id);
				}
			}
			for (const h of drawn.values()) h.dim = !active.has(h.id);
		}

		const nextLinks: HullLink[] = [];
		for (const [id, { from, to, relation, status }] of links) {
			const start = exitPoint(from.center, to.center, from.polygon);
			const end = exitPoint(to.center, from.center, to.polygon);
			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const len = Math.hypot(dx, dy) || 1;
			const ux = dx / len;
			const uy = dy / len;
			// A small arrowhead at the wet, 7 px long.
			const back = { x: end.x - ux * 7, y: end.y - uy * 7 };
			const arrow = `M ${end.x} ${end.y} L ${back.x - uy * 3.5} ${back.y + ux * 3.5} L ${back.x + uy * 3.5} ${back.y - ux * 3.5} Z`;
			const lit = active !== null && active.has(from.id) && active.has(to.id);
			const words = [
				relationLabel(relation, 'documents'),
				status === 'voorgesteld' ? 'voorgesteld' : null
			]
				.filter(Boolean)
				.join(', ');
			nextLinks.push({
				id,
				d: `M ${start.x} ${start.y} L ${back.x} ${back.y}`,
				arrow,
				color: edgeColorFor(relation, 'document'),
				dashed: status === 'voorgesteld',
				dim: active !== null && !lit,
				label: lit ? words : null,
				labelX: (start.x + end.x) / 2,
				labelY: (start.y + end.y) / 2
			});
		}

		// A line to an anchor ends at the edge of its hull, its arrow there; a line from one
		// starts at that edge. One per bron and hull.
		const seen = new Set<string>();
		graph.forEachEdge((_e, attrs, src, tgt) => {
			if (attrs.layoutOnly || hullLinkOf(src, tgt)) return;
			const fromHull = anchorHull.get(src);
			const toHull = anchorHull.get(tgt);
			if (!fromHull && !toHull) return;
			const nodeEnd = !fromHull ? src : !toHull ? tgt : null;
			if (nodeEnd && isHiddenNode(nodeEnd, graph.getNodeAttributes(nodeEnd))) return;
			const key = `${fromHull?.id ?? src}->${toHull?.id ?? tgt}`;
			if (seen.has(key)) return;
			seen.add(key);
			const pointOf = (id: string) => {
				const a = graph.getNodeAttributes(id);
				return renderer!.graphToViewport({ x: a.x as number, y: a.y as number });
			};
			const radius = (id: string) => (renderer!.getNodeDisplayData(id)?.size ?? 4) + 2;
			let start: Point;
			let end: Point;
			if (fromHull && toHull) {
				start = exitPoint(fromHull.center, toHull.center, fromHull.polygon);
				end = exitPoint(toHull.center, fromHull.center, toHull.polygon);
			} else if (toHull) {
				const p = pointOf(src);
				end = exitPoint(toHull.center, p, toHull.polygon);
				const d = Math.hypot(end.x - p.x, end.y - p.y) || 1;
				start = {
					x: p.x + ((end.x - p.x) / d) * radius(src),
					y: p.y + ((end.y - p.y) / d) * radius(src)
				};
			} else {
				const p = pointOf(tgt);
				start = exitPoint(fromHull!.center, p, fromHull!.polygon);
				const d = Math.hypot(start.x - p.x, start.y - p.y) || 1;
				end = {
					x: p.x + ((start.x - p.x) / d) * radius(tgt),
					y: p.y + ((start.y - p.y) / d) * radius(tgt)
				};
			}
			const dx = end.x - start.x;
			const dy = end.y - start.y;
			const len = Math.hypot(dx, dy) || 1;
			const ux = dx / len;
			const uy = dy / len;
			const back = { x: end.x - ux * 7, y: end.y - uy * 7 };
			const hull = (toHull ?? fromHull)!;
			const lit = hoveredHullId === hull.id || (nodeEnd !== null && hoveredId === nodeEnd);
			const relation = attrs.relation as Relation;
			const sourceKind = graph.getNodeAttribute(src, 'kind') as GraphNodeKind;
			nextLinks.push({
				id: `anker:${key}`,
				d: `M ${start.x} ${start.y} L ${back.x} ${back.y}`,
				arrow: `M ${end.x} ${end.y} L ${back.x - uy * 3.5} ${back.y + ux * 3.5} L ${back.x + uy * 3.5} ${back.y - ux * 3.5} Z`,
				color: edgeColorFor(relation, sourceKind),
				dashed: attrs.status === 'voorgesteld',
				dim: active !== null && !lit && !active.has(hull.id),
				label: lit
					? [
							relationLabel(relation, graph.getNodeAttribute(src, 'collection') as Collection),
							attrs.status === 'voorgesteld' ? 'voorgesteld' : null
						]
							.filter(Boolean)
							.join(', ')
					: null,
				labelX: (start.x + end.x) / 2,
				labelY: (start.y + end.y) / 2
			});
		});

		const next = [...drawn.values()];
		// A hull's name stands where no other hull's name stands (6e: around art. 273f a
		// dozen law hulls named themselves on top of each other in a column). The hull under
		// the pointer goes first, then the one holding the focus or a chosen bron, then the
		// larger; a name with no free place waits for a hover or a zoom.
		const voorrang = (h: (typeof next)[number]) =>
			(hoveredHullId === h.id || (hoveredId !== null && h.members.has(hoveredId)) ? 4 : 0) +
			(focusedId !== null && h.members.has(focusedId) ? 2 : 0) +
			([...h.members].some((id) => latestPinnedIds.has(id)) ? 1 : 0);
		const geplaatst: { x: number; y: number; w: number; h: number }[] = [];
		for (const h of [...next].sort(
			(a, b) => voorrang(b) - voorrang(a) || b.members.size - a.members.size
		)) {
			if (!h.label) continue;
			const w = labelWidth(h.label);
			const r = { x: h.labelX - w / 2, y: h.labelY - LABEL_HEIGHT, w, h: LABEL_HEIGHT };
			const botst = geplaatst.some(
				(o) => r.x < o.x + o.w && o.x < r.x + r.w && r.y < o.y + o.h && o.y < r.y + r.h
			);
			if (botst && voorrang(h) < 4) {
				h.label = '';
				continue;
			}
			geplaatst.push(r);
		}
		hullHitAreas = next.map((h) => {
			const w = labelWidth(h.label);
			return {
				id: h.id,
				polygon: h.polygon,
				label: new DOMRect(h.labelX - w / 2, h.labelY - LABEL_HEIGHT, w, LABEL_HEIGHT)
			};
		});
		hulls = next.map(({ polygon: _p, center: _c, members: _m, ...hull }) => hull);
		hullLinks = nextLinks;
	}

	const HEAT_SATURATION_RATE = 5;

	function updateViewportLabels() {
		const sizeDivisor = renderer
			? Math.min(Math.sqrt(renderer.getCamera().getState().ratio), 1.5)
			: 1;

		if (renderer && latestHeatActive && latestHeatMap.size > 0) {
			const halos: ActivityHalo[] = [];
			const months = Math.max(1, latestHeatPeriodMonths);
			graph.forEachNode((id, attrs) => {
				if (attrs.hidden || isHiddenNode(id, attrs)) return;
				const activity = latestHeatMap.get(id) ?? 0;
				if (activity <= 0) return;
				const rate = activity / months;
				const t = Math.min(rate / HEAT_SATURATION_RATE, 1);
				const baseR = ((attrs.size as number) ?? 5) / sizeDivisor;
				const ringPx = baseR + 4 + t * 16;
				const vp = renderer!.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				halos.push({ id, vx: vp.x, vy: vp.y, ringPx, color: heatColor(t) });
			});
			activityHalos = halos;
		} else if (activityHalos.length) {
			activityHalos = [];
		}

		if (renderer && latestMutatieActive && latestInFluxMap.size > 0) {
			const badges: MutatieBadge[] = [];
			graph.forEachNode((id, attrs) => {
				if (attrs.hidden || isHiddenNode(id, attrs)) return;
				const count = latestInFluxMap.get(id) ?? 0;
				if (count <= 0) return;
				const baseR = ((attrs.size as number) ?? 5) / sizeDivisor;
				const vp = renderer!.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				const kindAttr = attrs.kind as GraphNodeKind | undefined;
				const offset = baseR * (kindAttr ? badgeAxisOffset(kindAttr) : 0.707);
				badges.push({ id, vx: vp.x + offset, vy: vp.y - offset, count });
			});
			mutatieBadges = badges;
		} else if (mutatieBadges.length) {
			mutatieBadges = [];
		}

		const merken: NotitieMerk[] = [];
		if (renderer)
			for (const id of notitieIds) {
				if (!graph.hasNode(id)) continue;
				const attrs = graph.getNodeAttributes(id);
				if (attrs.hidden || isHiddenNode(id, attrs)) continue;
				const baseR = ((attrs.size as number) ?? 5) / sizeDivisor;
				const vp = renderer.graphToViewport({ x: attrs.x as number, y: attrs.y as number });
				const kindAttr = attrs.kind as GraphNodeKind | undefined;
				// Above the bron at its left, where the badge of a change (right) does not stand.
				const offset = baseR * (kindAttr ? badgeAxisOffset(kindAttr) : 0.707) + 2;
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
			if (graph.hasNode(id))
				graph.forEachEdge(id, (_e, a, src, tgt) => {
					if (!a.layoutOnly) ends.push(src === id ? tgt : src);
				});
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
			id !== focusedId && (metGroep.has(id) || hiddenByFilter(graph.getNodeAttributes(id)));
		graph.forEachNode((id, attrs) => {
			// A chosen bron of a netwerk is drawn whether or not anything ties it.
			if (id === focusedId || latestPinnedIds.has(id) || next.has(id) || hiddenByFilter(attrs))
				return;
			const groups = [...(nodeGroupIds.get(id) ?? [])].map((g) => latestContainerGroups.get(g));
			if (groups.some((g) => g && drawnGroup(g))) return;
			const shown = graph.someEdge(
				id,
				(_e, a, src, tgt) => !a.layoutOnly && !hiddenEnd(src === id ? tgt : src)
			);
			if (!shown) next.add(id);
		});
		// A container's anchor that only repeats its hull: the bronnen it ties are in it.
		const anchors: string[] = [];
		graph.forEachNode((id, attrs) => {
			if (attrs.anchor && id !== focusedId) anchors.push(id);
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
	}

	const outsideYears = (date: unknown) =>
		typeof date === 'string' &&
		yearPeriod !== null &&
		((yearPeriod.from !== null && date < yearPeriod.from) ||
			(yearPeriod.to !== null && date > yearPeriod.to));

	const otherCourt = (attrs: Record<string, unknown>) =>
		rechter !== null && attrs.collection === 'judgments' && attrs.rechter !== rechter;

	const hiddenByFilter = (attrs: Record<string, unknown>) =>
		latestHiddenKinds.has(attrs.bronKind as BronKind) ||
		outsideYears(attrs.date) ||
		otherCourt(attrs);

	const isHiddenNode = (id: string, attrs: Record<string, unknown>) =>
		id !== focusedId && (hiddenByFilter(attrs) || strays.has(id));

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
			// The nodes fill the canvas up to STAGE_PADDING px, which holds a hull's own
			// margin. Above, a hull's label pill needs LABEL_ROOM px more: the box grows
			// upward (graph y points up) by the share of the height those pixels take.
			const height = maxY - minY || 1;
			const dims = renderer.getDimensions();
			const usable = dims.height - 2 * STAGE_PADDING;
			let top = usable > LABEL_ROOM * 2 ? (height * LABEL_ROOM) / (usable - LABEL_ROOM) : 0;
			// A panel floating in a corner of the canvas takes room the nodes must leave:
			// the box grows right or up, whichever costs the drawing less of its size.
			const span = maxX - minX || 1;
			let right = 0;
			const panel = avoid;
			if (panel && panel.width > 0 && panel.height > 0) {
				const usableW = dims.width - 2 * STAGE_PADDING;
				const fromRight = dims.width - panel.x + EDGE_GAP;
				const fromTop = panel.y + panel.height + EDGE_GAP;
				const shareW = fromRight / usableW;
				const shareH = fromTop / usable;
				// A share at or below zero is a panel not over this canvas (measured before
				// the canvas had its width): it takes no room, and would shrink the box.
				if (shareW > 0 && shareW < shareH && shareW < 0.6) right = (span * shareW) / (1 - shareW);
				else if (shareH > 0 && shareH < 0.6)
					top = Math.max(top, ((height + top) * shareH) / (1 - shareH));
			}
			renderer.setCustomBBox({
				x: [minX, (maxX > minX ? maxX : minX + 1) + right],
				y: [minY, minY + height + top]
			});
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
		source: string
	): string {
		const relation = data.relation as Relation;
		const meta = (data.meta ?? {}) as Record<string, unknown>;
		// A signature says what it was signed as: "ondertekend als minister-president".
		const signedAs =
			relation === 'AUTHORED' &&
			typeof meta.function === 'string' &&
			meta.function &&
			meta.capacity !== 'kamerlid'
				? `ondertekend als ${meta.function}`
				: null;
		const parts = [signedAs ?? relationLabel(relation, sourceCollection)];
		const lid =
			(Array.isArray(meta.leden) && typeof meta.leden[0] === 'string' && meta.leden[0]) ||
			(typeof meta.lid === 'string' && meta.lid) ||
			null;
		if (lid) parts.push(`lid ${lid}`);
		if (typeof meta.paragraph_number === 'string' && meta.paragraph_number)
			parts.push(paragraphCite(source, meta.paragraph_number));
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

		const [
			{ default: Sigma },
			{ createEdgeArrowProgram },
			{ createNodeBorderProgram },
			{ NodeSquareProgram },
			{ createNodeImageProgram },
			{ stippelProgrammas }
		] = await Promise.all([
			import('sigma'),
			import('sigma/rendering'),
			import('@sigma/node-border'),
			import('@sigma/node-square'),
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
			const p = lijnLabelPlaats(source.x, source.y, target.x, target.y, w, h, room);
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

		const NodeBorderProgram = createNodeBorderProgram({
			borders: [
				{
					color: { attribute: 'selectionColor', defaultValue: 'rgba(0,0,0,0)' },
					size: { value: 2.5, mode: 'pixels' }
				},
				{
					color: { attribute: 'borderColor', defaultValue: t.ink },
					size: { value: 1.4, mode: 'pixels' }
				},
				{ color: { attribute: 'color', defaultValue: t.paper }, size: { fill: true } }
			]
		});

		const stippel = stippelProgrammas(pijlLengte());
		renderer = new Sigma(graph, wrap, {
			nodeProgramClasses: {
				border: NodeBorderProgram,
				square: NodeSquareProgram,
				image: NodeImageProgram
			},
			edgeProgramClasses: {
				arrow: metLijnLabel(
					createEdgeArrowProgram({
						lengthToThicknessRatio: pijlLengte(),
						widenessToThicknessRatio: pijlLengte() * PIJL_BREED
					}) as never
				),
				dashed: metLijnLabel(stippel.dashed as never),
				dotted: metLijnLabel(stippel.dotted as never)
			},
			defaultDrawEdgeLabel: tekenLijnLabel as never,
			// The thinnest a line gets, dimmed or zoomed out: its arrowhead stays 4.5 px long.
			minEdgeThickness: 1.4,
			defaultNodeType: 'border',
			defaultEdgeType: 'arrow',
			zIndex: true,

			// Labels in the text face; an edge label only on hover or selection.
			renderEdgeLabels: true,
			labelFont: t.fontSerif,
			labelSize: 13,
			labelWeight: '400',
			labelColor: { color: t.ink2 },
			edgeLabelColor: { color: t.ink },
			edgeLabelFont: t.fontSans,
			edgeLabelSize: 11.5,
			labelDensity: 1.4,
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
				const w = context.measureText(data.label).width;
				// Right of the bron, left, above or below it, where no other name stands; the
				// focus always ($lib label-place). A name with no free place waits for a hover.
				const room = context.canvas.width / (window.devicePixelRatio || 1);
				const focus = ((data as { zIndex?: number }).zIndex ?? 0) >= 2;
				const eigen = (data as { key?: string }).key === focusedId ? focusPlek : null;
				const at =
					eigen ??
					plaatsLabel(data.x, data.y, data.size, w + 4, size + 4, room, labelsTaken, focus);
				if (!at) return;
				if (!eigen) labelsTaken.push({ x: at.x, y: at.y, w: w + 4, h: size + 4 });
				labelsAt.set((data as { key?: string }).key ?? '', {
					x: at.x,
					y: at.y,
					w: w + 4,
					h: size + 4
				});
				const x = at.x + 2;
				const y = at.y + 2 + size / 2;
				context.save();
				context.globalAlpha = 1;
				context.fillStyle = t.paper;
				context.fillRect(x - 2, y - size / 2 - 2, w + 4, size + 4);
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
				const kaart = avoid ? { x: avoid.x, y: avoid.y, w: avoid.width, h: avoid.height } : null;
				const plek = labelsAt.get((data as { key?: string }).key ?? '') ?? {
					...hoverPlaats(data.x, data.y, data.size, w, h, room, kaart),
					w,
					h
				};
				context.save();
				context.shadowColor = 'rgba(0, 0, 0, 0.18)';
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

			nodeReducer: (id, data) => {
				if (isHiddenNode(id, data)) return { ...data, hidden: true };
				if (data.anchor) return { ...data, label: '', forceLabel: false };

				const f0 = latestFilters;
				// No single node to focus around when the selection is a container (a wet,
				// fractie, commissie or dossier draws no node of its own): its own children
				// count as in focus instead, so the rest of a busy view still dims.
				const dimStale =
					isContext(id) ||
					isTussen(id) ||
					(f0?.dimStaleContext !== false &&
						!latestPinnedIds.has(id) &&
						(focusedId !== null
							? id !== focusedId && !focusLevel1.has(id)
							: latestFocusMembers.size > 0 && !latestFocusMembers.has(id)));

				const inHover = hoveredId !== null;
				const inFocusGroup = !inHover || id === hoveredId || hoveredNeighbours.has(id);
				const gewezen = latestGewezen.get(id);
				if (gewezen && id !== focusedId) {
					const zelf = id === hoveredId;
					return {
						...data,
						hidden: false,
						label: zelf ? `${data.label as string}, tot ${korteDatum(gewezen)}` : '',
						forceLabel: zelf,
						color: t.paper2,
						borderColor: dimColor(0.38),
						image:
							data.type === 'image' ? spriteForVorm(data.vorm as Vorm, true, false) : data.image,
						selectionColor: 'rgba(0,0,0,0)'
					};
				}
				if (inHover && !inFocusGroup) {
					return {
						...data,
						hidden: false,
						label: '',
						color: t.paper2,
						borderColor: dimColor(0.55),
						selectionColor: 'rgba(0,0,0,0)'
					};
				}

				if (dimStale && !inHover) {
					return {
						...data,
						hidden: false,
						label: '',
						color: t.paper2,
						borderColor: dimColor(0.38),
						// A shape is a sprite, which the colours above do not reach: its outline instead.
						image:
							data.type === 'image' ? spriteForVorm(data.vorm as Vorm, true, false) : data.image,
						selectionColor: 'rgba(0,0,0,0)'
					};
				}

				// Labels only on hover, on the focus, on the chosen bronnen of a netwerk and on a
				// cluster bron, whose name ("250 uitspraken") is what it says.
				let label = '';
				let forceLabel = false;
				const chosen = latestPinnedIds.has(id);
				if ((inHover && inFocusGroup) || id === focusedId || chosen || data.cluster) {
					label = data.label as string;
					forceLabel = true;
				}

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
				const focusKind = data.kind as GraphNodeKind;
				const focusBoost = ((data.size as number) ?? 4) * 1.6;
				if (data.type !== 'image' && shapeFor(focusKind) === 'circle') {
					return {
						...data,
						hidden: false,
						label,
						forceLabel,
						selectionColor: t.focus,
						size: focusBoost,
						zIndex: 2
					};
				}
				return {
					...data,
					hidden: false,
					label,
					forceLabel,
					image: data.vorm
						? spriteForVorm(data.vorm as Vorm, !!data.stub, true)
						: spriteFor(focusKind, !!data.stub, true),
					size: focusBoost,
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
				if (latestFilters?.hiddenRelations.has(relation)) return { ...data, hidden: true };
				if (hullLinkOf(src, tgt) || anchorWithHull(src) || anchorWithHull(tgt))
					return { ...data, hidden: true };
				// A line to a wet whose articles are switched off goes with them.
				if (hiddenGroupKinds.has('instrument') && (lawAnchor(src) || lawAnchor(tgt)))
					return { ...data, hidden: true };

				const sourceKind = srcAttrs.kind as GraphNodeKind;
				const style = edgeStyleFor(relation, data.status as string | null);
				const renderColor = edgeColorFor(relation, sourceKind);
				const edgeType = style === 'solid' ? 'arrow' : style;
				const restSize = lijnDikte(Math.max(EDGE_WEIGHT[relation], style === 'dashed' ? 0.7 : 0));
				const sourceCollection = srcAttrs.collection as Collection;

				if (edge === latestSelectedEdge) {
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: t.focus,
						size: restSize * 2.4,
						label: edgeLabel(data, sourceCollection, src),
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
						label: edgeLabel(data, sourceCollection, src),
						forceLabel: true,
						zIndex: 3
					};
				}

				if (hoveredId !== null) {
					const incident = src === hoveredId || tgt === hoveredId;
					if (incident) {
						return {
							...data,
							hidden: false,
							type: edgeType,
							color: renderColor,
							size: restSize * 1.3,
							label: edgeLabel(data, sourceCollection, src),
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
				if (
					(isContext(src) || isContext(tgt) || isTussen(src) || isTussen(tgt)) &&
					src !== focusedId &&
					tgt !== focusedId
				) {
					return {
						...data,
						hidden: false,
						type: edgeType,
						// Through a bron between the chosen ones: fainter still, two hundred of them
						// are a haze otherwise.
						color: dimColor(isTussen(src) || isTussen(tgt) ? 0.12 : 0.2),
						size: restSize * 0.7,
						label: ''
					};
				}

				if (focusedId !== null) {
					// The focus's own verbindingen carry the view: in full when they are few,
					// as a fan in their own colour when there are hundreds, so the fan reads as
					// one shape and a single line still shows on hover.
					if (src === focusedId || tgt === focusedId) {
						return {
							...data,
							hidden: false,
							type: edgeType,
							color: towardPaper(renderColor, fanStrength(focusLevel1.size)),
							size: restSize,
							label: ''
						};
					}
					// A line between two other bronnen is context. Where it only repeats a hull
					// (inside one, or one of several from a judgment into the same law) it waits
					// for a hover; otherwise it is a trace in its own colour.
					if (repeatsHull(src, tgt)) return { ...data, hidden: true };
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: towardPaper(renderColor, 0.25),
						size: restSize * 0.7,
						label: ''
					};
				}

				// A hull already says these two belong together; the line between them
				// repeats that, so it steps back instead of adding to the clutter.
				if (inSameGroup(src, tgt)) {
					return {
						...data,
						hidden: false,
						type: edgeType,
						color: dimColor(0.3),
						size: restSize * 0.6,
						label: ''
					};
				}

				// Without a focus, several lines from one bron into one hull are one line; the
				// others show on a hover.
				if (bundledInto(edge, src, tgt)) return { ...data, hidden: true };

				// Without a focus, a member with a hundred stukken draws a hundred lines: the
				// fan pales by the size of its busier end, as the focus's own fan does.
				let degree = 1;
				try {
					degree = Math.max(graph.degree(src), graph.degree(tgt));
				} catch {
					/* node removed mid-render */
				}
				return {
					...data,
					hidden: false,
					type: edgeType,
					color: towardPaper(renderColor, fanStrength(degree)),
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
			labelsTaken = voorbehouden();
			labelsAt = new Map();
		});
		renderer.on('afterRender', updateViewportLabels);

		renderer.on('clickNode', ({ node }) => onNodeClick?.(node));
		renderer.on('doubleClickNode', ({ node, event }) => {
			event.preventSigmaDefault();
			onNodeDoubleClick?.(node);
		});
		renderer.on('clickEdge', ({ edge }) => onEdgeClick?.(edge));
		renderer.on('clickStage', () => onStageClick?.());
		renderer.on('enterNode', ({ node, event }) => {
			sigmaHoveredId = node;
			setHoveredId(node);
			onNodeHover?.(node, event.x, event.y);
		});
		renderer.on('leaveNode', () => {
			sigmaHoveredId = null;
			setHoveredId(externalHoveredId ?? null);
			onNodeLeave?.();
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

	/** How strong a line of a fan of `n` lines is drawn: in full up to nine, paler beyond. */
	const fanStrength = (n: number) => Math.min(1, Math.max(0.35, 3 / Math.sqrt(n || 1)));

	let focusLevel1 = new Set<string>();
	function recomputeFocusLevel1() {
		focusLevel1 = new Set();
		if (!focusedId || !graph.hasNode(focusedId)) return;
		try {
			graph.forEachNeighbor(focusedId, (n) => focusLevel1.add(n));
		} catch {
			/* node removed mid-render */
		}
	}
	$effect(() => {
		void focusedId;
		recomputeFocusLevel1();
		renderer?.refresh();
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
					fill={withAlpha(h.color, 0.08)}
					stroke={h.color}
					stroke-dasharray={h.dash}
				/>
			{/each}
			{#each hullLinks as l (l.id)}
				<g class="hull-link" class:is-dim={l.dim}>
					<path
						d={l.d}
						stroke={l.color}
						stroke-dasharray={l.dashed ? '3 3' : undefined}
						fill="none"
					/>
					<path d={l.arrow} fill={l.color} />
				</g>
			{/each}
		</svg>
		<div class="hull-label-overlay" aria-hidden="true">
			{#each hulls.filter((h) => h.label) as h (h.id)}
				<span
					class="hull-label"
					class:is-dim={h.dim}
					class:is-long={h.long}
					style="left:{h.labelX}px; top:{h.labelY}px; --hull-color:{h.color}">{h.label}</span
				>
			{/each}
			{#each hullLinks as l (l.id)}
				{#if l.label}
					<span
						class="hull-link-label"
						style="left:{l.labelX}px; top:{l.labelY}px; --link-color:{l.color}">{l.label}</span
					>
				{/if}
			{/each}
		</div>
	{/if}
	{#if activityHalos.length > 0}
		<div class="activity-overlay" aria-hidden="true">
			{#each activityHalos as h (h.id)}
				<span
					class="activity-ring"
					style="left:{h.vx}px; top:{h.vy}px; width:{h.ringPx * 2}px; height:{h.ringPx *
						2}px; border-color:{h.color}"
				></span>
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
	{#if mutatieBadges.length > 0}
		<div class="mutatie-overlay" aria-hidden="true">
			{#each mutatieBadges as b (b.id)}
				<span class="mutatie-badge" style="left:{b.vx}px; top:{b.vy}px"
					>{b.count > 1 ? b.count : ''}</span
				>
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
		stroke-width: 1.5;
		transition: opacity var(--dur-1) var(--ease);
	}
	/* A line between hulls: thin and fine-dashed, so it reads as a relation, not a road. */
	.hull-link path:first-child {
		stroke-width: 1.2;
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
		transform: translate(-50%, -50%);
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
	.hull-label {
		position: absolute;
		transform: translate(-50%, -100%);
		padding: 2px var(--s-2);
		border-radius: var(--r-rond);
		background: color-mix(in srgb, var(--paper) 88%, var(--hull-color) 12%);
		border: 1px solid var(--hull-color);
		font-family: var(--font-serif);
		font-size: var(--t-label);
		font-weight: 600;
		/* The name in ink: the lighter groups (Dossier, 3.1:1) are too faint for text. */
		color: var(--ink-2);
		white-space: nowrap;
		/* A dossier's title in full can be wider than the canvas: it wraps (.is-long). */
		max-width: calc(100% - 20px);
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.hull-label.is-long {
		width: max-content;
		white-space: normal;
		border-radius: var(--r-1);
		line-height: var(--lh-snug);
	}

	.activity-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		z-index: 5;
	}
	.activity-ring {
		position: absolute;
		transform: translate(-50%, -50%);
		border-radius: 50%;
		border: 2px solid;
		background: transparent;
	}

	/* A badge on a bron with an open dossier: the count when more than one. */
	.mutatie-overlay {
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
	.mutatie-badge {
		position: absolute;
		transform: translate(-50%, -50%);
		min-width: 14px;
		height: 14px;
		padding: 0 3px;
		border-radius: var(--r-rond);
		background: var(--ink);
		color: var(--paper);
		border: 1.5px solid var(--paper);
		box-shadow: 0 0 0 1px var(--ink);
		font-family: var(--font-serif);
		font-size: var(--t-glyph);
		font-weight: 600;
		line-height: 11px;
		text-align: center;
		display: inline-flex;
		align-items: center;
		justify-content: center;
	}
</style>

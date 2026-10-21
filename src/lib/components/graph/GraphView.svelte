<script lang="ts">
	import { clickOutside } from '$lib/actions/top-layer';
	import { report } from '$lib/api/errors';
	import { naFilter, zichtSleutel } from '$lib/graph/zicht';
	import { vandaag } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import type { NeighborhoodReach } from '$lib/graph/store/types';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { hasModifier, isEscape, isTyping } from '$lib/actions/keys';
	import { get } from 'svelte/store';
	import Graph from 'graphology';
	import type FA2LayoutType from 'graphology-layout-forceatlas2/worker';
	import GraphCanvas from './GraphCanvas.svelte';
	import type { GraphCanvasApi } from './GraphCanvas.svelte';
	import CanvasHoverCard from './CanvasHoverCard.svelte';
	import CanvasKaart from './CanvasKaart.svelte';
	import CanvasNodeList from './CanvasNodeList.svelte';
	import { readingOrder } from './canvas-keys';
	import { countCanvas, NO_COUNTS, sameIds, type CanvasCounts } from './canvas-count';
	import GraphSidebar from './GraphSidebar.svelte';
	import type { ComponentProps, Snippet } from 'svelte';
	import type { GraphStore, GraphFilters } from '$lib/graph/store/types';
	import type { GraphEdge, GraphNode, DrawClass } from '$lib/graph/types';
	import { isVersionCollection, drawClassOf, kort } from '$lib/graph/types';
	import { isDrawn } from '$lib/graph/collection-role';
	import {
		clusterLabel,
		clustersOf,
		tussenClustersOf,
		clusterZinnen,
		isClusterId,
		type Cluster
	} from '$lib/selection/cluster';
	import { openGroup } from '$lib/verbonden/open-group';
	import { bronPlural } from '$lib/vocabulary';
	import { spriteForVorm, IMAGE_SIZE_BUMP } from './nodeSprites';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronNaam } from '$lib/bron/naam';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import { VORM_LABEL, VORM_VOLGORDE, vormVanBron } from '$lib/bron/vormen';
	import {
		containerIdFor,
		isDrawnGroup,
		momentOf,
		type Period,
		isContainerKind,
		type ContainerGroup,
		type ContainerKind
	} from '$lib/graph/container-membership';
	import { metGroepVerborgen } from '$lib/graph/met-groep';
	import { kolomPlekken } from '$lib/selection/kolommen';
	import { packGroups, placeClusters, ringAround, syncGroupLinks } from '$lib/graph/layout';
	import type { NodeCounts } from '$lib/api/overlays';
	import type { Overlay } from '$lib/selection/overlay';
	import { DEFAULT_HEAT_MONTHS } from '$lib/selection/overlay';
	import type { Relation } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		filterGroupOf,
		rechterOf,
		type FilterGroup,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { laatstOpen, opzij, type Zwevend } from '$lib/stores/zwevend';
	import {
		cardBeside,
		CLUSTER_CARD,
		clusterCardAt,
		foldStep,
		legendPlace,
		placeCard
	} from '$lib/selection/card-place';
	import { FOLD, isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import { netwerkMelding } from '$lib/stores/netwerk-melding';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import { gemerkt, notesOfBundels } from '$lib/map/notities';
	import { keepsCamera, saveCamera, savedCamera } from './camera';

	/** What the legend (GraphSidebar) asks of the page, handed through as one. */
	type LegendProps = Pick<
		ComponentProps<typeof GraphSidebar>,
		| 'onFilter'
		| 'onOpenFilter'
		| 'depth'
		| 'onDepth'
		| 'onAllesLaden'
		| 'onLaadSoort'
		| 'laadtSoort'
		| 'allesGrens'
		| 'onToggleHeat'
		| 'onHeatPeriodChange'
		| 'onToggleMutatie'
	>;

	let {
		store,
		compact = false,
		filter,
		verbonden,
		reach = null,
		selectedEdgeId = null,
		lineLids = new Map() as ReadonlyMap<string, string>,
		inFluxMap = new Map() as NodeCounts,
		heatMap = new Map() as NodeCounts,
		overlay = { kind: 'none' } as Overlay,
		onNodeClick,
		onNodeDoubleClick,
		onMetGroep,
		onToggleChosen,
		netwerkActive = false,
		onEdgeClick,
		onClear,
		onBack,
		onGoForward,
		canvasOverlay,
		...legend
	}: {
		store: GraphStore;
		compact?: boolean;
		filter: VerbondenFilter;
		verbonden: VerbondenState;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		selectedEdgeId?: string | null;
		/** The lid a line names, by its edge (`edgeKey`), where its row or card knows it. */
		lineLids?: ReadonlyMap<string, string>;
		inFluxMap?: NodeCounts;
		heatMap?: NodeCounts;
		overlay?: Overlay;
		onNodeClick?: (node: GraphNode) => void;
		/** Replaces the canvas with the bron's own neighbourhood; a click only selects. */
		onNodeDoubleClick?: (node: GraphNode) => void;
		/** The bronnen hidden with a grouping that is off, by canvas id: their chips grey. */
		onMetGroep?: (verborgen: ReadonlyMap<string, ContainerKind>) => void;
		/** Adds a bron to the netwerk, or takes it out. */
		onToggleChosen?: (node: GraphNode) => void;
		netwerkActive?: boolean;
		onEdgeClick?: (edge: GraphEdge) => void;
		/** A click on the stage or Escape: the card Verbinding closes; the selection stays. */
		onClear?: () => void;
		onBack?: () => void;
		onGoForward?: () => void;
		canvasOverlay?: Snippet;
	} & LegendProps = $props();

	// ── graphology (data + layout, no sigma) ─────────────────────────────────
	const g = new Graph();
	const lookup = new Map<string, GraphNode>();
	let canvas: GraphCanvasApi | null = null;

	let selection = $state<GraphNode | null>(null);
	let pinnedIds = $state<Set<string>>(new Set());
	let coreIds = $state<ReadonlySet<string> | null>(null);
	let filters = $state<GraphFilters>(get(store.filters));
	let hasNodes = $state(false);
	let canvasCounts = $state<CanvasCounts>(NO_COUNTS);
	let containerGroups = $state<Map<string, ContainerGroup>>(new Map());
	// When the selection is a container, there is no canvas node to focus around: its
	// own children take that role in the dim/highlight pass instead (GraphCanvas).
	const focusContainerId = $derived(
		selection && isContainerKind(selection.drawClass) && selection.raw
			? containerIdFor(selection.raw)
			: null
	);
	const focusNodeId = $derived(
		selection && !isContainerKind(selection.drawClass) ? selection.id : null
	);
	// The time a lid's commissies and fracties are drawn for: the years of the bronfilter,
	// else the lid's own moment (today, or the end of their last seat).
	// The years of the bronfilter as dates; the canvas hides a dated bron outside them.
	const yearPeriod = $derived<Period | null>(
		filter.van !== null || filter.tot !== null
			? {
					from: filter.van,
					to: filter.tot
				}
			: null
	);
	const groupPeriod = $derived<Period | null>(
		yearPeriod ?? momentOf(focusNodeId, containerGroups.values(), vandaag())
	);

	const hiddenKinds = $derived<ReadonlySet<FilterGroup>>(
		filter.bronnen ? new Set(FILTER_GROUPS.filter((k) => !filter.bronnen!.has(k))) : new Set()
	);

	// The floating legend: closed until opened, kept per browser (FOLD.legend), and folded
	// while the canvas has no room for it beside the panel Netwerk (opzij, zwevend.ts).
	const legendaOpen = $derived(isOpen(FOLD.legend, false) && $opzij !== 'legenda');
	const zetLegenda = (v: boolean) => {
		if (v && get(opzij) === 'legenda') opzij.set(null);
		if (v) laatstOpen.set('legenda');
		zetOpen(FOLD.legend, v);
	};

	// What the canvas draws, as it says it (GraphCanvas `onDrawn`), counted for the Legenda,
	// the sidebar and the keyboard's list.
	let drawn: ReadonlySet<string> = new Set();
	function telCanvas() {
		const verborgen = metGroepVerborgen({
			groups: containerGroups.values(),
			uit: filters.hiddenGroups,
			houd: (id) => id === selection?.id
		});
		onMetGroep?.(verborgen);
		const geteld = countCanvas({
			graph: g,
			drawn,
			selectionId: selection?.id ?? null,
			hiddenKinds,
			rechter: filter.rechter,
			verborgen,
			hiddenRelations: filters.hiddenRelations
		});
		canvasCounts = geteld.counts;
		// The keyboard's list sorts what is drawn: only a change sorts it again.
		if (
			!sameIds(
				untrack(() => drawnIds),
				geteld.drawnIds
			)
		)
			drawnIds = geteld.drawnIds;
	}

	$effect(() => {
		void hiddenKinds;
		void filters;
		telCanvas();
		canvas?.refresh();
	});

	// A filter that changes what is drawn frames what is left, as ⤢ does (zicht.ts).
	let vorigeZicht: string | null = null;
	$effect(() => {
		const nu = zichtSleutel({
			verborgen: hiddenKinds,
			rechter: filter.rechter,
			van: filter.van,
			tot: filter.tot
		});
		const passen = naFilter(vorigeZicht, nu);
		vorigeZicht = nu;
		// After the refresh above has hidden what the filter leaves out.
		if (passen && !untrack(() => fitSuppressed)) afterTick(() => canvas?.fit());
	});

	// ── camera ────────────────────────────────────────────────────────────────
	let fitScheduled = false;
	let skipNextFit = false;
	let fitSuppressed = false;
	// After `fitWhenSettled` the fit follows every burst that comes after it (the layers of
	// a new focus settle in several), which would otherwise keep the first viewport, until
	// the pointer is on the canvas: the camera never moves under the reader's hand.
	let fitFollows = false;
	function scheduleFit() {
		if (fitSuppressed || (skipNextFit && !fitFollows)) return;
		if (fitScheduled) return;
		fitScheduled = true;
		// The next frame, or a moment later where no frame comes (a hidden or background tab):
		// a frame that never came kept fitScheduled set, and no fit followed again (UX-toets
		// e7a2f95, #37: after kabinet → uitspraak 5 of 9 hull labels outside the canvas).
		let gedaan = false;
		const pas = () => {
			if (gedaan) return;
			gedaan = true;
			fitScheduled = false;
			canvas?.fit();
		};
		requestAnimationFrame(pas);
		setTimeout(pas, 150);
	}

	/** Tell the view to swallow scheduleFit calls until `fitWhenSettled` runs. */
	export function suppressFit() {
		fitSuppressed = true;
	}

	/** Re-centre the layout on `focalId` after an update that kept old positions. */
	export function reseatAround(focalId: string) {
		if (!g.hasNode(focalId)) return;
		const movable = ringAround(g, focalId, get(store.pinned));
		runLayout(movable).catch((e) => report('Netwerk opmaak', e));
	}

	// A new focus from outside the canvas (a link in a reader, Back) frames the network as
	// a first load does; one chosen on the canvas keeps the view under the hand (UX test 10
	// Oct, #25: from a kabinet to HR 2019:2006 the netwerk kept the kabinet's camera).
	let handOpCanvas = false;
	export function inBeeld() {
		if (!handOpCanvas) fitWhenSettled();
	}

	/** Lift the suppression and fit once the layout has stopped. */
	export function fitWhenSettled() {
		// An explicit request: it overrides the viewport an additive sync kept.
		fitSuppressed = false;
		skipNextFit = false;
		fitFollows = true;
		const FIT_MAX_WAIT_MS = 6000;
		const POLL_MS = 100;
		setTimeout(() => {
			const start = Date.now();
			const tick = () => {
				const running = !!layout && layout.isRunning();
				const elapsed = Date.now() - start;
				if (!running || elapsed >= FIT_MAX_WAIT_MS) {
					scheduleFit();
					return;
				}
				setTimeout(tick, POLL_MS);
			};
			tick();
		}, 50);
	}

	// The reader's notes in every bundel, per bron: in its card, and a mark on
	// the bronnen that hold one of their own. From this browser, so no request.
	const notities = $derived(notesOfBundels(kaart.mappen));
	const notitieIds = $derived(gemerkt(notities));

	// Hover panel state (only in the full canvas)
	let hoverNode = $state<GraphNode | null>(null);
	let hoverAt = $state<{ x: number; y: number } | null>(null);
	// The bronnen drawn on the canvas, for the keyboard's list of them, and the one in its focus.
	let drawnIds = $state<string[]>([]);
	let keyNode = $state<GraphNode | null>(null);
	const listNodes = $derived(
		readingOrder(
			drawnIds.flatMap((id) => lookup.get(id) ?? []),
			selection?.id ?? null
		)
	);
	function onKeyNode(n: GraphNode | null) {
		if (n && stilNa === n.id) {
			// Back from its card with Escape: the bron has the focus, its card stays closed.
			stilNa = null;
			keyNode = n;
			return;
		}
		stilNa = null;
		keyNode = n;
		hoverAt = null;
		hoverNode = n;
	}
	// The card of the bron in the keyboard's list: Tab goes into it, Escape and Shift+Tab back
	// to that bron, Tab past its last action on to the canvas (UX test 10 Oct, #14).
	let citeEl = $state<HTMLElement | null>(null);
	let keyOpener: HTMLElement | null = null;
	let stilNa: string | null = null;
	function kaartIn(opener: HTMLElement) {
		const eerste = citeEl?.querySelector<HTMLElement>('a[href], button');
		const kaart = citeEl;
		if (!keyNode || !kaart || !eerste) return false;
		keyOpener = opener;
		// Focus that leaves card and list elsewhere (a click on the page) closes the card.
		const weg = (e: FocusEvent) => {
			const naar = e.relatedTarget as Node | null;
			// Nowhere: a tap on an iPhone, whose click is still to come; the canvas: a press on
			// it, whose click closes the card itself (see below, #38).
			if (!naar || kaart.contains(naar) || naar === canvasWrap) return;
			kaart.removeEventListener('focusout', weg);
			if (naar && opener.closest('ul')?.contains(naar)) return;
			if (keyNode) {
				keyNode = null;
				hoverNode = null;
			}
		};
		kaart.addEventListener('focusout', weg);
		eerste.focus();
		return true;
	}
	// A click or tap outside the card and the list of bronnen closes the card of the keyboard's
	// bron, as a menu does.
	$effect(() => {
		if (!keyNode) return;
		return clickOutside(
			() => [citeEl, canvasWrap?.parentElement?.querySelector('.canvas-node-list')],
			() => {
				keyNode = null;
				hoverNode = null;
			}
		);
	});
	/** Escape on the bron in the list: its card closes, the focus stays (UX-toets B6). */
	function closeCard() {
		if (!keyNode || !hoverNode) return false;
		stilNa = keyNode.id;
		hoverNode = null;
		return true;
	}
	function kaartUit(focus: 'lijst' | 'canvas', sluit = false) {
		if (sluit) stilNa = keyNode?.id ?? null;
		if (focus === 'canvas') {
			keyNode = null;
			hoverNode = null;
			canvasWrap?.focus({ preventScroll: true });
		} else {
			if (sluit) hoverNode = null;
			keyOpener?.focus();
		}
	}

	// One click marks a bron: it lights up with its own lines, its card beside it. The reader
	// opens with "Tekst lezen", a second click on it or Enter; the network keeps its size
	// (Thijs, 9 Oct; before, one click opened the reader).
	let gemarkeerd = $state<GraphNode | null>(null);
	function markeer(n: GraphNode) {
		if (gemarkeerd?.id === n.id) return open(n);
		if (showTimer) clearTimeout(showTimer);
		if (hideTimer) clearTimeout(hideTimer);
		showTimer = hideTimer = null;
		gemarkeerd = n;
		keyNode = null;
		// Beside the bron; in a narrow network (beside the reader) or after a tap, at its foot.
		hoverAt = compact ? null : kaartPlek(lastPointer);
		hoverNode = n;
	}
	function ontmarkeer() {
		gemarkeerd = null;
		hoverNode = null;
	}
	function open(n: GraphNode) {
		ontmarkeer();
		onNodeClick?.(n);
	}
	// A bron that left the canvas is no longer marked.
	$effect(() => {
		if (gemarkeerd && !drawnIds.includes(gemarkeerd.id)) ontmarkeer();
	});
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let showTimer: ReturnType<typeof setTimeout> | null = null;

	/** Every node is drawn by sigma's image program: its sprite on a background of this. */
	const TRANSPARENT = 'rgba(0,0,0,0)';

	// Elk teken even groot; de vorm zegt wat een bron is, niet de maat. Een groep
	// (dossier, fractie, commissie) een stap groter.
	/** A cluster bron stands for forty or more: a step larger than a group. */
	const CLUSTER_SIZE = 12;
	const NODE_SIZE: Record<DrawClass, number> = {
		article: 8,
		instrument: 8,
		judgment: 8,
		dossier: 10,
		committee: 10,
		faction: 10,
		member: 8,
		document: 8,
		activity: 8,
		other: 8
	};
	function nodeSize(id: string): number {
		const n = lookup.get(id);
		if (!n) return 4;
		const seeded = (n as GraphNode & { size?: number }).size;
		if (typeof seeded === 'number') return seeded;
		return NODE_SIZE[n.drawClass];
	}

	function applyFilters() {
		telCanvas();
		canvas?.refresh();
	}

	$effect(() => {
		void $instrumentMetaStore;
		if (g.order === 0) return;
		g.forEachNode((id) => {
			const n = lookup.get(id);
			if (n) g.setNodeAttribute(id, 'label', nodeLabel(n));
		});
		canvas?.refresh();
	});

	let layout: FA2LayoutType | null = null;
	let layoutStopTimer: ReturnType<typeof setTimeout> | null = null;
	let layoutPromise: Promise<void> | null = null;

	async function ensureLayout() {
		if (layout) return;
		if (!layoutPromise) {
			layoutPromise = (async () => {
				const { default: FA2Layout } = await import('graphology-layout-forceatlas2/worker');
				layout = new FA2Layout(g, {
					settings: {
						gravity: 0.25,
						scalingRatio: 30,
						strongGravityMode: false,
						slowDown: 8,
						adjustSizes: true,
						barnesHutOptimize: false,
						barnesHutTheta: 0.5
					}
				});
			})();
		}
		await layoutPromise;
	}

	async function runLayout(addedThisSync?: Set<string>) {
		if (g.order < 2) return;
		const pinExisting = !!addedThisSync && addedThisSync.size > 0;
		const pinnedDuringBurst: string[] = [];
		if (pinExisting) {
			g.forEachNode((id) => {
				if (addedThisSync!.has(id)) return;
				if (!g.getNodeAttribute(id, 'fixed')) {
					g.setNodeAttribute(id, 'fixed', true);
					pinnedDuringBurst.push(id);
				}
			});
		}
		await ensureLayout();
		const unpin = () => {
			for (const id of pinnedDuringBurst) if (g.hasNode(id)) g.removeNodeAttribute(id, 'fixed');
		};
		if (!layout) return unpin();
		if (!layout.isRunning()) layout.start();
		if (layoutStopTimer) clearTimeout(layoutStopTimer);
		const burst = pinExisting
			? Math.min(800, 350 + (addedThisSync?.size ?? 0) * 18)
			: Math.min(2500, 600 + g.order * 6);
		layoutStopTimer = setTimeout(() => {
			layout?.stop();
			unpin();
			separateContainerGroups();
			placeClusterNodes();
			scheduleFit();
		}, burst);
	}

	// Node label: the name of the bron (bron/naam.ts), short enough for the canvas; a
	// Kamerstuk by its kind and number (`stukLabel`). The full name is in the panel and the card.
	const nodeLabel = (n: GraphNode) =>
		isClusterId(n.id) || n.drawClass === 'document'
			? n.label
			: kort(bronNaam(n, $instrumentMetaStore));

	// A container (a wet, fractie, commissie or dossier) is never a canvas node: its
	// children carry it as a hull instead (`syncContainerAnchors`, GraphCanvas). Nor
	// is a version, current-focus reader page or not: the network is about the
	// current text, and the reader reads a version's own data directly, not this
	// canvas.
	const isCanvasNode = (n: GraphNode) =>
		(n.anchor || !isContainerKind(n.drawClass)) && !isVersionCollection(n.collection);

	// ── clusters ────────────────────────────────────────────────────────────────
	// What the store holds goes to the canvas through the clusters ($lib/selection/cluster):
	// past forty loose bronnen of one kind around the focus, one cluster bron stands for
	// them. Shown in full (`expanded`) until the reader folds them again or the focus moves.
	let rawNodes: GraphNode[] = [];
	let rawEdges: GraphEdge[] = [];
	let clusters = $state<Cluster[]>([]);
	const clusterById = new Map<string, Cluster>();
	let expanded = $state<ReadonlySet<string>>(new Set());
	/** Kinds shown in full that would fold: their count, for the button that folds them. */
	let foldable = $state<Cluster[]>([]);
	let clusteredFor: string | null = null;
	let clusterCard = $state<{ cluster: Cluster; x: number; y: number } | null>(null);
	let lastPointer: { x: number; y: number } | null = null;

	let rawChanged = false;
	let drawnClusters = '';
	// The store gives nodes and then edges for one change: they are drawn once, together,
	// in a microtask, before anyone awaiting that change goes on. Drawn separately, the
	// Awb's 456 bronnen were laid out twice for every response (1.1 s, then 0.6 s).
	let redrawQueued = false;
	const queueRedraw = () => {
		if (redrawQueued) return;
		redrawQueued = true;
		queueMicrotask(() => {
			redrawQueued = false;
			redraw();
		});
	};
	const syncNodes = (nodes: GraphNode[]) => {
		rawNodes = nodes;
		rawChanged = true;
		queueRedraw();
	};
	const syncEdges = (edges: GraphEdge[]) => {
		rawEdges = edges;
		rawChanged = true;
		queueRedraw();
	};

	/** Draw what the store holds, through the clusters; only when that or they changed. */
	function redraw() {
		// A fractie, commissie or dossier as focus clusters too: its anchor is the point its
		// neighbours tie to ("332 dossiers" beside VVD); its own members stay in its hull.
		const focus = selection?.id ?? null;
		if (focus !== clusteredFor) {
			clusteredFor = focus;
			expanded = new Set();
			clusterCard = null;
		}
		const keep = new Set<string>([...pinnedIds, ...(coreIds ?? [])]);
		for (const group of containerGroups.values()) for (const id of group.members) keep.add(id);
		const canvasNodes = rawNodes.filter(isCanvasNode);
		const edges = rawEdges.filter((e) => isDrawn(e.relation));
		// Between the chosen bronnen of a netwerk: what ties the same ones, as one.
		const chosen = new Set<string>(pinnedIds);
		if (focus) chosen.add(focus);
		const inHull = new Set<string>();
		for (const group of containerGroups.values()) for (const id of group.members) inHull.add(id);
		const alle = (open: ReadonlySet<string>) => [
			...clustersOf(canvasNodes, edges, focus, keep, open),
			...(pinnedIds.size > 0 ? tussenClustersOf(canvasNodes, edges, chosen, inHull, open) : [])
		];
		clusters = alle(expanded);
		foldable = expanded.size > 0 ? alle(new Set()).filter((c) => expanded.has(c.id)) : [];
		const signature = clusters.map((c) => `${c.id}:${c.members.length}`).join(',');
		if (!rawChanged && signature === drawnClusters) {
			applyFilters();
			return;
		}
		rawChanged = false;
		drawnClusters = signature;
		clusterById.clear();
		const folded = new Set<string>();
		for (const c of clusters) {
			clusterById.set(c.id, c);
			for (const id of c.members) folded.add(id);
		}
		drawNodes([
			...rawNodes.filter((n) => !folded.has(n.id)),
			...clusters.map((c) => clusterNode(c))
		]);
		drawEdges([
			...rawEdges.filter((e) => !folded.has(e.source) && !folded.has(e.target)),
			...clusters.flatMap((c) =>
				c.ends
					? c.ends.map((end) =>
							clusterEdge({ ...c, relation: end.relation, toFocus: end.toEnd }, end.id)
						)
					: focus
						? [clusterEdge(c, focus)]
						: []
			)
		]);
		// Counted and drawn once, nodes and edges together.
		applyFilters();
	}

	const clusterNode = (c: Cluster): GraphNode =>
		({
			id: c.id,
			collection: c.collection,
			key: c.id,
			drawClass: drawClassOf(c.collection),
			label: clusterLabel(c),
			size: CLUSTER_SIZE
		}) as GraphNode;

	const clusterEdge = (c: Cluster, focus: string): GraphEdge => ({
		id: `${c.id}~${focus}`,
		source: c.toFocus ? c.id : focus,
		target: c.toFocus ? focus : c.id,
		relation: c.relation as Relation,
		label: '',
		directed: true
	});

	function showCluster(c: Cluster) {
		expanded = new Set([...expanded, c.id]);
		clusterCard = null;
		redraw();
	}

	function foldCluster(c: Cluster) {
		const next = new Set(expanded);
		next.delete(c.id);
		expanded = next;
		redraw();
	}

	/**
	 * One click on a cluster: its card beside it, as a row opens in place. Opened from the
	 * list of the network (Enter), the focus goes into the card and comes back on Escape.
	 */
	let clusterOpener: HTMLElement | null = null;
	function openCluster(id: string, opener: HTMLElement | null = null) {
		const c = clusterById.get(id);
		if (!c) return;
		clusterOpener = opener;
		if (opener)
			afterTick(() =>
				canvasWrap?.parentElement?.querySelector<HTMLElement>('.cluster-kaart button')?.focus()
			);
		const at = lastPointer ?? { x: CLUSTER_CARD.gap, y: CLUSTER_CARD.gap };
		clusterCard = {
			cluster: c,
			...clusterCardAt(at, canvasWrap?.clientWidth ?? CLUSTER_CARD.w)
		};
		// Measured once drawn, before it is painted: the card moves off the panels it covers.
		afterTick(() => {
			const card = canvasWrap?.querySelector<HTMLElement>('.cluster-kaart');
			if (!canvasWrap || !card || !clusterCard) return;
			const origin = canvasWrap.getBoundingClientRect();
			const boxOf = (el: Element) => {
				const r = el.getBoundingClientRect();
				return { x: r.left - origin.left, y: r.top - origin.top, w: r.width, h: r.height };
			};
			const obstacles = [...(buhne ?? canvasWrap).querySelectorAll(FLOATING)]
				.map(boxOf)
				.filter((b) => b.w > 0 && b.h > 0);
			const place = placeCard(
				at,
				{ w: card.offsetWidth, h: card.offsetHeight },
				{ width: canvasWrap.clientWidth, height: canvasWrap.clientHeight },
				obstacles
			);
			clusterCard = { ...clusterCard, ...place };
		});
	}
	/** The group in Verbonden that lists the cluster's kind, as "Bekijk in Verbonden" opens it. */
	const groupOf = (c: Cluster) => {
		const count = (g: (typeof verbonden.groups)[number]) =>
			g.rows.filter((row) => row.ref.collection === c.collection).length;
		const best = [...verbonden.groups].sort((a, b) => count(b) - count(a))[0];
		return best && count(best) > 0 ? best : null;
	};
	/** What floats over the canvas and stays readable: the panel Netwerk, zoom, legenda. */
	const FLOATING = '.canvas-overlay > *, .zoom, .legenda, .vouw';

	function closeClusterCard(e: PointerEvent) {
		if (clusterCard && !(e.target as HTMLElement | null)?.closest?.('.cluster-kaart'))
			clusterCard = null;
	}

	function drawNodes(nodes: GraphNode[]) {
		const newIds = new Set(nodes.map((n) => n.id));
		skipNextFit = keepsCamera(compact ? 'compact' : 'full', newIds);

		let changed = false;
		const addedThisSync = new Set<string>();
		const keep = newIds;
		const toDrop = g.nodes().filter((id) => !keep.has(id));

		const wholesaleReplace =
			toDrop.length > 0 && toDrop.length === g.order && [...keep].every((id) => !g.hasNode(id));
		if (wholesaleReplace && toDrop.length > 50) {
			layout?.stop();
			layout?.kill();
			layout = null;
			layoutPromise = null;
			toDrop.forEach((id) => lookup.delete(id));
			g.clear();
			changed = true;
		} else {
			toDrop.forEach((id) => {
				g.dropNode(id);
				lookup.delete(id);
				changed = true;
			});
		}
		let unseededCount = 0;
		for (const n of nodes) {
			if (!isCanvasNode(n) || g.hasNode(n.id)) continue;
			const seed = n as GraphNode & { x?: number; y?: number };
			if (typeof seed.x !== 'number' || typeof seed.y !== 'number') unseededCount++;
		}
		const focalIdForSeed = selection && g.hasNode(selection.id) ? selection.id : null;
		const fxSeed = focalIdForSeed ? ((g.getNodeAttribute(focalIdForSeed, 'x') as number) ?? 0) : 0;
		const fySeed = focalIdForSeed ? ((g.getNodeAttribute(focalIdForSeed, 'y') as number) ?? 0) : 0;
		const seedRingR = Math.max(18, 8 + Math.sqrt(Math.max(unseededCount, 1)) * 7);
		let seededIdx = 0;
		// A netwerk starts in the homepage's columns: parliament, the law, the judgments.
		const kolommen =
			pinnedIds.size > 0
				? kolomPlekken(
						nodes.filter((n) => {
							const seed = n as GraphNode & { x?: number };
							return isCanvasNode(n) && !g.hasNode(n.id) && typeof seed.x !== 'number';
						}),
						fxSeed,
						fySeed,
						seedRingR * 1.5,
						seedRingR * 2
					)
				: null;

		for (const n of nodes) {
			lookup.set(n.id, n);
			if (!isCanvasNode(n)) continue;
			// Elke bron als teken uit vormen.ts, op een doorzichtige ondergrond.
			const vorm = vormVanBron(n.collection, n.raw?.props, n.key);
			const attrs: Record<string, unknown> = {
				label: nodeLabel(n),
				cluster: isClusterId(n.id),
				forceLabel: isClusterId(n.id),
				color: TRANSPARENT,
				drawClass: n.drawClass,
				vorm,
				collection: n.collection,
				filterGroup: filterGroupOf(n.collection, n.key, n.raw?.props ?? null),
				// The court of a judgment, as the bronfilter's rechter reads it.
				rechter:
					n.collection === 'judgments'
						? rechterOf({
								identifier: typeof n.raw?.props?.ecli === 'string' ? n.raw.props.ecli : null,
								props: n.raw?.props ?? undefined,
								ref: { collection: 'judgments', key: n.key }
							})
						: null,
				stub: !!n.stub,
				date: typeof n.raw?.props?.date === 'string' ? n.raw.props.date.slice(0, 10) : null,
				size: nodeSize(n.id) * IMAGE_SIZE_BUMP,
				image: spriteForVorm(vorm, !!n.stub, false)
			};
			// A wet's anchor is a point its hull and the lines of a change end at: no sprite.
			if (n.anchor)
				Object.assign(attrs, {
					anchor: true,
					image: undefined,
					size: 2,
					label: '',
					// Its hull's name where the law's meta has none (a law that only joins a netwerk).
					anchorNaam: kort(bronNaam(n, $instrumentMetaStore))
				});
			const seed = n as GraphNode & { x?: number; y?: number };
			const seedHasPos = typeof seed.x === 'number' && typeof seed.y === 'number';
			if (g.hasNode(n.id)) {
				const merged = seedHasPos ? { ...attrs, x: seed.x, y: seed.y } : attrs;
				g.mergeNodeAttributes(n.id, merged);
			} else {
				let x: number, y: number;
				const kolom = kolommen?.get(n.id);
				if (seedHasPos) {
					x = seed.x!;
					y = seed.y!;
				} else if (kolom) {
					x = kolom.x + (Math.random() - 0.5) * 2;
					y = kolom.y + (Math.random() - 0.5) * 2;
				} else {
					const angle = (seededIdx / Math.max(unseededCount, 1)) * Math.PI * 2;
					const rJitter = (Math.random() - 0.5) * 4;
					const aJitter = (Math.random() - 0.5) * 0.15;
					x = fxSeed + Math.cos(angle + aJitter) * (seedRingR + rJitter);
					y = fySeed + Math.sin(angle + aJitter) * (seedRingR + rJitter);
					seededIdx++;
				}
				g.addNode(n.id, { ...attrs, x, y });
				addedThisSync.add(n.id);
				changed = true;
			}
		}
		hasNodes = g.order > 0;
		if (changed) scheduleFit();
		runLayout(addedThisSync).catch((e) => report('Netwerk opmaak', e));
		syncContainerAnchors();
	}

	/** The layout-only links that pull each hull's members together (layout.ts). */
	let anchorEdgeIds: ReadonlySet<string> = new Set();
	function syncContainerAnchors() {
		anchorEdgeIds = syncGroupLinks(g, containerGroups.values(), anchorEdgeIds);
	}

	function placeClusterNodes() {
		// A fractie, commissie or dossier as focus: round its anchor, outside its hull.
		const focus = focusNodeId ?? selection?.id ?? null;
		if (!focus || !g.hasNode(focus) || clusters.length === 0) return;
		placeClusters(
			g,
			focus,
			clusters.map((c) => c.id),
			isClusterId
		);
	}

	function separateContainerGroups() {
		const drawn = [...containerGroups.values()].filter((group) =>
			isDrawnGroup(group, focusContainerId, focusNodeId, groupPeriod)
		);
		if (packGroups(g, drawn)) canvas?.refresh();
	}

	function drawEdges(allEdges: GraphEdge[]) {
		const es = allEdges.filter((e) => isDrawn(e.relation));
		let changed = false;
		const keep = new Set(es.map((e) => e.id));
		g.edges()
			.filter((id) => !keep.has(id))
			.forEach((id) => {
				g.dropEdge(id);
				changed = true;
			});
		for (const e of es) {
			const attrs = {
				relation: e.relation,
				confidence: e.confidence ?? null,
				status: e.status ?? null,
				meta: e.meta ?? null,
				type: 'arrow'
			};
			if (g.hasEdge(e.id)) {
				g.mergeEdgeAttributes(e.id, attrs);
			} else if (
				g.hasNode(e.source) &&
				g.hasNode(e.target) &&
				// A simple graph: one directed edge per source and target, whatever its key.
				!g.hasDirectedEdge(e.source, e.target)
			) {
				g.addDirectedEdgeWithKey(e.id, e.source, e.target, attrs);
				changed = true;
			}
		}
		if (changed) scheduleFit();
	}

	// The hover panel opens only after the pointer rests on a node for 400 ms.
	function handleNodeHover(nodeId: string, vx?: number, vy?: number) {
		if (vx !== undefined && vy !== undefined) lastPointer = { x: vx, y: vy };
		if (compact || isClusterId(nodeId)) return;
		// A marked bron keeps its card; hovering another only lights it.
		if (gemarkeerd) return;
		// De kaart staat naast de bron, niet los in een hoek.
		if (vx !== undefined && vy !== undefined) hoverAt = kaartPlek({ x: vx, y: vy });
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}
		const n = lookup.get(nodeId);
		if (!n) return;
		showTimer = setTimeout(() => {
			hoverNode = n;
			showTimer = null;
		}, 400);
	}

	/** Where the card of a bron stands: beside the bron at `at` (card-place.ts). */
	const kaartPlek = (at: { x: number; y: number } | null) =>
		at && canvasWrap
			? cardBeside(at, { width: canvasWrap.clientWidth, height: canvasWrap.clientHeight })
			: null;

	// A card taller than its place (an article's text, the reader's notes) moves up until its
	// foot is inside the network, as its text loads too.
	$effect(() => {
		const el = citeEl;
		const wrap = canvasWrap;
		if (!el || !wrap || !hoverAt) return;
		const past = () => {
			const at = untrack(() => hoverAt);
			if (!at) return;
			const y = Math.max(8, Math.min(at.y, wrap.clientHeight - el.offsetHeight - 8));
			if (y !== at.y) hoverAt = { x: at.x, y };
		};
		const ro = new ResizeObserver(past);
		ro.observe(el);
		return () => ro.disconnect();
	});

	function handleNodeLeave() {
		if (compact || gemarkeerd) return;
		if (showTimer) {
			clearTimeout(showTimer);
			showTimer = null;
		}
		hideTimer = setTimeout(() => {
			hoverNode = null;
			hideTimer = null;
		}, 600);
	}

	function cancelHide() {
		if (hideTimer) {
			clearTimeout(hideTimer);
			hideTimer = null;
		}
	}

	onMount(() => {
		const unsub = [
			store.nodes.subscribe(syncNodes),
			store.edges.subscribe(syncEdges),
			// Drawn with the nodes and edges of the same change, in one microtask (queueRedraw).
			store.selection.subscribe((n) => {
				selection = n;
				queueRedraw();
			}),
			store.pinned.subscribe((s) => {
				pinnedIds = new Set(s);
				queueRedraw();
			}),
			store.core.subscribe((c) => {
				coreIds = c;
				queueRedraw();
			}),
			store.filters.subscribe((f) => {
				filters = f;
				applyFilters();
			}),
			store.containers.subscribe((groups) => {
				containerGroups = groups;
				queueRedraw();
				syncContainerAnchors();
			})
		];
		return () => unsub.forEach((u) => u());
	});

	onDestroy(() => {
		if (layoutStopTimer) clearTimeout(layoutStopTimer);
		layout?.kill();
		layout = null;
	});

	// The canvas as a focusable region: ← and → step through the bronnen shown only
	// while the network has the focus, never while reading or selecting text.
	let canvasWrap = $state<HTMLDivElement | null>(null);

	function handleKeydown(e: KeyboardEvent) {
		if (e.defaultPrevented || hasModifier(e) || isTyping(e.target)) return;
		if (e.key === 'Escape' && clusterCard) {
			clusterCard = null;
			return;
		}
		if (e.key === 'Escape' && gemarkeerd) {
			ontmarkeer();
			return;
		}
		if (e.key === 'Enter' && gemarkeerd && canvasWrap?.contains(document.activeElement)) {
			e.preventDefault();
			open(gemarkeerd);
			return;
		}
		if (e.key === 'Escape') {
			onClear?.();
			return;
		}
		if (!canvasWrap?.contains(document.activeElement)) return;
		if (e.key === 'ArrowLeft' && onBack) {
			e.preventDefault();
			onBack();
		}
		if (e.key === 'ArrowRight' && onGoForward) {
			e.preventDefault();
			onGoForward();
		}
	}

	function toggleGroup(kind: ContainerKind) {
		const next = new Set(filters.hiddenGroups);
		if (next.has(kind)) next.delete(kind);
		else next.add(kind);
		store.setFilters({ hiddenGroups: next });
	}

	function toggleRelation(r: Relation) {
		const next = new Set(filters.hiddenRelations);
		if (!next.delete(r)) next.add(r);
		store.setFilters({ hiddenRelations: next });
	}

	// The panel floating over the canvas, measured so that hull labels keep clear of it.
	let overlayHost = $state<HTMLDivElement | null>(null);
	/** The canvas and the cards over it (see the markup). */
	let buhne = $state<HTMLDivElement | null>(null);
	// The legend under the panel Netwerk, as wide as it (Thijs, 10 Oct: "legenda en netwerk
	// onder elkaar"): placed from the panel's measured box, and the two weighed against the
	// height of the canvas. Both open while they fit; the one opened last stays, the other
	// folds (zwevend.ts) and comes back once there is room.
	let legendaEl = $state<HTMLElement | null>(null);
	/** The API cut the focus's direct neighbours off (reach.buckets, #528). */
	const deels = $derived(!netwerkActive && !!reach?.buckets?.some((b) => b.kept < b.total));
	let legendaPlek = $state<{ top: number; right: number; width: number; max: number }>({
		top: 12,
		right: 12,
		width: 280,
		max: 0
	});
	/** The height of each card when it last stood open, to know whether it fits again. */
	const hoogteOpen: Partial<Record<Zwevend, number>> = {};
	// A last guard: no more than a few folds a second, whatever the measures say.
	let wissels: number[] = [];
	function wissel(wie: Zwevend | null) {
		if (get(opzij) === wie) return;
		const nu = performance.now();
		wissels = wissels.filter((t) => nu - t < 1000);
		if (wissels.length >= 4) return;
		wissels.push(nu);
		opzij.set(wie);
	}
	function schik() {
		const host = overlayHost;
		if (!host) return;
		// The cards' width and edge from the tokens (--paneel-breed, --paneel-rand).
		const stijl = getComputedStyle(host);
		const card = {
			width: parseFloat(stijl.getPropertyValue('--paneel-breed')) || 280,
			edge: parseFloat(stijl.getPropertyValue('--paneel-rand')) || 12
		};
		const nw = host.querySelector<HTMLElement>('.netwerk:not(.netwerk--start)');
		legendaPlek = legendPlace(
			{ width: host.clientWidth, height: host.clientHeight },
			nw
				? { top: nw.offsetTop, left: nw.offsetLeft, width: nw.offsetWidth, height: nw.offsetHeight }
				: null,
			card
		);
		const nwOpen = !!nw && !nw.classList.contains('netwerk--dicht');
		const nwH = nw ? nw.scrollHeight : 0;
		// The legend scrolls inside its content: its whole height is its head and that content.
		const kop = legendaEl?.querySelector<HTMLElement>('.canvas-kaart__kop');
		const inhoud = legendaEl?.querySelector<HTMLElement>('.canvas-kaart__inhoud');
		const lgH = legendaEl ? (kop?.offsetHeight ?? 0) + (inhoud?.scrollHeight ?? 0) + 2 : 0;
		if (nwOpen) hoogteOpen.netwerk = nwH;
		if (legendaOpen) hoogteOpen.legenda = lgH;
		const step = foldStep({
			height: host.clientHeight,
			panel: nw ? { open: nwOpen, height: nwH } : null,
			legend: { open: legendaOpen, height: lgH },
			folded: get(opzij),
			lastOpened: get(laatstOpen),
			openHeights: hoogteOpen
		});
		if (step === 'unfold') opzij.set(null);
		else if (step) wissel(step.fold);
	}
	$effect(() => {
		const host = overlayHost;
		const lg = legendaEl;
		if (!host) return;
		const kijk = new ResizeObserver(() => schik());
		kijk.observe(host);
		if (lg) kijk.observe(lg);
		// The panel Netwerk is watched as it is now: after a step to another bron it can be a
		// new element, whose chips wrap later (Legenda over Netwerk, UX test 10 Oct, #10).
		const volg = () => {
			const nw = host.querySelector<HTMLElement>('.netwerk');
			if (nw) kijk.observe(nw);
		};
		volg();
		// The panel's content changes without a change of its own box (a chip added).
		const verandert = new MutationObserver(() => {
			volg();
			schik();
		});
		// A chip's new name is a change of its text alone (kabinet → uitspraak: the chips took a
		// second line and the Legenda stayed 19 px over the panel, UX test 10 Oct, #10).
		verandert.observe(host, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['class']
		});
		// The window too: a canvas that grows with it is measured again.
		window.addEventListener('resize', schik);
		// Untracked: schik reads legendaOpen and may fold a card, which changes it; this effect
		// is for the elements, not for what they show (an effect loop once the Legenda grew).
		untrack(schik);
		return () => {
			kijk.disconnect();
			verandert.disconnect();
			window.removeEventListener('resize', schik);
		};
	});
	$effect(() => {
		void legendaOpen;
		queueMicrotask(schik);
	});
	let overlayRect = $state<{ x: number; y: number; width: number; height: number } | null>(null);
	$effect(() => {
		const host = overlayHost;
		if (!host) return;
		let last: typeof overlayRect = null;
		const measure = () => {
			const box = host.getBoundingClientRect();
			const panels = [...host.children].map((c) => c.getBoundingClientRect());
			const shown = panels.filter((r) => r.width > 0 && r.height > 0);
			if (shown.length === 0) {
				overlayRect = last = null;
				return;
			}
			const left = Math.min(...shown.map((r) => r.left));
			const top = Math.min(...shown.map((r) => r.top));
			const right = Math.max(...shown.map((r) => r.right));
			const bottom = Math.max(...shown.map((r) => r.bottom));
			const next = {
				x: left - box.left,
				y: top - box.top,
				width: right - left,
				height: bottom - top
			};
			// Compared with the last measure, not the state: reading the state here would
			// make this effect depend on what it writes.
			const same =
				last &&
				Math.abs(last.x - next.x) < 1 &&
				Math.abs(last.y - next.y) < 1 &&
				Math.abs(last.width - next.width) < 1 &&
				Math.abs(last.height - next.height) < 1;
			if (!same) overlayRect = last = next;
		};
		const resize = new ResizeObserver(measure);
		const watch = () => {
			resize.disconnect();
			resize.observe(host);
			for (const child of host.children) resize.observe(child);
			measure();
		};
		const children = new MutationObserver(watch);
		children.observe(host, { childList: true });
		watch();
		return () => {
			resize.disconnect();
			children.disconnect();
		};
	});
</script>

<svelte:window onkeydown={handleKeydown} onpointerdown={closeClusterCard} />

{#snippet sidebar()}
	<GraphSidebar
		{...legend}
		{verbonden}
		{filter}
		selectionCollection={selection?.collection ?? null}
		{reach}
		hiddenRelations={filters.hiddenRelations}
		onToggleRelation={toggleRelation}
		hiddenGroups={filters.hiddenGroups}
		onToggleGroup={toggleGroup}
		{canvasCounts}
		{overlay}
		inFluxCount={inFluxMap.size}
		{netwerkActive}
		{hasNodes}
	/>
{/snippet}

<div class="graph-view">
	<div class="graph-main">
		<!-- The stage: the cards over the network first, so a Tab reaches Netwerk, Deel and
		     the Legenda before the canvas and its zoom (keyboard audit, 10 Oct); they float
		     over the canvas where they stood, outside it, so ← and → typed in them stay theirs. -->
		<div class="buhne" bind:this={buhne}>
			{#if canvasOverlay}
				<div class="canvas-overlay" bind:this={overlayHost}>
					{@render canvasOverlay()}
				</div>
			{/if}
			<!-- De legenda zweeft boven het canvas, zoals het netwerkpaneel en de gids.
		     Dicht: de tekens van wat er staat. Open: filter, groepering en verbindingen. -->
			{#if canvasCounts.nodes > 0}
				<CanvasKaart
					class="legenda"
					title="Legenda"
					open={legendaOpen}
					onToggle={() => zetLegenda(!legendaOpen)}
					bind:el={legendaEl}
					style="top:{legendaPlek.top}px; right:{legendaPlek.right}px; max-height:{legendaPlek.max}px"
				>
					{#snippet samenvatting()}
						{#if !legendaOpen}
							{#each VORM_VOLGORDE.filter((v) => (canvasCounts.vormen[v] ?? 0) > 0) as v (v)}
								<span class="teken" title="{VORM_LABEL[v]}: {canvasCounts.vormen[v]}"
									><KindGlyph vorm={v} size={11} /></span
								>
							{/each}
							<!-- Not all of the focus's direct neighbours are on the canvas: the Legenda,
							     open, says per kind how many (Getoond). -->
							{#if deels}<span class="deels">deels</span>{/if}
						{/if}
					{/snippet}
					<div class="legenda-inhoud">{@render sidebar()}</div>
				</CanvasKaart>
			{/if}
			<!-- The bronnen on the canvas, for the keyboard: outside the canvas, so ← and →
		     keep stepping through the history there. -->
			<CanvasNodeList
				nodes={listNodes}
				isChosen={(id) => pinnedIds.has(id)}
				onFocusNode={onKeyNode}
				onTab={kaartIn}
				onEscape={closeCard}
				houdt={(el) => !!el && (!!citeEl?.contains(el) || el === canvasWrap)}
				{onToggleChosen}
				onOpenCluster={(n, opener) => openCluster(n.id, opener)}
			/>
			<!-- The canvas takes the focus so that ← and → act on it, and only then. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="graph-canvas-wrap"
				bind:this={canvasWrap}
				role="application"
				aria-label="Netwerk. Pijl links en rechts: vorige en volgende bron."
				tabindex="0"
				onpointerenter={() => {
					fitFollows = false;
					handOpCanvas = true;
				}}
				onpointerleave={() => (handOpCanvas = false)}
				onpointerdown={(e) => {
					// Not from the card of a bron: its own buttons take the press, and the focus
					// leaving the list for the canvas closed the card before their click (#38).
					if ((e.target as Element | null)?.closest?.('.citepanel')) return;
					canvasWrap?.focus({ preventScroll: true });
				}}
				onwheel={() => (fitFollows = false)}
			>
				<div class="zoom" role="group" aria-label="Zoomen">
					<IconButton label="Inzoomen" onclick={() => canvas?.zoom(1.5)}>+</IconButton>
					<IconButton label="Uitzoomen" onclick={() => canvas?.zoom(1 / 1.5)}>−</IconButton>
					<IconButton label="Alles in beeld" onclick={() => canvas?.fit()}>⤢</IconButton>
				</div>
				<GraphCanvas
					avoid={overlayRect}
					graph={g}
					focusedId={selection && !isContainerKind(selection.drawClass) ? selection.id : null}
					{filters}
					{hiddenKinds}
					{pinnedIds}
					{coreIds}
					{containerGroups}
					{focusContainerId}
					{groupPeriod}
					{yearPeriod}
					rechter={filter.rechter}
					{selectedEdgeId}
					{lineLids}
					{inFluxMap}
					{heatMap}
					heatActive={overlay.kind === 'heat'}
					heatPeriodMonths={overlay.kind === 'heat' ? overlay.months : DEFAULT_HEAT_MONTHS}
					mutatieActive={overlay.kind === 'open'}
					externalHoveredId={gemarkeerd?.id ?? hoverNode?.id ?? null}
					{notitieIds}
					onNodeClick={(id) => {
						if (isClusterId(id)) return openCluster(id);
						const n = lookup.get(id);
						if (n) markeer(n);
					}}
					onNodeDoubleClick={(id) => {
						// The second click: the bron opens. "Omgeving tonen" on its card draws its own
						// neighbourhood, as a double click did before.
						if (isClusterId(id)) return;
						const n = lookup.get(id);
						if (n) open(n);
					}}
					onEdgeClick={(id) => {
						const e = store.getEdgeById(id);
						if (e) onEdgeClick?.(e);
					}}
					onNodeHover={handleNodeHover}
					onNodeLeave={handleNodeLeave}
					onStageClick={() => {
						ontmarkeer();
						onClear?.();
					}}
					onDrawn={(set) => {
						drawn = set;
						untrack(telCanvas);
					}}
					onReady={(api) => {
						canvas = api;
						canvas.refresh();
						const camera = skipNextFit && savedCamera(compact ? 'compact' : 'full');
						if (camera) {
							canvas.restoreCamera(camera);
							skipNextFit = false;
						} else {
							canvas.fit();
						}
					}}
					onCameraChange={(state) => {
						saveCamera(compact ? 'compact' : 'full', state);
					}}
				/>

				{#if clusterCard}
					{@const c = clusterCard.cluster}
					<CanvasKaart
						class="cluster-kaart"
						title={clusterLabel(c)}
						role="dialog"
						tabindex="-1"
						style="left:{clusterCard.x}px; top:{clusterCard.y}px"
						onkeydown={(e: KeyboardEvent) => {
							if (!isEscape(e)) return;
							e.preventDefault();
							clusterCard = null;
							if (clusterOpener?.isConnected) clusterOpener.focus();
						}}
					>
						{#snippet kop()}
							<p class="cluster-naam">
								<KindGlyph collection={c.collection} size={14} />{clusterLabel(c)}
							</p>
						{/snippet}
						{#each clusterZinnen( c, c.ends ? null : groupOf(c), (c.ends ?? []).flatMap((e) => {
								const n = lookup.get(e.id);
								return n ? [kort(bronNaam(n, $instrumentMetaStore))] : [];
							}) ) as zin (zin)}
							<p class="cluster-zin">{zin}</p>
						{/each}
						<div class="cluster-knoppen">
							<!-- Actions are text, as in the cite card (concept 21: never boxes). -->
							<button type="button" class="btn is-text" onclick={() => showCluster(c)}
								>Toon alle {formatCount(c.members.length)} in het netwerk</button
							>
							{#if !c.ends}
								<button
									type="button"
									class="btn is-text"
									onclick={() => {
										openGroup(c.collection);
										clusterCard = null;
									}}>Bekijk in Verbonden</button
								>
							{/if}
						</div>
					</CanvasKaart>
				{/if}
				{#if foldable.length > 0}
					<div class="vouw">
						{#each foldable as c (c.id)}
							<button type="button" class="btn" onclick={() => foldCluster(c)}
								><KindGlyph collection={c.collection} size={12} />{bronPlural(c.collection)} samenvouwen</button
							>
						{/each}
					</div>
				{/if}

				<!-- On a phone, what the last action on the network did, with the way back: the
			     place it was done from (Verbonden) is out of sight on the Netwerk tab. -->
				{#if $netwerkMelding?.failure}
					{@const failure = $netwerkMelding.failure}
					<div class="netwerk-melding netwerk-melding--failure">
						<LoadState
							state={{ status: 'error', error: failure.error }}
							what={failure.what}
							plural={failure.plural}
							retry={failure.retry}
						/>
					</div>
				{:else if $netwerkMelding}
					<p class="netwerk-melding" role="status">
						{$netwerkMelding.tekst}
						{#if $netwerkMelding.terug}
							<button
								type="button"
								class="btn is-text"
								onclick={() => {
									$netwerkMelding?.terug?.();
									netwerkMelding.set(null);
								}}>Ongedaan maken</button
							>
						{/if}
					</p>
				{/if}

				{#if hoverNode && (!compact || keyNode || gemarkeerd)}
					<CanvasHoverCard
						node={hoverNode}
						isChosen={pinnedIds.has(hoverNode.id)}
						notities={notities.get(hoverNode.id) ?? []}
						at={keyNode ? null : hoverAt}
						onOpen={() => {
							ontmarkeer();
						}}
						onLezen={open}
						{onToggleChosen}
						onOmgeving={onNodeDoubleClick
							? (n) => {
									ontmarkeer();
									onNodeDoubleClick?.(n);
								}
							: undefined}
						onMouseEnter={cancelHide}
						onMouseLeave={() => {
							if (!gemarkeerd) hoverNode = null;
						}}
						bind:el={citeEl}
						onClose={keyNode ? () => kaartUit('lijst', true) : undefined}
						onVerder={keyNode ? () => kaartUit('canvas') : undefined}
						onBack={keyNode ? () => kaartUit('lijst') : undefined}
					/>
				{/if}
			</div>
		</div>
	</div>
</div>

<style>
	/* Het canvas is een eigen stapellaag. Legenda, netwerkpaneel en kaart zweven
	   binnen het canvas en komen nooit boven menu's, statusbalk of kaarten van buiten. */
	.graph-view {
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
		isolation: isolate;
	}

	.graph-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.buhne {
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.graph-canvas-wrap {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	/* The list of bronnen holds the focus for the keyboard: the canvas shows it. */
	:global(.buhne:has(.canvas-node-list :focus-visible) .graph-canvas-wrap) {
		outline: 2px solid var(--focus);
		outline-offset: -2px;
	}

	.graph-canvas-wrap:focus {
		outline: none;
	}
	.graph-canvas-wrap:focus-visible {
		outline: 2px solid var(--netwerk-focus);
		outline-offset: -2px;
	}

	/* Zoom in, out and back to everything, as on a map. */
	.zoom {
		position: absolute;
		right: var(--s-3);
		bottom: var(--s-3);
		z-index: var(--z-float);
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	/* On a touch screen the buttons stand a finger's 44 px apart: their targets do not meet. */
	@media (pointer: coarse) {
		.zoom {
			gap: calc(var(--s-6) + var(--s-3) - var(--veld-h-klein));
		}
	}

	/* Takes the canvas's place for the panel it holds; only the panel takes the pointer. */
	.canvas-overlay {
		position: absolute;
		inset: 0;
		pointer-events: none;
	}
	.canvas-overlay > :global(*) {
		pointer-events: auto;
	}

	.cluster-naam {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		color: var(--ink);
	}
	.cluster-zin {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.cluster-knoppen,
	.vouw {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
	}
	.cluster-knoppen {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-3);
		margin-top: var(--s-3);
	}
	.vouw {
		position: absolute;
		bottom: var(--s-3);
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-float);
		white-space: nowrap;
	}

	.teken {
		display: inline-flex;
		color: var(--ink);
	}
	.legenda-inhoud {
		overflow-y: auto;
		border-bottom: 1px solid var(--rule);
	}
	/* Een menu in de legenda opent binnen de kaart, onder zijn knop, en schuift mee;
	   zo valt het nooit onder of buiten de kaart. */
	.legenda-inhoud :global(.menu__list) {
		position: static;
		min-width: 0;
		margin-top: var(--s-1);
		box-shadow: none;
	}
	.legenda-inhoud :global(.block__head) {
		flex-wrap: wrap;
	}
	.legenda-inhoud :global(.menu:has(.menu__list)) {
		flex-basis: 100%;
	}
	.deels {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.legenda-inhoud :global(.legend) {
		height: auto;
		border-right: 0;
		padding-top: var(--s-3);
	}

	/* On a phone the full width, as the Netwerk card above it: one width, one right edge. */
	@media (max-width: 768px) {
		:global(.canvas-kaart.legenda) {
			left: var(--paneel-rand);
			width: auto;
			max-width: none;
		}
	}
	.netwerk-melding {
		position: absolute;
		left: var(--s-3);
		right: calc(var(--s-3) + 40px + var(--s-2));
		bottom: calc(var(--s-3) + 48px);
		z-index: var(--z-float);
		display: none;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-2);
		margin: 0;
		padding: var(--s-2) var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
	}
	/* A network that could not be drawn is said on every screen, beside the zoom. */
	.netwerk-melding--failure {
		display: flex;
	}
	.netwerk-melding--failure :global(.failure) {
		margin: 0;
	}
	@media (max-width: 768px) {
		.netwerk-melding {
			display: flex;
		}
		/* Narrow: the Netwerk panel takes the top; the legend stays at the bottom left and
		   leaves room for it. */
		:global(.canvas-kaart.legenda) {
			max-height: calc(100% - 12rem);
		}
		.legenda-inhoud :global(.legend) {
			width: min(250px, calc(100vw - 48px));
		}
	}
</style>

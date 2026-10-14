<script lang="ts">
	import type { Collection } from '$lib/vocabulary';
	import { naFilter, zichtSleutel } from '$lib/graph/zicht';
	import { vandaag } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import type { NeighborhoodReach } from '$lib/graph/store/types';
	import { onDestroy, onMount, tick, untrack } from 'svelte';
	import { isEscape } from '$lib/actions/keys';
	import { get } from 'svelte/store';
	import Graph from 'graphology';
	import type FA2LayoutType from 'graphology-layout-forceatlas2/worker';
	import GraphCanvas from './GraphCanvas.svelte';
	import type { GraphCanvasApi } from './GraphCanvas.svelte';
	import GraphCitePanel from './GraphCitePanel.svelte';
	import CanvasKaart from './CanvasKaart.svelte';
	import CanvasNodeList from './CanvasNodeList.svelte';
	import { readingOrder } from './canvas-keys';
	import GraphSidebar from './GraphSidebar.svelte';
	import type { Snippet } from 'svelte';
	import type { GraphStore, GraphFilters } from '$lib/graph/graph-store';
	import type { GraphEdge, GraphNode, GraphNodeKind } from '$lib/graph/types';
	import { isVersionCollection, kindOfCollection, kort } from '$lib/graph/types';
	import {
		clusterLabel,
		clustersOf,
		tussenClustersOf,
		clusterZinnen,
		isClusterId,
		placeCard,
		type Cluster
	} from '$lib/netwerk/cluster';
	import { openGroup } from '$lib/verbonden/open-group';
	import { bronPlural } from '$lib/vocabulary';
	import { spriteForVorm, IMAGE_SIZE_BUMP, tokens, fillFor, strokeFor } from './nodeSprites';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronNaam } from '$lib/bron/naam';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import IconKnop from '$lib/components/ui/IconKnop.svelte';
	import { VORM_LABEL, VORM_VOLGORDE, vormVanBron, type Vorm } from '$lib/bron/vormen';
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
	import { kolomPlekken } from '$lib/netwerk/kolommen';
	import type { NodeCounts } from '$lib/api/overlays';
	import type { Overlay } from '$lib/stores/overlay';
	import { DEFAULT_HEAT_MONTHS } from '$lib/stores/overlay';
	import type { Relation } from '$lib/vocabulary';
	import {
		BRON_KINDS,
		bronKindOf,
		rechterOf,
		type BronKind,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/source';
	import { laatstOpen, opzij, passenSamen, type Zwevend } from '$lib/stores/zwevend';
	import { netwerkMelding } from '$lib/stores/netwerk-melding';
	import { kaart } from '$lib/map/map.svelte';
	import { gemerkt, notitiesPerBron } from '$lib/map/notities';

	// ── Camera persistence across mounts ──────────────────────────────────────
	// GraphView is unmounted when the mode leaves Netwerk and mounted again on
	// return; the camera is kept here so the view does not re-fit. The canvas is
	// narrower beside a reader (`compact`), so each width keeps its own camera.
	const _cam: Record<string, { x: number; y: number; ratio: number } | null> = {
		full: null,
		compact: null
	};
	const _camNodeIds: Record<string, Set<string>> = { full: new Set(), compact: new Set() };

	let {
		store,
		compact = false,
		filter,
		verbonden,
		depth = 2,
		reach = null,
		selectedEdgeId = null,
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
		onGoBack,
		onGoForward,
		onFilter,
		onOpenFilter,
		onDepth,
		onAllesLaden,
		onLaadSoort,
		laadtSoort,
		allesGrens,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		canvasOverlay
	}: {
		store: GraphStore;
		compact?: boolean;
		filter: VerbondenFilter;
		verbonden: VerbondenState;
		depth?: number;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		selectedEdgeId?: string | null;
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
		onGoBack?: () => void;
		onGoForward?: () => void;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		onDepth: (d: number) => void;
		/** Load all the focus's direct neighbours (?alles=1); absent once they are asked. */
		onAllesLaden?: () => void;
		onLaadSoort?: (collection: Collection) => void;
		laadtSoort?: ReadonlySet<string>;
		allesGrens?: { grens: number; geladen: boolean } | null;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		canvasOverlay?: Snippet;
	} = $props();

	// ── graphology (data + layout, no sigma) ─────────────────────────────────
	const g = new Graph();
	const lookup = new Map<string, GraphNode>();
	let canvas: GraphCanvasApi | null = null;

	let selection = $state<GraphNode | null>(null);
	let pinnedIds = $state<Set<string>>(new Set());
	let coreIds = $state<ReadonlySet<string> | null>(null);
	let filters = $state<GraphFilters>(get(store.filters));
	let hasNodes = $state(false);
	let canvasCounts = $state<{
		nodes: number;
		edges: number;
		kinds: Partial<Record<BronKind, number>>;
		/** The shapes drawn, for the legend: every shape on the canvas has its line there. */
		vormen: Partial<Record<Vorm, number>>;
		/** Per kind, the bronnen hidden with a grouping switched off, and which groupings. */
		metGroep: Partial<Record<BronKind, { count: number; van: number; groepen: ContainerKind[] }>>;
	}>({ nodes: 0, edges: 0, kinds: {}, vormen: {}, metGroep: {} });
	let containerGroups = $state<Map<string, ContainerGroup>>(new Map());
	// When the selection is a container, there is no canvas node to focus around: its
	// own children take that role in the dim/highlight pass instead (GraphCanvas).
	const focusContainerId = $derived(
		selection && isContainerKind(selection.kind) && selection.raw
			? containerIdFor(selection.raw)
			: null
	);
	const focusNodeId = $derived(selection && !isContainerKind(selection.kind) ? selection.id : null);
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

	const hiddenKinds = $derived<ReadonlySet<BronKind>>(
		filter.bronnen ? new Set(BRON_KINDS.filter((k) => !filter.bronnen!.has(k))) : new Set()
	);

	// De zwevende legenda, dicht tot iemand hem opent; per browser onthouden.
	const LEGENDA = 'concordans:legenda';
	let legendaOpen = $state(false);
	$effect(() => {
		try {
			// Closed until opened; where both cards do not fit, the accordion folds one.
			legendaOpen = localStorage.getItem(LEGENDA) === 'open';
		} catch {
			legendaOpen = false;
		}
	});
	/** Folded for want of room, not by a click: it opens again once there is room. */
	let legendaOpzij = false;
	$effect(() =>
		opzij.subscribe((wie) => {
			if (wie === 'legenda' && legendaOpen) {
				legendaOpen = false;
				legendaOpzij = true;
			} else if (wie !== 'legenda' && legendaOpzij) {
				legendaOpzij = false;
				legendaOpen = true;
			}
		})
	);
	const zetLegenda = (v: boolean) => {
		legendaOpen = v;
		legendaOpzij = false;
		if (v && get(opzij) === 'legenda') opzij.set(null);
		if (v) laatstOpen.set('legenda');
		try {
			localStorage.setItem(LEGENDA, v ? 'open' : 'dicht');
		} catch {
			/* geen opslag */
		}
	};

	// What the filter leaves on the canvas.
	function countCanvas() {
		let nodes = 0;
		let edges = 0;
		const kinds: Partial<Record<BronKind, number>> = {};
		const vormen: Partial<Record<Vorm, number>> = {};
		const metGroep: Partial<
			Record<BronKind, { count: number; van: number; groepen: ContainerKind[] }>
		> = {};
		const bronnen: Partial<Record<BronKind, number>> = {};
		const visible = new Set<string>();
		const verborgen = metGroepVerborgen({
			groups: containerGroups.values(),
			uit: filters.hiddenGroups,
			houd: (id) => id === selection?.id
		});
		onMetGroep?.(verborgen);
		g.forEachNode((id, attrs) => {
			// Per kind, before the filter: the sidebar says what the filter hides.
			const kind = attrs.bronKind as BronKind | undefined;
			if (kind) kinds[kind] = (kinds[kind] ?? 0) + 1;
			if (id !== selection?.id && hiddenKinds.has(kind as BronKind)) return;
			if (
				id !== selection?.id &&
				filter.rechter &&
				attrs.collection === 'judgments' &&
				attrs.rechter !== filter.rechter
			)
				return;
			if (kind && !attrs.anchor) bronnen[kind] = (bronnen[kind] ?? 0) + 1;
			const groep = verborgen.get(id);
			if (groep) {
				if (kind && !attrs.anchor) {
					const m = (metGroep[kind] ??= { count: 0, van: 0, groepen: [] });
					m.count++;
					if (!m.groepen.includes(groep)) m.groepen.push(groep);
				}
				return;
			}
			visible.add(id);
			nodes++;
			const vorm = attrs.vorm as Vorm | undefined;
			if (vorm && !attrs.anchor) vormen[vorm] = (vormen[vorm] ?? 0) + 1;
		});
		g.forEachEdge((_id, attrs, src, tgt) => {
			if (attrs.layoutOnly) return;
			if (!visible.has(src) || !visible.has(tgt)) return;
			if (filters.hiddenRelations.has(attrs.relation as Relation)) return;
			edges++;
		});
		for (const [k, m] of Object.entries(metGroep)) m.van = bronnen[k as BronKind] ?? 0;
		canvasCounts = { nodes, edges, kinds, vormen, metGroep };
		drawnIds = [...visible];
	}

	$effect(() => {
		void hiddenKinds;
		void filters;
		countCanvas();
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
		if (passen && !untrack(() => fitSuppressed)) void tick().then(() => canvas?.fit());
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
		const pinnedSet = get(store.pinned);
		const l1 = new Set<string>();
		g.forEachEdge((_id, _attrs, src, tgt) => {
			if (src === focalId) l1.add(tgt);
			else if (tgt === focalId) l1.add(src);
		});
		l1.delete(focalId);
		const l1List: string[] = [];
		const outerList: string[] = [];
		g.forEachNode((id) => {
			if (id === focalId) return;
			if (pinnedSet.has(id)) return;
			if (l1.has(id)) l1List.push(id);
			else outerList.push(id);
		});
		g.setNodeAttribute(focalId, 'x', 0);
		g.setNodeAttribute(focalId, 'y', 0);
		const innerR = Math.max(120, 60 + Math.sqrt(l1List.length) * 30);
		l1List.forEach((id, i) => {
			const ang = (i / Math.max(l1List.length, 1)) * Math.PI * 2 - Math.PI / 2;
			g.setNodeAttribute(id, 'x', Math.cos(ang) * innerR);
			g.setNodeAttribute(id, 'y', Math.sin(ang) * innerR);
		});
		const outerR = innerR + Math.max(140, Math.sqrt(outerList.length) * 30);
		outerList.forEach((id, i) => {
			const ang =
				(i / Math.max(outerList.length, 1)) * Math.PI * 2 -
				Math.PI / 2 +
				Math.PI / Math.max(l1List.length, 1);
			g.setNodeAttribute(id, 'x', Math.cos(ang) * outerR);
			g.setNodeAttribute(id, 'y', Math.sin(ang) * outerR);
		});
		const movable = new Set<string>([...l1List, ...outerList]);
		void runLayout(movable);
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

	// The reader's notes in the active map (Gemarkeerd), per bron: in its card, and a mark on
	// the bronnen that hold one of their own. From this browser, so no request.
	const notities = $derived(notitiesPerBron(kaart.actief));
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
	// bron, as a menu does (actions/menu.ts): in the capture phase, only watched, never stopped.
	$effect(() => {
		if (!keyNode) return;
		const onClick = (e: MouseEvent) => {
			const t = e.target as Node | null;
			if (
				t &&
				(citeEl?.contains(t) ||
					canvasWrap?.parentElement?.querySelector('.canvas-node-list')?.contains(t))
			)
				return;
			keyNode = null;
			hoverNode = null;
		};
		document.addEventListener('click', onClick, true);
		return () => document.removeEventListener('click', onClick, true);
	});
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

	// A stub (referenced, not loaded yet) has a paper fill and keeps the ring of its kind.
	function nodeColors(n: GraphNode): { color: string; borderColor: string } {
		const borderColor = strokeFor(n.kind);
		return { color: n.stub || n.kind === 'other' ? tokens().paper : fillFor(n.kind), borderColor };
	}

	// Elk teken even groot; de vorm zegt wat een bron is, niet de maat. Een groep
	// (dossier, fractie, commissie) een stap groter.
	/** A cluster bron stands for forty or more: a step larger than a group. */
	const CLUSTER_SIZE = 12;
	const NODE_SIZE: Record<GraphNodeKind, number> = {
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
		return NODE_SIZE[n.kind];
	}

	function applyFilters() {
		countCanvas();
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
		if (!layout) {
			for (const id of pinnedDuringBurst) {
				try {
					g.removeNodeAttribute(id, 'fixed');
				} catch {
					/* gone */
				}
			}
			return;
		}
		if (!layout.isRunning()) layout.start();
		if (layoutStopTimer) clearTimeout(layoutStopTimer);
		const burst = pinExisting
			? Math.min(800, 350 + (addedThisSync?.size ?? 0) * 18)
			: Math.min(2500, 600 + g.order * 6);
		layoutStopTimer = setTimeout(() => {
			layout?.stop();
			for (const id of pinnedDuringBurst) {
				try {
					g.removeNodeAttribute(id, 'fixed');
				} catch {
					/* gone */
				}
			}
			separateContainerGroups();
			placeClusters();
			scheduleFit();
		}, burst);
	}

	// Node label: the name of the bron (bron/naam.ts), short enough for the canvas; a
	// Kamerstuk by its kind and number (`stukLabel`). The full name is in the panel and the card.
	const nodeLabel = (n: GraphNode) =>
		isClusterId(n.id) || n.kind === 'document' ? n.label : kort(bronNaam(n, $instrumentMetaStore));

	// A container (a wet, fractie, commissie or dossier) is never a canvas node: its
	// children carry it as a hull instead (`syncContainerAnchors`, GraphCanvas). Nor
	// is a version, current-focus reader page or not: the network is about the
	// current text, and the reader reads a version's own data directly, not this
	// canvas.
	const isCanvasNode = (n: GraphNode) =>
		(n.anchor || !isContainerKind(n.kind)) && !isVersionCollection(n.collection);

	// ── clusters ────────────────────────────────────────────────────────────────
	// What the store holds goes to the canvas through the clusters ($lib/netwerk/cluster):
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
		const edges = rawEdges.filter((e) => e.relation !== 'VERSION_OF');
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
	}

	const clusterNode = (c: Cluster): GraphNode =>
		({
			id: c.id,
			collection: c.collection,
			key: c.id,
			kind: kindOfCollection(c.collection),
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
			void tick().then(() =>
				canvasWrap?.parentElement?.querySelector<HTMLElement>('.cluster-kaart button')?.focus()
			);
		const at = lastPointer ?? { x: CARD_GAP, y: CARD_GAP };
		const w = canvasWrap?.clientWidth ?? CARD_W;
		const x = at.x + CARD_GAP + CARD_W < w ? at.x + CARD_GAP : Math.max(8, w - CARD_W - 8);
		clusterCard = { cluster: c, x, y: Math.max(8, at.y - CARD_GAP) };
		// Measured once drawn, before it is painted: the card moves off the panels it covers.
		void tick().then(() => {
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
				obstacles,
				CARD_GAP
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
	const CARD_W = 280;
	const CARD_GAP = 16;
	/** What floats over the canvas and stays readable: the panel Netwerk, zoom, legenda. */
	const FLOATING = '.canvas-overlay > *, .zoom, .legenda, .vouw';

	function closeClusterCard(e: PointerEvent) {
		if (clusterCard && !(e.target as HTMLElement | null)?.closest?.('.cluster-kaart'))
			clusterCard = null;
	}

	function drawNodes(nodes: GraphNode[]) {
		const camKey = compact ? 'compact' : 'full';
		const newIds = new Set(nodes.map((n) => n.id));
		const prev = _camNodeIds[camKey];
		const sameGraph =
			prev.size > 0 && newIds.size === prev.size && [...newIds].every((id) => prev.has(id));
		const additive =
			prev.size > 0 && newIds.size >= prev.size && [...prev].every((id) => newIds.has(id));
		if (sameGraph && _cam[camKey]) {
			skipNextFit = true;
		} else if (additive) {
			skipNextFit = true;
		} else {
			_cam[camKey] = null;
			skipNextFit = false;
		}
		_camNodeIds[camKey] = newIds;

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
			const { color, borderColor } = nodeColors(n);
			// Elke bron als teken uit vormen.ts.
			const vorm = vormVanBron(n.collection, n.raw?.props, n.key);
			const useImage = true;
			const stub = !!n.stub;
			const rawSize = nodeSize(n.id);
			const attrs: Record<string, unknown> = {
				label: nodeLabel(n),
				cluster: isClusterId(n.id),
				forceLabel: isClusterId(n.id),
				color: useImage ? 'rgba(0,0,0,0)' : color,
				borderColor,
				kind: n.kind,
				vorm,
				collection: n.collection,
				bronKind: bronKindOf(n.collection, n.key, n.raw?.props ?? null),
				// The court of a judgment, as the bronfilter's rechter reads it.
				rechter:
					n.collection === 'judgments'
						? rechterOf({
								identifier: typeof n.raw?.props?.ecli === 'string' ? n.raw.props.ecli : null,
								court: typeof n.raw?.props?.court === 'string' ? n.raw.props.court : null,
								ref: { collection: 'judgments', key: n.key }
							})
						: null,
				stub,
				date: typeof n.raw?.props?.date === 'string' ? n.raw.props.date.slice(0, 10) : null,
				size: useImage ? rawSize * IMAGE_SIZE_BUMP : rawSize,
				type: useImage ? 'image' : 'border'
			};
			if (useImage) attrs.image = spriteForVorm(vorm, stub, false);
			// A wet's anchor is a point its hull and the lines of a change end at, not a dot.
			if (n.anchor)
				Object.assign(attrs, {
					anchor: true,
					type: 'circle',
					color: 'rgba(0,0,0,0)',
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
		applyFilters();
		if (changed) scheduleFit();
		runLayout(addedThisSync);
		syncContainerAnchors();
	}

	// Invisible edges that pull a container's children (a wet's artikelen, a
	// fractie's or commissie's leden, ...) toward each other in the layout, so the
	// hull GraphCanvas draws around them is a compact shape instead of a straggle
	// across the canvas. Never rendered, never clickable: GraphCanvas hides any
	// edge marked `layoutOnly`.
	let anchorEdgeIds = new Set<string>();
	// A star from one member pulls every other member toward that one point, which
	// still leaves the group loose (nothing pulls member 12 toward member 47) and,
	// for a lid on several commissies, stacks every one of its groups on the same
	// anchor. A ring plus a chord to the opposite member pulls the whole group into
	// one another instead, so it settles as a small, round cluster: the padded hull
	// GraphCanvas draws around it stays close to the group and does not reach out
	// to unrelated bronnen sitting nearby on canvas.
	function syncContainerAnchors() {
		const next = new Set<string>();
		const link = (groupId: string, a: string, b: string) => {
			if (a === b) return;
			const edgeId = `anchor:${groupId}:${a < b ? a : b}~${a < b ? b : a}`;
			next.add(edgeId);
			if (!g.hasEdge(edgeId)) {
				try {
					g.addUndirectedEdgeWithKey(edgeId, a, b, { layoutOnly: true });
				} catch {
					/* a parallel edge already links these two */
				}
			}
		};
		for (const group of containerGroups.values()) {
			const present = [...group.members].filter((id) => g.hasNode(id));
			const n = present.length;
			if (n < 2) continue;
			for (let i = 0; i < n; i++) {
				link(group.id, present[i], present[(i + 1) % n]);
				if (n > 3) link(group.id, present[i], present[(i + Math.floor(n / 2)) % n]);
			}
		}
		for (const id of anchorEdgeIds) {
			if (!next.has(id) && g.hasEdge(id)) g.dropEdge(id);
		}
		anchorEdgeIds = next;
	}

	// A ring settles as a loop under FA2, not a knot — pulling an outlying member
	// straight toward the centroid only shrinks the loop, it does not fill it in.
	// And a ring does nothing about a SECOND group: two wetten never share an
	// artikel, a wet and a dossier never share a bron either, yet nothing stops FA2
	// from settling their two clusters on top of each other. After every burst:
	// each group's members are packed into a small, filled disk around their own
	// centroid, in a fixed sunflower spiral (a golden-angle turn and a growing
	// radius per member) rather than wherever FA2 happened to leave them, so the
	// group reads as one round cluster at any size; then any two groups' disks that
	// still overlap are pushed apart along the line between their centres — Venn
	// diagram, not physics: disjoint groups get disjoint ground, whatever kinds
	// they are.
	const CLUSTER_GAP = 36;
	const GOLDEN_ANGLE = 2.399963229728653;
	const groupRadius = (memberCount: number) => Math.max(26, 14 + Math.sqrt(memberCount) * 10);

	// A cluster bron stands where it has most room around the focus: FA2 put "172
	// uitspraken" on the hull of BW5 and its name under the hull's. Of sixteen directions
	// just outside the focus's other neighbours, the one furthest from any bron.
	function placeClusters() {
		// A fractie, commissie or dossier as focus: round its anchor, outside its hull.
		const focus = focusNodeId ?? selection?.id ?? null;
		if (!focus || !g.hasNode(focus) || clusters.length === 0) return;
		const fx = g.getNodeAttribute(focus, 'x') as number;
		const fy = g.getNodeAttribute(focus, 'y') as number;
		const taken: { x: number; y: number }[] = [];
		g.forEachNode((id, a) => {
			if (id !== focus && !isClusterId(id) && !a.anchor)
				taken.push({ x: a.x as number, y: a.y as number });
		});
		const dists = g
			.neighbors(focus)
			.filter((id) => !isClusterId(id))
			.map((id) =>
				Math.hypot(
					(g.getNodeAttribute(id, 'x') as number) - fx,
					(g.getNodeAttribute(id, 'y') as number) - fy
				)
			)
			.sort((a, b) => a - b);
		// Just outside the ring of the other neighbours, which FA2 sets at one distance.
		const r = dists.length ? dists[Math.floor((dists.length - 1) * 0.9)] * CLUSTER_OUT : 100;
		const room = (x: number, y: number) =>
			taken.reduce((min, t) => Math.min(min, Math.hypot(t.x - x, t.y - y)), Infinity);
		for (const c of clusters) {
			if (!g.hasNode(c.id)) continue;
			let best = { x: fx - r, y: fy, room: -1 };
			for (let k = 0; k < DIRECTIONS; k++) {
				const angle = (k / DIRECTIONS) * 2 * Math.PI;
				const x = fx + Math.cos(angle) * r;
				const y = fy + Math.sin(angle) * r;
				const free = room(x, y);
				if (free > best.room) best = { x, y, room: free };
			}
			g.setNodeAttribute(c.id, 'x', best.x);
			g.setNodeAttribute(c.id, 'y', best.y);
			taken.push(best);
		}
	}
	const DIRECTIONS = 16;
	const CLUSTER_OUT = 1.3;

	function separateContainerGroups() {
		type Disk = { cx: number; cy: number; r: number; ids: string[] };
		// A bron can genuinely belong to two groups at once (a stuk that both PART_OF
		// a dossier and AMENDS a wet directly): packing it into each in turn leaves
		// it wherever the last group put it, which then reads as that bron's OWN
		// group reaching out to the other — the very overlap this whole pass exists
		// to remove. Each bron is packed by its largest group only; a smaller group
		// it also belongs to draws its hull around wherever that leaves it, same as
		// any other bron on canvas.
		const eligible = [...containerGroups.values()]
			.filter(
				(group) =>
					group.members.size >= 2 && isDrawnGroup(group, focusContainerId, focusNodeId, groupPeriod)
			)
			.sort((a, b) => b.members.size - a.members.size);
		const primaryGroupId = new Map<string, string>();
		for (const group of eligible) {
			for (const id of group.members) {
				if (g.hasNode(id) && !primaryGroupId.has(id)) primaryGroupId.set(id, group.id);
			}
		}
		const disks: Disk[] = [];
		for (const group of eligible) {
			const ids = [...group.members].filter(
				(id) => g.hasNode(id) && primaryGroupId.get(id) === group.id
			);
			const n = ids.length;
			if (n < 2) continue;
			let cx = 0;
			let cy = 0;
			for (const id of ids) {
				cx += g.getNodeAttribute(id, 'x') as number;
				cy += g.getNodeAttribute(id, 'y') as number;
			}
			cx /= n;
			cy /= n;
			const r = groupRadius(n);
			ids.forEach((id, i) => {
				const angle = i * GOLDEN_ANGLE;
				const radius = r * Math.sqrt((i + 0.5) / n);
				g.setNodeAttribute(id, 'x', cx + radius * Math.cos(angle));
				g.setNodeAttribute(id, 'y', cy + radius * Math.sin(angle));
			});
			disks.push({ cx, cy, r, ids });
		}
		for (let pass = 0; pass < 6 && disks.length > 1; pass++) {
			for (let i = 0; i < disks.length; i++) {
				for (let j = i + 1; j < disks.length; j++) {
					const a = disks[i];
					const b = disks[j];
					const dx = b.cx - a.cx;
					const dy = b.cy - a.cy;
					const dist = Math.hypot(dx, dy) || 0.01;
					const minDist = a.r + b.r + CLUSTER_GAP;
					if (dist >= minDist) continue;
					const overlap = minDist - dist;
					const ux = dx / dist;
					const uy = dy / dist;
					const move = overlap / 2;
					for (const id of a.ids) {
						g.setNodeAttribute(id, 'x', (g.getNodeAttribute(id, 'x') as number) - ux * move);
						g.setNodeAttribute(id, 'y', (g.getNodeAttribute(id, 'y') as number) - uy * move);
					}
					for (const id of b.ids) {
						g.setNodeAttribute(id, 'x', (g.getNodeAttribute(id, 'x') as number) + ux * move);
						g.setNodeAttribute(id, 'y', (g.getNodeAttribute(id, 'y') as number) + uy * move);
					}
					a.cx -= ux * move;
					a.cy -= uy * move;
					b.cx += ux * move;
					b.cy += uy * move;
				}
			}
		}
		// A bron that is not packed into a disk (a judgment citing one of a law's
		// articles) would otherwise sit inside that law's hull and read as part of it.
		// It moves out of every disk it landed in, in its own direction from the disk's
		// centre, into a band around the disk as wide as those bronnen need: a
		// low-discrepancy step spreads them across the band, so bronnen in one direction
		// do not stack on one ring.
		const packed = new Set(disks.flatMap((disk) => disk.ids));
		for (const disk of disks) {
			const inside: { id: string; angle: number }[] = [];
			g.forEachNode((id, attrs) => {
				if (packed.has(id)) return;
				const dx = (attrs.x as number) - disk.cx;
				const dy = (attrs.y as number) - disk.cy;
				if (Math.hypot(dx, dy) >= disk.r + CLUSTER_GAP) return;
				const angle = dx || dy ? Math.atan2(dy, dx) : inside.length * GOLDEN_ANGLE;
				inside.push({ id, angle });
			});
			const band = groupRadius(inside.length);
			inside.forEach(({ id, angle }, i) => {
				const radius = disk.r + CLUSTER_GAP + band * ((i * 0.618034) % 1);
				g.setNodeAttribute(id, 'x', disk.cx + Math.cos(angle) * radius);
				g.setNodeAttribute(id, 'y', disk.cy + Math.sin(angle) * radius);
			});
		}
		if (disks.length > 0) canvas?.refresh();
	}

	function drawEdges(allEdges: GraphEdge[]) {
		// VERSION_OF links an article's own versions across time: real, but not a
		// network relation — the reader's own version nav uses it directly, not this
		// canvas, so it never becomes an edge here.
		const es = allEdges.filter((e) => e.relation !== 'VERSION_OF');
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
			} else if (g.hasNode(e.source) && g.hasNode(e.target)) {
				try {
					g.addDirectedEdgeWithKey(e.id, e.source, e.target, attrs);
					changed = true;
				} catch {
					// A parallel edge between this source and target exists with another key.
				}
			}
		}
		applyFilters();
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

	/** Where the card stands: beside the bron at `at`, not loose in a corner. */
	function kaartPlek(at: { x: number; y: number } | null): { x: number; y: number } | null {
		if (!at || !canvasWrap) return null;
		const W = 360,
			H = 240,
			GAP = 20;
		const w = canvasWrap.clientWidth,
			h = canvasWrap.clientHeight;
		// In a narrow network (beside the reader) the card is as wide as the network allows.
		const breed = Math.min(W, w - 16);
		const x =
			at.x + GAP + breed < w - 8
				? at.x + GAP
				: Math.max(8, Math.min(at.x - GAP - breed, w - breed - 8));
		const y = Math.min(Math.max(8, at.y - 40), Math.max(8, h - H - 8));
		return { x, y };
	}

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
			store.selection.subscribe((n) => {
				selection = n;
				redraw();
			}),
			store.pinned.subscribe((s) => {
				pinnedIds = new Set(s);
				redraw();
			}),
			store.core.subscribe((c) => {
				coreIds = c;
				redraw();
			}),
			store.filters.subscribe((f) => {
				filters = f;
				applyFilters();
			}),
			store.containers.subscribe((groups) => {
				containerGroups = groups;
				redraw();
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
		if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
		const el = e.target as HTMLElement | null;
		if (el?.closest?.('input, select, textarea, [contenteditable]')) return;
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
		if (e.key === 'ArrowLeft' && onGoBack) {
			e.preventDefault();
			onGoBack();
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
	const SPEELRUIMTE = 48;
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
		const H = host.clientHeight;
		// The cards' width and edge from the tokens (--paneel-breed, --paneel-rand).
		const stijl = getComputedStyle(host);
		const breed = parseFloat(stijl.getPropertyValue('--paneel-breed')) || 280;
		const rand = parseFloat(stijl.getPropertyValue('--paneel-rand')) || 12;
		const nw = host.querySelector<HTMLElement>('.netwerk:not(.netwerk--start)');
		const top = nw ? nw.offsetTop + nw.offsetHeight + 8 : rand;
		// As wide as the panel open, its right edge on the panel's: a folded panel is narrower.
		const right = nw ? host.clientWidth - (nw.offsetLeft + nw.offsetWidth) : rand;
		legendaPlek = {
			top,
			right,
			width: Math.min(Math.max(nw?.offsetWidth ?? 0, breed), host.clientWidth - 2 * right),
			max: Math.max(0, H - top - rand)
		};
		const nwOpen = !!nw && !nw.classList.contains('netwerk--dicht');
		const nwH = nw ? nw.scrollHeight : 0;
		// The legend scrolls inside its content: its whole height is its head and that content.
		const kop = legendaEl?.querySelector<HTMLElement>('.canvas-kaart__kop');
		const inhoud = legendaEl?.querySelector<HTMLElement>('.canvas-kaart__inhoud');
		const lgH = legendaEl ? (kop?.offsetHeight ?? 0) + (inhoud?.scrollHeight ?? 0) + 2 : 0;
		if (nwOpen) hoogteOpen.netwerk = nwH;
		if (legendaOpen) hoogteOpen.legenda = lgH;
		const zij = get(opzij);
		if (nwOpen && legendaOpen && !passenSamen(nwH, lgH, H)) {
			wissel(get(laatstOpen) === 'legenda' ? 'netwerk' : 'legenda');
			return;
		}
		// A folded card opens again only with room to spare: measured open and remembered, the
		// heights differ by a few pixels, and without that margin the cards folded and opened
		// each other without end (the page hung once the Legenda grew, 10 Oct).
		const ruim = H - SPEELRUIMTE;
		if (zij === 'legenda' && passenSamen(nwH, hoogteOpen.legenda ?? Infinity, ruim))
			opzij.set(null);
		if (zij === 'netwerk' && passenSamen(hoogteOpen.netwerk ?? Infinity, lgH, ruim))
			opzij.set(null);
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
		{verbonden}
		{filter}
		selectionCollection={selection?.collection ?? null}
		{onFilter}
		{onOpenFilter}
		{depth}
		{reach}
		{onDepth}
		{onAllesLaden}
		{onLaadSoort}
		{laadtSoort}
		{allesGrens}
		hiddenRelations={filters.hiddenRelations}
		onToggleRelation={toggleRelation}
		hiddenGroups={filters.hiddenGroups}
		onToggleGroup={toggleGroup}
		{canvasCounts}
		{overlay}
		inFluxCount={inFluxMap.size}
		{netwerkActive}
		{onToggleHeat}
		{onHeatPeriodChange}
		{onToggleMutatie}
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
					klasse="legenda"
					titel="Legenda"
					open={legendaOpen}
					onToggle={() => zetLegenda(!legendaOpen)}
					bind:el={legendaEl}
					stijl="top:{legendaPlek.top}px; right:{legendaPlek.right}px; max-height:{legendaPlek.max}px"
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
					<IconKnop label="Inzoomen" onclick={() => canvas?.zoom(1.5)}>+</IconKnop>
					<IconKnop label="Uitzoomen" onclick={() => canvas?.zoom(1 / 1.5)}>−</IconKnop>
					<IconKnop label="Alles in beeld" onclick={() => canvas?.fit()}>⤢</IconKnop>
				</div>
				<GraphCanvas
					avoid={overlayRect}
					graph={g}
					focusedId={selection && !isContainerKind(selection.kind) ? selection.id : null}
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
					{inFluxMap}
					{heatMap}
					heatActive={overlay.kind === 'heat'}
					heatPeriodMonths={overlay.kind === 'heat' ? overlay.months : DEFAULT_HEAT_MONTHS}
					mutatieActive={overlay.kind === 'open' || overlay.kind === 'dossier'}
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
					onReady={(api) => {
						canvas = api;
						canvas.refresh();
						const camKey = compact ? 'compact' : 'full';
						if (skipNextFit && _cam[camKey]) {
							canvas.restoreCamera(_cam[camKey]!);
							skipNextFit = false;
						} else {
							canvas.fit();
						}
					}}
					onCameraChange={(state) => {
						_cam[compact ? 'compact' : 'full'] = state;
					}}
				/>

				{#if clusterCard}
					{@const c = clusterCard.cluster}
					<CanvasKaart
						klasse="cluster-kaart"
						titel={clusterLabel(c)}
						role="dialog"
						tabindex="-1"
						stijl="left:{clusterCard.x}px; top:{clusterCard.y}px"
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
				{#if $netwerkMelding}
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
					<GraphCitePanel
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
						onSluit={keyNode ? () => kaartUit('lijst', true) : undefined}
						onVerder={keyNode ? () => kaartUit('canvas') : undefined}
						onTerug={keyNode ? () => kaartUit('lijst') : undefined}
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
	@media (max-width: 767px) {
		:global(.canvas-kaart.legenda) {
			left: var(--paneel-rand);
			width: auto;
			max-width: none;
		}
	}
	.netwerk-melding {
		display: none;
	}
	@media (max-width: 768px) {
		.netwerk-melding {
			position: absolute;
			left: var(--s-3);
			right: calc(var(--s-3) + 40px + var(--s-2));
			bottom: calc(var(--s-3) + 48px);
			z-index: var(--z-float);
			display: flex;
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

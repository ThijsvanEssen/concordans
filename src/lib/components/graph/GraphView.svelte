<script lang="ts">
	import { clickOutside } from '$lib/actions/top-layer';
	import { naFilter, zichtSleutel } from '$lib/graph/zicht';
	import { vandaag, yearFraction } from '$lib/text/datum';
	import { formatCount } from '$lib/text/getal';
	import type { NeighborhoodReach } from '$lib/graph/store/types';
	import { onMount, untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { hasModifier, isEscape, isTyping } from '$lib/actions/keys';
	import { get } from 'svelte/store';
	import Graph from 'graphology';
	import GraphCanvas from './GraphCanvas.svelte';
	import type { GraphCanvasApi } from './GraphCanvas.svelte';
	import CanvasHoverCard from './CanvasHoverCard.svelte';
	import CanvasKaart from './CanvasKaart.svelte';
	import CanvasNodeList from './CanvasNodeList.svelte';
	import { readingOrder } from './canvas-keys';
	import { countCanvas, NO_COUNTS, sameIds, type CanvasCounts } from './canvas-count';
	import GraphSidebar from './GraphSidebar.svelte';
	import { kindRows, lightBuckets, kindFocus, type DrawnBron } from './kind-rows';
	import { contextGroups, panelSettled, panelKinds } from '$lib/verbonden/view';
	import { lazeKernIds } from '$lib/bron/behoort';
	import { parseNodeId } from '$lib/vocabulary';
	import Tijdstrook from './Tijdstrook.svelte';
	import type { ComponentProps, Snippet } from 'svelte';
	import type { GraphStore, GraphFilters } from '$lib/graph/store/types';
	import type { GraphEdge, GraphNode, DrawClass } from '$lib/graph/types';
	import { isVersionCollection, drawClassOf, kort } from '$lib/graph/types';
	import { isDrawn } from '$lib/graph/collection-role';
	import {
		CLUSTER_MAX_LOOSE,
		clusterHeading,
		clusterLabel,
		clustersOf,
		tussenClustersOf,
		clusterZinnen,
		isClusterId,
		type Cluster
	} from '$lib/selection/cluster';
	import { groupFor, openGroup } from '$lib/verbonden/open-group';
	import { bronPlural } from '$lib/vocabulary';
	import { spriteForVorm, IMAGE_SIZE_BUMP } from './nodeSprites';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronNaam } from '$lib/bron/naam';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import IconButtonPaar from '$lib/components/ui/IconButtonPaar.svelte';
	import { vormVanBron } from '$lib/bron/vormen';
	import { kindColour } from '$lib/bron/kleur';
	import {
		containerIdFor,
		formerMembers,
		momentOf,
		type Period,
		isContainerKind,
		type ContainerGroup,
		type ContainerKind
	} from '$lib/graph/container-membership';
	import { metGroepVerborgen } from '$lib/graph/met-groep';
	import { kolomPlekken } from '$lib/selection/kolommen';
	import { radialLayout } from '$lib/graph/layout';
	import type { NodeCounts } from '$lib/api/overlays';
	import type { Overlay } from '$lib/selection/overlay';
	import { DEFAULT_HEAT_MONTHS } from '$lib/selection/overlay';
	import type { Collection, Relation } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		filterGroupOf,
		rechterOf,
		type FilterGroup,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { CLUSTER_CARD, clusterCardAt, placeCard } from '$lib/selection/card-place';
	import { relationWords } from '$lib/verbonden/relation-words';
	import { sentence } from '$lib/network/shared';
	import { netwerkMelding } from '$lib/stores/netwerk-melding';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import { gemerkt, notesOfBundels } from '$lib/map/notities';
	import { keepsCamera, saveCamera, savedCamera } from './camera';

	/** The card of a bron marked in a weergave of its own: its node and what it says of it. */
	type ExternalCard = {
		node: GraphNode;
		ties: { text: string; collection: GraphNode['collection'] | null }[];
		tiesHeading?: string;
		facts?: { term: string; value: string }[];
	};

	/** What the legend (GraphSidebar) asks of the page, handed through as one. */
	type LegendProps = Pick<
		ComponentProps<typeof GraphSidebar>,
		| 'onFilter'
		| 'onOpenFilter'
		| 'depth'
		| 'onDepth'
		| 'onLaadSoort'
		| 'laadtSoort'
		| 'onToggleHeat'
		| 'onHeatPeriodChange'
		| 'onToggleMutatie'
		| 'counting'
	>;

	let {
		store,
		filter,
		verbonden,
		reach = null,
		selectedEdgeId = null,
		lineLids = new Map() as ReadonlyMap<string, string>,
		inFluxMap = new Map() as NodeCounts,
		heatMap = new Map() as NodeCounts,
		overlay = { kind: 'none' } as Overlay,
		marked = null,
		onMark,
		onNodeClick,
		onMetGroep,
		onToggleChosen,
		netwerkActive = false,
		onEdgeClick,
		onClear,
		onBack,
		onGoForward,
		canvasOverlay,
		balk,
		viewChoice,
		meer,
		midden,
		surroundings = false,
		externCounts = null,
		extern = null,
		externStippen = null,
		middenZoom = true,
		externRelations = null,
		...legend
	}: {
		store: GraphStore;
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
		/** The bron marked, as the address holds it (?marked): its card open. */
		marked?: string | null;
		/** A bron was marked, or none is any more: the page writes it in the address. */
		onMark?: (id: string | null) => void;
		/** Lees: the marked bron is read, or (beside a reader) selected. */
		onNodeClick?: (node: GraphNode) => void;
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
		/** The panel Netwerk, in the strip at the left. */
		canvasOverlay?: Snippet;
		/** At the top right of the canvas: Deel. */
		balk?: Snippet;
		/** After the chosen bronnen: the Weergave (Omgeving, Verband, Keten). */
		viewChoice?: Snippet;
		/** First under Meer of the legend: the netwerk's own filters. */
		meer?: Snippet;
		/** The weergave Omgeving: each chosen bron with its own neighbours, clustered per kind. */
		surroundings?: boolean;
		/** Soort and Relatie of a weergave of its own: what it draws, not the canvas. */
		externCounts?: Pick<CanvasCounts, 'kinds' | 'relations' | 'refersFrom'> | null;
		/**
		 * A weergave of its own in the canvas's place (Keten, Verband): the card at the right is
		 * then `extern`'s, the tijdstrook `externStippen`.
		 */
		midden?: Snippet<[number]>;
		extern?: ExternalCard | null;
		externStippen?: readonly { jaar: number; collection: Collection }[] | null;
		/** Zoom over a weergave of its own; Keten fits its width and scrolls instead. */
		middenZoom?: boolean;
		/** Relatie of a weergave of its own: what it hides, and its switch. */
		externRelations?: {
			hidden: ReadonlySet<Relation>;
			toggle: (r: Relation) => void;
		} | null;
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

	// What the canvas draws, as it says it (GraphCanvas `onDrawn`), counted for the Legenda,
	// the sidebar and the keyboard's list.
	let drawn: ReadonlySet<string> = new Set();
	/** The bronnen drawn, a cluster's members each, the anchors and the focus left out. */
	let drawnBronnen = $state<DrawnBron[]>([]);
	function drawnBronnenOf(ids: readonly string[]): DrawnBron[] {
		const focal = (reach?.focal ?? verbonden.id ?? '').toLowerCase();
		// A focus drawn as a hull (a wet, a dossier, a fractie) holds what it draws: one step.
		const focus = g.findNode(
			(id, a) =>
				id.toLowerCase() === focal &&
				!a.anchor &&
				!isContainerKind(lookup.get(id)?.drawClass ?? 'other')
		);
		const out: DrawnBron[] = [];
		const take = (n: GraphNode | undefined, direct: boolean) => {
			if (!n || n.anchor || n.id.toLowerCase() === focal) return;
			const props = n.raw?.props ?? undefined;
			const filterGroup = filterGroupOf(n.collection, n.key, props ?? null);
			out.push({ id: n.id, collection: n.collection, key: n.key, props, filterGroup, direct });
		};
		for (const id of ids) {
			const c = isClusterId(id) ? clusterById.get(id) : undefined;
			// A cluster's members hang on the focus alone.
			if (c) for (const m of c.members) take(store.getNodeById(m) ?? lookup.get(m), true);
			else take(lookup.get(id), !focus || g.areNeighbors(focus, id));
		}
		return out;
	}

	// Soort around one bron reads Verbonden (kind-rows.ts, N1): its soorten, its words, its counts.
	let chain = $state<{ id: string; ids: ReadonlySet<string> } | null>(null);
	$effect(() => {
		const id = verbonden.id;
		const bron = id ? parseNodeId(id) : null;
		if (!id || !bron || chain?.id === id) return;
		lazeKernIds(bron.collection, bron.key, {}).then(
			(ids) => {
				if (verbonden.id === id) chain = { id, ids: new Set(ids) };
			},
			() => (chain = { id, ids: new Set() })
		);
	});
	const kindFocusOf = $derived(
		kindFocus({ netwerkActive, extern: !!externCounts, reach, panelId: verbonden.id })
	);
	const kindRowsShown = $derived.by(() => {
		const bron = kindFocusOf ? parseNodeId(kindFocusOf.id) : null;
		// Around one bron Soort is Verbonden's from the start: no counts of the canvas before it.
		if (!kindFocusOf || !bron) return netwerkActive || externCounts ? null : [];
		// Verbonden of another bron says nothing of this one: its soorten wait.
		const v = kindFocusOf.own ? verbonden : { groups: [], buckets: null };
		const ids = kindFocusOf.own && chain?.id === verbonden.id ? chain.ids : new Set<string>();
		return kindRows({
			focus: bron,
			kinds: panelKinds(v, bron.collection, ids),
			groups: v.groups,
			chain: ids,
			drawn: drawnBronnen,
			buckets: reach?.buckets ?? lightBuckets(v.buckets)
		});
	});
	/** A focus whose leden are drawn filled while current, an outline once gone (N13). */
	const withCurrentMember = $derived(
		!!focusContainerId &&
			formerMembers(containerGroups.get(focusContainerId), vandaag()).size > 0 &&
			(selection?.collection === 'factions' || selection?.collection === 'committees')
	);
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
		drawnBronnen = drawnBronnenOf(geteld.drawnIds);
		telJaren();
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

	/** Order the canvas again around `focalId`, the bron it is drawn around now. */
	export function reseatAround(focalId: string) {
		if (g.hasNode(focalId)) runLayout();
	}

	// A new focus from outside the canvas (a link in a reader, Back) frames the network as
	// a first load does; one chosen on the canvas keeps the view under the hand (UX test 10
	// Oct, #25: from a kabinet to HR 2019:2006 the netwerk kept the kabinet's camera).
	let handOpCanvas = false;
	export function inBeeld() {
		if (!handOpCanvas) fitWhenSettled();
	}

	/** Lift the suppression and fit, once the order of this change stands. */
	export function fitWhenSettled() {
		// An explicit request: it overrides the viewport an additive sync kept.
		fitSuppressed = false;
		skipNextFit = false;
		fitFollows = true;
		setTimeout(scheduleFit, 50);
	}

	// The reader's notes in every bundel, per bron: in its card, and a mark on
	// the bronnen that hold one of their own. From this browser, so no request.
	const notities = $derived(notesOfBundels(kaart.mappen));
	const notitieIds = $derived(gemerkt(notities));

	// The bron whose card stands in the strip at the right: the one marked, or the keyboard's.
	let hoverNode = $state<GraphNode | null>(null);
	// The bronnen drawn on the canvas, for the keyboard's list of them, and the one in its focus.
	let drawnIds = $state<string[]>([]);
	// Its counts once Verbonden is in, the slower of the two, and the canvas has drawn: no
	// number springs (F5).
	const kindsSettled = $derived(
		!!kindFocusOf?.own && panelSettled(verbonden) && drawnIds.length > 0
	);
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

	// One click marks a bron: it lights up with its own lines, its card in the strip at the
	// right. Lees on the card, a second click on it or Enter reads it (Thijs, 9 Oct).
	let gemarkeerd = $state<GraphNode | null>(null);
	function markeer(n: GraphNode) {
		if (gemarkeerd?.id === n.id) return open(n);
		gemarkeerd = n;
		keyNode = null;
		hoverNode = n;
		onMark?.(n.id);
	}
	/** No bron marked any more; `tell` the page, so that the address forgets it too. */
	function ontmarkeer(tell = true) {
		const was = gemarkeerd;
		gemarkeerd = null;
		hoverNode = null;
		if (tell && was) onMark?.(null);
	}
	// Lees keeps the bron marked in the address: Back after reading finds it again.
	function open(n: GraphNode) {
		ontmarkeer(false);
		onNodeClick?.(n);
	}
	// A bron that left the canvas is no longer marked here; the address keeps it.
	$effect(() => {
		if (gemarkeerd && !drawnIds.includes(gemarkeerd.id)) ontmarkeer(false);
	});
	// The bron the address marks (?marked, after Back), once it is drawn: its card opens again.
	// A mark the address lost (Back past it) closes.
	let markedBefore: string | null = null;
	$effect(() => {
		const id = marked;
		const drawnNow = drawnIds;
		const had = markedBefore;
		markedBefore = id;
		untrack(() => {
			if (!id) {
				if (had && gemarkeerd?.id === had) ontmarkeer(false);
				return;
			}
			if (gemarkeerd?.id === id || !drawnNow.includes(id)) return;
			const n = lookup.get(id);
			if (!n) return;
			gemarkeerd = n;
			keyNode = null;
			hoverNode = n;
		});
	});

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

	/** Within a sector: by date, the oldest first, then by name. */
	const inOrder = (a: string, b: string) => {
		const da = String(g.getNodeAttribute(a, 'date') ?? '');
		const db = String(g.getNodeAttribute(b, 'date') ?? '');
		return da && db && da !== db
			? da.localeCompare(db)
			: String(g.getNodeAttribute(a, 'label') ?? '').localeCompare(
					String(g.getNodeAttribute(b, 'label') ?? '')
				);
	};

	/**
	 * The order of the canvas (layout.ts, mockup A197): the chosen bronnen, or the bron it is
	 * drawn around, in the middle; every other bron in the sector of its kind. No force layout:
	 * one netwerk is drawn the same way each time.
	 */
	function runLayout() {
		if (g.order === 0) return;
		const centre = pinnedIds.size > 0 ? [...pinnedIds] : selection ? [selection.id] : [];
		radialLayout(
			g,
			centre,
			(id) => String(g.getNodeAttribute(id, 'filterGroup') ?? 'overig'),
			FILTER_GROUPS,
			inOrder
		);
		canvas?.refresh();
		scheduleFit();
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
		// In the weergave Omgeving every chosen bron folds its own loose neighbours past forty a
		// kind, as the sketch does; else what ties the chosen bronnen stays drawn bron by bron.
		const keep = new Set<string>([...pinnedIds, ...(surroundings ? [] : (coreIds ?? []))]);
		for (const group of containerGroups.values()) for (const id of group.members) keep.add(id);
		const canvasNodes = rawNodes.filter(isCanvasNode);
		const edges = rawEdges.filter((e) => isDrawn(e.relation));
		// Between the chosen bronnen of a netwerk: what ties the same ones, as one.
		const chosen = new Set<string>(pinnedIds);
		if (focus) chosen.add(focus);
		const inHull = new Set<string>();
		for (const group of containerGroups.values()) for (const id of group.members) inHull.add(id);
		const centres = surroundings && pinnedIds.size > 0 ? [...pinnedIds] : focus ? [focus] : [];
		// A chosen law in Omgeving: its own articles past forty as one cluster, "203 artikelen",
		// so its neighbours around it stay readable (UX-toets T10).
		const ownArticles = (open: ReadonlySet<string>): Cluster[] =>
			!surroundings
				? []
				: [...pinnedIds].flatMap((id) => {
						const n = lookup.get(id) ?? rawNodes.find((r) => r.id === id);
						if (!n || n.collection !== 'instruments') return [];
						const cid = containerIdFor(n.raw ?? { collection: n.collection, key: n.key });
						const group = cid ? containerGroups.get(cid) : undefined;
						const members = [...(group?.members ?? [])].filter((m) => !pinnedIds.has(m));
						const cl: Cluster = {
							id: `cluster:articles@${id}`,
							collection: 'articles',
							members,
							relation: 'PART_OF',
							toFocus: true,
							neighbours: members.length,
							ends: [{ id, relation: 'PART_OF', toEnd: true }]
						};
						return members.length > CLUSTER_MAX_LOOSE && !open.has(cl.id) ? [cl] : [];
					});
		const alle = (open: ReadonlySet<string>) => [
			...ownArticles(open),
			...centres.flatMap((c) =>
				clustersOf(canvasNodes, edges, c, keep, open, c === focus ? '' : `@${c}`).map((cl) =>
					c === focus ? cl : { ...cl, ends: [{ id: c, relation: cl.relation, toEnd: cl.toFocus }] }
				)
			),
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

	// Another weergave folds otherwise: drawn again.
	$effect(() => {
		void surroundings;
		untrack(() => {
			rawChanged = true;
			queueRedraw();
		});
	});

	const clusterNode = (c: Cluster): GraphNode =>
		({
			id: c.id,
			collection: c.collection,
			key: c.id,
			drawClass: drawClassOf(c.collection),
			label: clusterLabel(c),
			size: CLUSTER_SIZE,
			members: c.members.length
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
		// The groups Verbonden shows: its kern and inhoud stand elsewhere.
		const own = verbonden.id?.split('/')[0] ?? '';
		return groupFor(contextGroups(verbonden.groups, own as Collection), c.collection);
	};
	/**
	 * Of how many a cluster's kind there are, as Soort says it: the row of the legend that draws
	 * most of that kind, else the API's whole of its collection (N2). Null when all are there.
	 */
	const clusterTotal = (c: Cluster): number | null => {
		if (c.ends) return null;
		const row = (kindRowsShown ?? [])
			.filter((r) => r.collection === c.collection)
			.sort((a, b) => b.drawn - a.drawn)[0];
		if (row) return row.total;
		const buckets = reach?.buckets ?? lightBuckets(verbonden.buckets);
		return buckets.find((b) => b.collection === c.collection)?.total ?? null;
	};
	/** What floats over the canvas and stays readable: the panel Netwerk, zoom, legenda. */
	const FLOATING = '.canvas-overlay > *, .zoom, .legenda, .vouw';

	function closeClusterCard(e: PointerEvent) {
		if (clusterCard && !(e.target as HTMLElement | null)?.closest?.('.cluster-kaart'))
			clusterCard = null;
	}

	function drawNodes(nodes: GraphNode[]) {
		const newIds = new Set(nodes.map((n) => n.id));
		skipNextFit = keepsCamera('full', newIds);

		let changed = false;
		const addedThisSync = new Set<string>();
		const keep = newIds;
		const toDrop = g.nodes().filter((id) => !keep.has(id));

		const wholesaleReplace =
			toDrop.length > 0 && toDrop.length === g.order && [...keep].every((id) => !g.hasNode(id));
		if (wholesaleReplace && toDrop.length > 50) {
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
				// A cluster counts its members in Soort: "Uitspraken 200", not 1.
				members: (n as GraphNode & { members?: number }).members ?? 1,
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
				// The kinds in their colour, the chosen bronnen in ink (mockup A197-b).
				kleur: pinnedIds.has(n.id) ? undefined : kindColour(n.collection),
				image: spriteForVorm(
					vorm,
					!!n.stub,
					false,
					pinnedIds.has(n.id) ? undefined : kindColour(n.collection)
				),
				forceLabel: true
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
		// A change of what stands in the middle orders the canvas again too.
		const centre = pinnedIds.size > 0 ? [...pinnedIds].join() : (selection?.id ?? '');
		if (changed || centre !== centreBefore) runLayout();
		centreBefore = centre;
	}
	let centreBefore = '';

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

	// A bron under the pointer lights up with its lines (GraphCanvas); its card waits for a
	// click: no card covers the canvas (besluit 39).
	function handleNodeHover(_nodeId: string, vx?: number, vy?: number) {
		if (vx !== undefined && vy !== undefined) lastPointer = { x: vx, y: vy };
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
			})
		];
		return () => unsub.forEach((u) => u());
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

	/** The scale of a weergave of its own, by its zoom. */
	let middleScale = $state(1);
	/** The canvas and the cards over it (see the markup). */
	let buhne = $state<HTMLDivElement | null>(null);

	// Below 1101 px the filters of the strip open under a button Filter, over the canvas.
	let filtersOpen = $state(false);

	// ── The tijdstrook ──────────────────────────────────────────────────────────
	// Every bron on the canvas with a date, whatever the period: the strip shows what lies
	// outside it too, so the period can widen again.
	let stippen = $state<{ jaar: number; collection: Collection }[]>([]);
	let stippenSleutel = '';
	function telJaren() {
		const nieuw: { jaar: number; collection: Collection }[] = [];
		const add = (date: unknown, collection: Collection) => {
			if (typeof date !== 'string') return;
			const jaar = yearFraction(date);
			if (jaar > 1000) nieuw.push({ jaar, collection });
		};
		g.forEachNode((id, a) => {
			// A group counts its members by their years: 143 uitspraken are 143 dots (R3-N B8).
			if (isClusterId(id))
				for (const m of clusterById.get(id)?.members ?? [])
					add(store.getNodeById(m)?.raw?.props?.date, a.collection as Collection);
			else add(a.date, a.collection as Collection);
		});
		const sleutel = nieuw.map((s) => `${s.jaar}${s.collection}`).join();
		if (sleutel !== stippenSleutel) {
			stippenSleutel = sleutel;
			stippen = nieuw;
		}
	}
	/** The dots of the strip: the canvas's, or those of a weergave of its own (Keten, Verband). */
	const strookStippen = $derived(externStippen ?? stippen);
	const eersteJaar = $derived(
		strookStippen.length ? String(Math.floor(Math.min(...strookStippen.map((s) => s.jaar)))) : ''
	);
	const laatsteJaar = $derived(
		strookStippen.length ? String(Math.floor(Math.max(...strookStippen.map((s) => s.jaar)))) : ''
	);
	const jaarVan = (dag: string | null) => (dag ? Number(dag.slice(0, 4)) : null);
	/** A period chosen by its years: the bronfilter holds it as days (?van, ?tot). */
	function kiesPeriode(van: number | null, tot: number | null) {
		legend.onFilter({
			...filter,
			van: van === null ? null : `${van}-01-01`,
			tot: tot === null ? null : `${tot}-12-31`
		});
	}
	function veldJaar(e: Event): number | null {
		const v = (e.currentTarget as HTMLInputElement).value.trim();
		const n = Number(v);
		return v && Number.isInteger(n) && n > 1000 && n < 3000 ? n : null;
	}

	// ── How the bron of the card is tied to the chosen bronnen ─────────────────
	// Read from the lines on the canvas: "Haalt Art. 6:162 BW aan", "Art. 6:162 BW noemt deze
	// bron", in the words of every verbinding (relation-words.ts).
	const ties = $derived.by(() => {
		const n = hoverNode;
		void drawnIds;
		if (!n || !g.hasNode(n.id)) return [];
		const lines: { text: string; collection: Collection | null }[] = [];
		for (const other of pinnedIds) {
			if (other === n.id || !g.hasNode(other)) continue;
			const ander = lookup.get(other);
			const naam = ander ? kort(bronNaam(ander, $instrumentMetaStore)) : other;
			for (const [van, naar] of [
				[n.id, other],
				[other, n.id]
			]) {
				const edge = g.edge(van, naar);
				if (!edge) continue;
				const relation = g.getEdgeAttribute(edge, 'relation') as Relation;
				const w = relationWords(
					relation,
					lookup.get(van)?.collection ?? null,
					lookup.get(naar)?.collection ?? null,
					g.getEdgeAttribute(edge, 'meta') as Record<string, unknown> | null
				);
				lines.push({
					text: sentence(w.actief, naam, van === n.id ? 'naar' : 'van'),
					collection: ander?.collection ?? null
				});
			}
		}
		return lines;
	});
</script>

<svelte:window onkeydown={handleKeydown} onpointerdown={closeClusterCard} />

<!-- Deel and the zoom, the same over the canvas and over a weergave of its own. -->
{#snippet controls(zoomIn: () => void, zoomOut: () => void, all: () => void, zoomen = true)}
	{#if balk}<div class="doek-balk">{@render balk()}</div>{/if}
	{#if zoomen}<div class="zoom">
			<IconButtonPaar
				name="Zoom"
				first={{ label: 'Uitzoomen', onclick: zoomOut, sign: '−' }}
				second={{ label: 'Inzoomen', onclick: zoomIn, sign: '+' }}
			/>
			<IconButton label="Alles in beeld" onclick={all}>⤢</IconButton>
		</div>{/if}
{/snippet}

{#snippet periode()}
	<section class="block" aria-labelledby="werkplek-periode">
		<h3 class="strook__kop" id="werkplek-periode">Periode</h3>
		<p class="periode">
			<input
				class="veld"
				inputmode="numeric"
				aria-label="Van het jaar"
				placeholder={eersteJaar}
				value={jaarVan(filter.van) ?? ''}
				onchange={(e) => kiesPeriode(veldJaar(e), jaarVan(filter.tot))}
			/>
			<span>tot</span>
			<input
				class="veld"
				inputmode="numeric"
				aria-label="Tot en met het jaar"
				placeholder={laatsteJaar}
				value={jaarVan(filter.tot) ?? ''}
				onchange={(e) => kiesPeriode(jaarVan(filter.van), veldJaar(e))}
			/>
		</p>
	</section>
{/snippet}

{#snippet sidebar()}
	<GraphSidebar
		periode={filter.van || filter.tot || eersteJaar !== laatsteJaar ? periode : undefined}
		{meer}
		{...legend}
		{verbonden}
		{filter}
		selectionCollection={selection?.collection ?? null}
		reach={externCounts ? null : reach}
		hiddenRelations={externRelations?.hidden ?? filters.hiddenRelations}
		onToggleRelation={externRelations?.toggle ?? toggleRelation}
		hiddenGroups={filters.hiddenGroups}
		onToggleGroup={toggleGroup}
		canvasCounts={externCounts ? { ...canvasCounts, ...externCounts } : canvasCounts}
		{overlay}
		inFluxCount={inFluxMap.size}
		{netwerkActive}
		{hasNodes}
		{kindRowsShown}
		{kindsSettled}
		{withCurrentMember}
	/>
{/snippet}

<div class="graph-view">
	<!-- The strip at the left (besluit 39): the way back and the Weergave, the chosen bronnen,
	     then the legend that is the filter and the period. First in the page, so a Tab reaches
	     them before the canvas and its zoom (keyboard audit, 10 Oct). -->
	<aside class="strook strook--links" aria-label="Bronnen en filters">
		{@render canvasOverlay?.()}
		{@render viewChoice?.()}
		<!-- Whatever the filter leaves drawn: the filters stay, so a kind switched off comes back. -->
		{#if hasNodes || midden}
			<button
				type="button"
				class="btn filterknop raakvlak-knop"
				aria-expanded={filtersOpen}
				aria-controls="werkplek-filters"
				onclick={() => (filtersOpen = !filtersOpen)}>Filter</button
			>
			<div class="strook__filters" class:is-open={filtersOpen} id="werkplek-filters">
				<section class="legenda-inhoud" aria-label="Legenda">
					{@render sidebar()}
				</section>
			</div>
		{/if}
	</aside>
	<div class="graph-main">
		<!-- On a phone Deel and the zoom in a bar of their own above the drawing: over it they
		     covered its bronnen (UX-toets T10b). -->
		<div class="control-bar">
			{#if midden}
				{@render controls(
					() => (middleScale = Math.min(3, middleScale * 1.25)),
					() => (middleScale = Math.max(0.5, middleScale / 1.25)),
					() => (middleScale = 1),
					middenZoom
				)}
			{:else}
				{@render controls(
					() => canvas?.zoom(1.5),
					() => canvas?.zoom(1 / 1.5),
					() => canvas?.fit()
				)}
			{/if}
		</div>
		{#if midden}
			<div class="middle-stage">
				{@render midden(middleScale)}
				{@render controls(
					() => (middleScale = Math.min(3, middleScale * 1.25)),
					() => (middleScale = Math.max(0.5, middleScale / 1.25)),
					() => (middleScale = 1),
					middenZoom
				)}
			</div>
		{/if}
		<div class="buhne" bind:this={buhne} hidden={!!midden}>
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
				{@render controls(
					() => canvas?.zoom(1.5),
					() => canvas?.zoom(1 / 1.5),
					() => canvas?.fit()
				)}
				<GraphCanvas
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
						const camera = skipNextFit && savedCamera('full');
						if (camera) {
							canvas.restoreCamera(camera);
							skipNextFit = false;
						} else {
							canvas.fit();
						}
					}}
					onCameraChange={(state) => {
						saveCamera('full', state);
					}}
				/>

				{#if clusterCard}
					{@const c = clusterCard.cluster}
					<CanvasKaart
						class="cluster-kaart"
						title={clusterHeading(c, clusterTotal(c))}
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
								<KindGlyph collection={c.collection} size={14} />{clusterHeading(
									c,
									clusterTotal(c)
								)}
							</p>
						{/snippet}
						{#each clusterZinnen( c, (c.ends ?? []).flatMap((e) => {
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
							{#if !c.ends && groupOf(c)}
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
			</div>
		</div>
		<Tijdstrook
			stippen={strookStippen}
			van={jaarVan(filter.van)}
			tot={jaarVan(filter.tot)}
			onPeriode={kiesPeriode}
		/>
	</div>
	<!-- The strip at the right: the card of the bron marked; on a phone a sheet under the canvas. -->
	<aside
		class="strook strook--kaart"
		class:is-open={!!(midden ? extern : hoverNode)}
		aria-label="Kaart"
	>
		{#if midden ? extern : hoverNode}
			{@const kaartNode = midden ? extern!.node : hoverNode!}
			<CanvasHoverCard
				node={kaartNode}
				isChosen={pinnedIds.has(kaartNode.id)}
				notities={notities.get(kaartNode.id) ?? []}
				ties={midden ? extern!.ties : ties}
				tiesHeading={midden ? extern!.tiesHeading : undefined}
				facts={midden ? extern!.facts : undefined}
				onOpen={() => ontmarkeer(false)}
				onLezen={open}
				{onToggleChosen}
				bind:el={citeEl}
				onClose={keyNode ? () => kaartUit('lijst', true) : undefined}
				onVerder={keyNode ? () => kaartUit('canvas') : undefined}
				onBack={keyNode ? () => kaartUit('lijst') : undefined}
			/>
		{/if}
	</aside>
</div>

<style>
	/* Het canvas is een eigen stapellaag. Legenda, netwerkpaneel en kaart zweven
	   binnen het canvas en komen nooit boven menu's, statusbalk of kaarten van buiten. */
	/* The werkplek in three strips (besluit 39): the bronnen and filters at the left (300),
	   the canvas with its tijdstrook, the card at the right (360). Nothing floats over the
	   canvas but its zoom. Its own stacking layer: never over menus or the bar. */
	.graph-view {
		position: relative;
		display: grid;
		grid-template-columns: 300px minmax(0, 1fr) 360px;
		width: 100%;
		height: 100%;
		overflow: hidden;
		isolation: isolate;
	}
	.strook {
		min-height: 0;
		overflow-y: auto;
		box-sizing: border-box;
		background: var(--paper);
	}
	.strook--links {
		padding: var(--s-4) var(--s-5);
		border-right: 1px solid var(--rule);
	}
	.strook--kaart {
		padding: var(--s-5);
		border-left: 1px solid var(--rule);
	}
	.strook__kop {
		margin: 0 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	/* Deel at the top right of the canvas, as the mockup's Deel and Exporteer. */
	.doek-balk {
		position: absolute;
		top: var(--s-3);
		right: var(--s-3);
		z-index: var(--z-float);
		display: flex;
		gap: var(--s-2);
	}
	/* The panel Netwerk and its start stand in the strip, on its paper: no card of their own. */
	.strook--links :global(.canvas-kaart) {
		position: static;
		transform: none;
		width: auto;
		max-width: none;
		max-height: none;
		margin: 0 0 var(--s-4);
		padding: 0;
		border: 0;
		box-shadow: none;
		background: none;
	}
	/* Bronnen titled as the blocks under it: Soort, Relatie, Periode. */
	.strook--links :global(.canvas-kaart__titel) {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.strook--links :global(.canvas-kaart__kop),
	.strook--links :global(.canvas-kaart__inhoud) {
		padding-left: 0;
		padding-right: 0;
	}
	.filterknop {
		display: none;
	}
	.periode {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.veld {
		box-sizing: border-box;
		width: 84px;
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-input);
		color: var(--ink);
	}
	/* Between a phone and three strips (1024): the strips narrower, the canvas and its tijdstrook
	   between them; the card's strip only while a bron is marked. */
	@media (min-width: 769px) and (max-width: 1100px) {
		.graph-view {
			grid-template-columns: 240px minmax(0, 1fr);
		}
		/* A card marked: a strip of its own, the canvas narrower, nothing covered (T10b). */
		.graph-view:has(.strook--kaart.is-open) {
			grid-template-columns: 240px minmax(0, 1fr) 300px;
		}
		.strook--links {
			padding: var(--s-4);
		}
		.strook--kaart {
			padding: var(--s-4);
		}
		.strook--kaart:not(.is-open) {
			display: none;
		}
	}
	/* A phone: the canvas takes the width; the strip at the left heads it, its filters under the
	   button Filter, and the card is a sheet at the foot of the canvas. */
	@media (max-width: 768px) {
		.graph-view {
			display: flex;
			flex-direction: column;
		}
		.strook--links {
			flex: none;
			display: flex;
			flex-wrap: wrap;
			align-items: flex-start;
			gap: 0 var(--s-3);
			max-height: 60%;
			padding: var(--s-2) var(--s-4);
			border-right: 0;
			border-bottom: 1px solid var(--rule);
		}
		.strook--links > :global(*) {
			flex-basis: 100%;
		}
		.strook--links > :global(.canvas-kaart) {
			min-width: 0;
			margin: 0;
		}
		.strook--links > .filterknop {
			flex: none;
			margin: 0 0 var(--s-2) var(--s-2);
		}
		/* The Weergave and Filter on one row, as the mockup's 390. */
		.strook--links > :global(.view-choice) {
			flex: 1 1 0;
			min-width: 0;
		}

		.filterknop {
			display: inline-flex;
		}
		.strook__filters:not(.is-open) {
			display: none;
		}
		.graph-main {
			flex: 1;
		}
		.strook--kaart {
			position: absolute;
			left: 0;
			right: 0;
			bottom: 0;
			z-index: var(--z-float);
			max-height: 55%;
			padding: var(--s-4);
			border-left: 0;
			border-top: 1px solid var(--rule-strong);
			box-shadow: var(--shadow-pop);
		}
		.strook--kaart:not(.is-open) {
			display: none;
		}
	}
	/* A phone, as the mockup's 390: no headings over the chosen bronnen, the card a sheet. */
	@media (max-width: 768px) {
		.graph-main > .control-bar {
			display: flex;
			justify-content: flex-end;
			gap: var(--s-2);
			padding: var(--s-1) var(--s-3);
			border-bottom: 1px solid var(--rule);
		}
		.control-bar > .doek-balk,
		.control-bar > .zoom {
			position: static;
			flex-direction: row;
			gap: var(--s-2);
		}
		.graph-canvas-wrap > .doek-balk,
		.graph-canvas-wrap > .zoom,
		.middle-stage > .doek-balk,
		.middle-stage > .zoom {
			display: none;
		}
		/* A finger's 44 px: the rows of the filters, Meer, Deel and the zoom. */
		.strook--links :global(.optie),
		.strook--links :global(.fold-knop) {
			min-height: var(--veld-h-raak);
		}
		.doek-balk :global(.btn) {
			min-width: var(--veld-h-raak);
		}
		.strook--links :global(.canvas-kaart__kop) {
			display: none;
		}
		/* The filters of the netwerk itself come with Filter, as the legend does. */
		.strook--links:not(:has(.strook__filters.is-open)) :global(.netwerk-acties) {
			display: none;
		}
		.strook--kaart {
			max-height: 45%;
			padding-top: var(--s-2);
			border-radius: var(--r-2) var(--r-2) 0 0;
			box-shadow: var(--shadow-modal);
		}
		.strook--kaart::before {
			content: '';
			display: block;
			width: 40px;
			height: 4px;
			margin: 0 auto var(--s-3);
			border-radius: var(--r-rond);
			background: var(--rule);
		}
	}
	@media (pointer: coarse), (max-width: 768px) {
		.filterknop {
			height: var(--veld-h-raak);
		}
		.veld {
			height: var(--veld-h-raak);
		}
	}

	.graph-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.control-bar {
		display: none;
	}
	.middle-stage {
		position: relative;
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
	}

	.buhne {
		flex: 1;
		min-height: 0;
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	/* Under a weergave of its own the canvas keeps its size, unseen: sigma needs one. */
	.buhne[hidden] {
		position: absolute;
		inset: 0;
		visibility: hidden;
		pointer-events: none;
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
	/* On a touch screen and below 768 the buttons stand a finger's 44 px apart: their targets do not meet. */
	@media (pointer: coarse), (max-width: 768px) {
		.zoom {
			gap: var(--s-2);
		}
	}

	/* Keten and Verband are a list on a phone: nothing to zoom (R3-K F12). */
	@media (max-width: 768px) {
		.graph-view:has(.middle-stage) .zoom {
			display: none;
		}
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

	.legenda-inhoud {
		padding-top: 0;
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
	.legenda-inhoud :global(.legend) {
		height: auto;
		border-right: 0;
		padding: 0;
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
	}
</style>

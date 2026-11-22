<script lang="ts">
	import { clickOutside } from '$lib/actions/top-layer';
	import { vandaag, yearFraction } from '$lib/text/datum';
	import type { NeighborhoodReach } from '$lib/graph/store/types';
	import { onMount, untrack } from 'svelte';
	import { hasModifier, isTyping } from '$lib/actions/keys';
	import { get } from 'svelte/store';
	import LanesView from './LanesView.svelte';
	import CanvasHoverCard from './CanvasHoverCard.svelte';
	import CanvasNodeList from './CanvasNodeList.svelte';
	import { readingOrder, stepPointer } from './canvas-keys';
	import {
		canvasKinds,
		countCanvas,
		NO_COUNTS,
		sameIds,
		type CanvasCounts,
		type CountEdge,
		type CountNode
	} from './canvas-count';
	import GraphSidebar from './GraphSidebar.svelte';
	import NetworkChoice from './NetworkChoice.svelte';
	import ViewSheet from './ViewSheet.svelte';
	import { provideWeergaveBlad } from '$lib/network/weergave-blad';
	import {
		containersOnCanvas,
		kindRows,
		lightBuckets,
		kindFocus,
		type DrawnBron
	} from './kind-rows';
	import { panelSettled, panelKinds } from '$lib/verbonden/view';
	import { lazeKernIds } from '$lib/bron/behoort';
	import { parseNodeId } from '$lib/vocabulary';
	import Tijdstrook from './Tijdstrook.svelte';
	import { citationRecord } from '$lib/text/citation-record';
	import { countedAs, kindOf, stripDate, type Stip } from '$lib/bron/strook';
	import type { ComponentProps, Snippet } from 'svelte';
	import type { GraphStore, GraphFilters } from '$lib/graph/store/types';
	import type { LineKind } from '$lib/graph/line-kind';
	import type { GraphEdge, GraphNode } from '$lib/graph/types';
	import { drawClassOf, kort } from '$lib/graph/types';
	import { isDrawn } from '$lib/graph/collection-role';
	import { isCanvasNode } from '$lib/graph/canvas-clusters';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronNaam } from '$lib/bron/naam';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import IconButtonPaar from '$lib/components/ui/IconButtonPaar.svelte';
	import { vormVanBron } from '$lib/bron/vormen';
	import {
		containerIdFor,
		formerMembers,
		type Period,
		isContainerKind,
		type ContainerGroup,
		type ContainerKind
	} from '$lib/graph/container-membership';
	import { metGroepVerborgen } from '$lib/graph/met-groep';
	import type { NodeCounts } from '$lib/api/overlays';
	import type { Collection, Relation } from '$lib/vocabulary';
	import { hiddenKindsOf, rechterOf, type VerbondenFilter } from '$lib/verbonden/filter';
	import { stuksoortOf } from '$lib/bron/rubrieken';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { relationWords } from '$lib/verbonden/relation-words';
	import { sentence } from '$lib/network/shared';
	import { netwerkMelding } from '$lib/stores/netwerk-melding';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import { notesOfBundels } from '$lib/map/notities';

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
		'onFilter' | 'lijstHref' | 'counting' | 'chain'
	>;

	let {
		store,
		filter,
		verbonden,
		reach = null,
		expecting = 0,
		pending = false,
		inFluxMap = new Map() as NodeCounts,
		marked = null,
		onMark,
		onNodeClick,
		onMetGroep,
		onToggleChosen,
		onAdd,
		netwerkActive = false,
		pairSteps = 1,
		onClear,
		canvasOverlay,
		balk,
		viewChoice,
		depth,
		onDepth,
		view = 'omgeving',
		midden,
		externCounts = null,
		extern = null,
		externStippen = null,
		externLines = null,
		onToevoegen,
		...legend
	}: {
		store: GraphStore;
		filter: VerbondenFilter;
		verbonden: VerbondenState;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		/** The bronnen of the netwerk asked and not yet in: Weergave keeps its place meanwhile. */
		expecting?: number;
		/** The focus or its neighbourhood is on its way: the list of bronnen is not yet whole. */
		pending?: boolean;
		inFluxMap?: NodeCounts;
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
		/** A voorstel from the card of a bron added to the netwerk, by its id. */
		onAdd?: (id: string, name?: string) => void;
		netwerkActive?: boolean;
		/** Aantal stappen of Verband (1 to 3): what Aantal stappen shows there, not the canvas's depth. */
		pairSteps?: number;
		/** A click on the stage or Escape: the card Verbinding closes; the selection stays. */
		onClear?: () => void;
		/** The panel Netwerk, in the strip at the left. */
		canvasOverlay?: Snippet;
		/** At the top right of the canvas: Deel. */
		balk?: Snippet;
		/** After the chosen bronnen: the Weergave (Omgeving, Verband, Keten). */
		viewChoice?: Snippet;
		/** First under Meer of the legend: the netwerk's own filters. */
		/** Soort and Relatie of a weergave of its own: what it draws, not the canvas. */
		externCounts?: Pick<CanvasCounts, 'kinds' | 'lines'> | null;
		/**
		 * A weergave of its own in the canvas's place (Keten, Verband): the card at the right is
		 * then `extern`'s, the tijdstrook `externStippen`.
		 */
		/** The weergave chosen; `midden` and `middenZoom` follow it. */
		view?: 'omgeving' | 'verband' | 'keten';
		midden?: Snippet<[number]>;
		extern?: ExternalCard | null;
		externStippen?: readonly Stip[] | null;
		/** Relatie of a weergave of its own: what it hides, and its switch. */
		externLines?: {
			hidden: ReadonlySet<LineKind>;
			toggle: (l: LineKind) => void;
		} | null;
		/** Empty canvas: what the reader can do, add a bron. */
		onToevoegen?: () => void;
		/** The steps of the neighbourhood, chosen in Netwerkkeuze. */
		depth: number;
		onDepth: (d: number) => void;
	} & LegendProps = $props();
	/** Zoom over a weergave of its own; Keten fits its width and scrolls instead. */
	const middenZoom = $derived(view !== 'keten');

	// ── what the counts read ──────────────────────────────────────────────────
	/** The bronnen of the lanes as the counts read them, by id; the lines between them. */
	let kept: ReadonlyMap<string, CountNode> = new Map();
	let countedEdges: CountEdge[] = [];
	/** A line by its two ends, for the ties of a card and the steps from the focus. */
	const lineBetween = new Map<string, GraphEdge>();
	const pairKey = (van: string, naar: string) => `${van}\n${naar}`;
	const areNeighbours = (a: string, b: string) =>
		lineBetween.has(pairKey(a, b)) || lineBetween.has(pairKey(b, a));
	const lookup = new Map<string, GraphNode>();

	let selection = $state<GraphNode | null>(null);
	let pinnedIds = $state<Set<string>>(new Set());
	let filters = $state<GraphFilters>(get(store.filters));
	let hasNodes = $state(false);
	/** No bron chosen and none on its way: the canvas says so, the strip offers + Bron toevoegen. */
	const nothingChosen = $derived(!hasNodes && !midden && !selection && expecting === 0);
	let canvasCounts = $state<CanvasCounts>(NO_COUNTS);
	let containerGroups = $state<Map<string, ContainerGroup>>(new Map());
	// When the selection is a container, there is no canvas node to focus around.
	const focusContainerId = $derived(
		selection && isContainerKind(selection.drawClass) && selection.raw
			? containerIdFor(selection.raw)
			: null
	);
	// The years of the bronfilter as dates; the canvas hides a dated bron outside them.
	const yearPeriod = $derived<Period | null>(
		filter.van !== null || filter.tot !== null
			? {
					from: filter.van,
					to: filter.tot
				}
			: null
	);

	const hiddenKinds = $derived(hiddenKindsOf(filter));

	// What the canvas draws, as it says it (LanesView `onDrawn`), counted for the Legenda,
	// the sidebar and the keyboard's list.
	let drawn: ReadonlySet<string> = new Set();
	/** The bronnen drawn, a cluster's members each, the anchors and the focus left out. */
	let drawnBronnen = $state<DrawnBron[]>([]);
	/** What the lanes draw now, for a row on; `held` adds what they would with nothing off (B105). */
	let shownIds = $state.raw<ReadonlySet<string> | undefined>();
	const containersDrawn = (ids: readonly string[], focal: string, held = true) =>
		containersOnCanvas({
			ids,
			focal,
			groups: containerGroups,
			focusContainerId,
			selectionId: selection?.id ?? null,
			hasNode: (id) => kept.has(id),
			propsOf: (id) => lookup.get(id)?.raw?.props ?? undefined,
			lanesDrawn: new Set(held ? [...drawn, ...laneHeld] : drawn)
		});
	function drawnBronnenOf(ids: readonly string[], held = true): DrawnBron[] {
		const focal = (reach?.focal ?? verbonden.id ?? '').toLowerCase();
		// A focus drawn as a hull (a wet, a dossier, a fractie) holds what it draws: one step.
		const focus =
			[...kept].find(
				([id, a]) =>
					id.toLowerCase() === focal &&
					!a.anchor &&
					!isContainerKind(lookup.get(id)?.drawClass ?? 'other')
			)?.[0] ?? null;
		const out: DrawnBron[] = [];
		const take = (n: GraphNode | undefined, direct: boolean) => {
			if (!n || n.anchor || n.id.toLowerCase() === focal || drawClassOf(n.collection) === 'other')
				return;
			const props = n.raw?.props ?? undefined;
			const filterGroup = kinds.kindOf(n);
			out.push({ id: n.id, collection: n.collection, key: n.key, props, filterGroup, direct });
		};
		for (const id of ids) {
			take(lookup.get(id), !focus || areNeighbours(focus, id));
		}
		// A commissie or dossier drawn as a ring or a point is one bron of its soort (B41).
		const counted = new Set(out.map((b) => b.id));
		for (const { holdsFocus, point, ...ring } of containersDrawn(ids, focal, held))
			if (!counted.has(ring.id))
				out.push({
					...ring,
					direct: !focus || holdsFocus || (point && areNeighbours(focus, ring.id))
				});
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
			shown: shownIds,
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
		const focalId = (selection?.id ?? '').toLowerCase();
		const geteld = countCanvas({
			nodes: kept,
			edges: countedEdges,
			drawn,
			selectionId: selection?.id ?? null,
			hiddenKinds,
			rechter: filter.rechter,
			period: yearPeriod,
			verborgen,
			hiddenLines: filters.hiddenLines,
			rings: containersDrawn([...drawn], focalId).filter((r) => !r.point),
			ringsShown: containersDrawn([...drawn], focalId, false).filter((r) => !r.point)
		});
		canvasCounts = geteld.counts;
		drawnBronnen = drawnBronnenOf(geteld.drawnIds);
		shownIds = new Set(drawnBronnenOf(geteld.drawnIds, false).map((b) => b.id));
		telJaren();
		// The keyboard's list sorts what is drawn: only a change sorts it again.
		const before = untrack(() => drawnIds);
		if (!sameIds(before, geteld.drawnIds)) drawnIds = geteld.drawnIds;
	}

	$effect(() => {
		void hiddenKinds;
		void filters;
		telCanvas();
	});

	// The reader's notes in every bundel, per bron: in its card, and a mark on
	// the bronnen that hold one of their own. From this browser, so no request.
	const notities = $derived(notesOfBundels(kaart.mappen));

	// The bron whose card stands in the strip at the right: the one marked, or the keyboard's.
	let hoverNode = $state<GraphNode | null>(null);
	// The bronnen drawn on the canvas, for the keyboard's list of them, and the one in its focus.
	let drawnIds = $state<string[]>([]);
	// Its counts once Verbonden is in, the slower of the two, and the canvas has drawn: no
	// number springs (F5).
	const kindsSettled = $derived(
		!!kindFocusOf?.own && panelSettled(verbonden) && drawnIds.length > 0
	);
	// The bron in focus in the keyboard's list: it lights up on the canvas, nothing more (R9).
	let keyNode = $state<GraphNode | null>(null);
	// The bron the arrows point at on the canvas itself, in the list's order (stepPointer).
	let pijl = $state<GraphNode | null>(null);
	const listNodes = $derived(
		readingOrder(
			drawnIds.flatMap((id) => lookup.get(id) ?? []),
			selection?.id ?? null
		)
	);
	function onKeyNode(n: GraphNode | null) {
		keyNode = n;
		if (n) pijl = null;
	}
	/** ← and → on the canvas: the bron pointed at moves, from the one marked if any. */
	function wijs(key: string) {
		const at = pijl?.id ?? gemarkeerd?.id ?? null;
		const id = stepPointer(
			key,
			at,
			listNodes.map((n) => n.id)
		);
		if (id === undefined) return false;
		pijl = lookup.get(id) ?? null;
		return true;
	}
	// A bron that left the canvas is pointed at no longer.
	$effect(() => {
		if (pijl && !isOnCanvas(pijl.id)) pijl = null;
	});
	// The card of the bron in the keyboard's list: Tab goes into it, Escape and Shift+Tab back
	// to that bron, Tab past its last action on to the canvas (UX test 10 Oct, #14).
	let citeEl = $state<HTMLElement | null>(null);
	let keyOpener: HTMLElement | null = null;
	function kaartIn(opener: HTMLElement) {
		const eerste = citeEl?.querySelector<HTMLElement>('a[href], button');
		const kaart = citeEl;
		if (!keyNode || hoverNode?.id !== keyNode.id || !kaart || !eerste) return false;
		keyOpener = opener;
		// Focus that leaves card and list elsewhere (a click on the page) closes the card.
		const weg = (e: FocusEvent) => {
			const naar = e.relatedTarget as Node | null;
			// Nowhere: a tap on an iPhone, whose click is still to come; the canvas: a press on
			// it, whose click closes the card itself (see below, #38).
			if (!naar || kaart.contains(naar) || naar === canvasWrap) return;
			kaart.removeEventListener('focusout', weg);
			if (naar && opener.closest('ul')?.contains(naar)) return;
			keyNode = null;
		};
		kaart.addEventListener('focusout', weg);
		eerste.focus();
		return true;
	}
	// A click or tap outside the card and the list of bronnen: the keyboard's bron no longer
	// lights up, as a menu closes.
	$effect(() => {
		if (!keyNode) return;
		return clickOutside(
			() => [citeEl, canvasWrap?.parentElement?.querySelector('.canvas-node-list')],
			() => (keyNode = null)
		);
	});
	/** Escape on the bron in the list: the card of the bron chosen closes, the focus stays (B6). */
	function closeCard() {
		if (!keyNode || !hoverNode) return false;
		ontmarkeer();
		return true;
	}
	function kaartUit(focus: 'lijst' | 'canvas', sluit = false) {
		if (sluit) ontmarkeer();
		if (focus === 'canvas') {
			keyNode = null;
			pijl = gemarkeerd;
			canvasWrap?.focus({ preventScroll: true });
		} else {
			keyOpener?.focus();
		}
	}

	// One click marks a bron: it lights up with its own lines, its card in the strip at the
	// right. Lees on the card, a second click on it or Enter reads it (Thijs, 9 Oct).
	let gemarkeerd = $state<GraphNode | null>(null);
	function markeer(n: GraphNode) {
		if (gemarkeerd?.id === n.id) return open(n);
		gemarkeerd = n;
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
		if (gemarkeerd && !isOnCanvas(gemarkeerd.id)) ontmarkeer(false);
	});
	// The bron the address marks (?marked, after Back), once it is drawn: its card opens again.
	// A mark the address lost (Back past it) closes.
	let markedBefore: string | null = null;
	$effect(() => {
		const id = marked;
		void laneDrawn;
		const had = markedBefore;
		markedBefore = id;
		untrack(() => {
			if (!id) {
				if (had && gemarkeerd?.id === had) ontmarkeer(false);
				return;
			}
			if (gemarkeerd?.id === id || !laneDrawn.has(id)) return;
			const n = lookup.get(id);
			if (!n) return;
			gemarkeerd = n;
			keyNode = null;
			hoverNode = n;
		});
	});

	function applyFilters() {
		telCanvas();
	}

	// ── what the store holds ────────────────────────────────────────────────────
	let rawNodes: GraphNode[] = [];
	let rawEdges: GraphEdge[] = [];
	let kinds = canvasKinds([], []);
	/** What the lanes draw: the store's nodes and edges as they are. */
	let laneNodes = $state.raw<GraphNode[]>([]);
	/** What the lanes draw, their hulls' wetten and dossiers too: those can be marked there. */
	let laneDrawn = $state.raw<ReadonlySet<string>>(new Set());
	let laneHeld = $state.raw<ReadonlySet<string>>(new Set()); // with no kind off: a kind off keeps its count
	/** A bron of the lanes by its id; a hull's wet or dossier is no node of the canvas: the store knows it. */
	const markById = (id: string, then: (n: GraphNode) => void) => {
		const n = lookup.get(id) ?? store.getNodeById(id);
		if (n) then(n);
	};
	const isOnCanvas = (id: string) => laneDrawn.has(id);
	let laneEdges = $state.raw<GraphEdge[]>([]);
	const laneChosen = $derived(
		pinnedIds.size > 0 ? [...pinnedIds] : selection ? [selection.id] : []
	);

	let rawChanged = false;
	// The store gives nodes and then edges for one change: they are counted once, together,
	// in a microtask, before anyone awaiting that change goes on.
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

	/** Hand what the store holds to the lanes, and keep the data the counts read; only when it changed. */
	function redraw() {
		laneNodes = rawNodes;
		laneEdges = rawEdges;
		if (rawChanged) {
			rawChanged = false;
			kinds = canvasKinds(rawNodes, rawEdges);
			keepNodes(rawNodes);
			keepEdges(rawEdges);
		}
		// Counted once, nodes and edges together.
		applyFilters();
	}

	/** What the counts read of a bron: its kind, its day, its court, its stuksoort. */
	function keepNodes(nodes: GraphNode[]) {
		lookup.clear();
		const next = new Map<string, CountNode>();
		for (const n of nodes) {
			lookup.set(n.id, n);
			if (!isCanvasNode(n)) continue;
			next.set(n.id, {
				drawClass: n.drawClass,
				vorm: vormVanBron(n.collection, n.raw?.props, n.key),
				collection: n.collection,
				filterGroup: kinds.kindOf(n),
				stuksoort: n.collection === 'documents' ? stuksoortOf(n.raw?.props) : null,
				// The court of a judgment, as the bronfilter's rechter reads it.
				rechter:
					n.collection === 'judgments'
						? rechterOf({
								identifier: typeof n.raw?.props?.ecli === 'string' ? n.raw.props.ecli : null,
								props: n.raw?.props ?? undefined,
								ref: { collection: 'judgments', key: n.key }
							})
						: null,
				date: stripDate(n.raw?.props, n.collection as Collection, n.id)?.slice(0, 10) ?? null,
				// A wet's anchor is a point its hull and the lines of a change end at.
				anchor: !!n.anchor
			});
		}
		kept = next;
		hasNodes = next.size > 0;
	}

	/** A simple graph: one line per source and target, whatever its key. */
	function keepEdges(allEdges: GraphEdge[]) {
		lineBetween.clear();
		for (const e of allEdges) {
			if (!isDrawn(e.relation) || !kept.has(e.source) || !kept.has(e.target)) continue;
			const key = pairKey(e.source, e.target);
			if (!lineBetween.has(key)) lineBetween.set(key, e);
		}
		countedEdges = [...lineBetween.values()].map(({ source, target, relation }) => ({
			source,
			target,
			relation: relation as Relation
		}));
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
		const opCanvas = !!canvasWrap?.contains(document.activeElement);
		// Escape: first the bron pointed at, then the one chosen.
		if (e.key === 'Escape' && pijl && opCanvas) {
			pijl = null;
			return;
		}
		if (e.key === 'Escape' && gemarkeerd) {
			ontmarkeer();
			return;
		}
		// Enter chooses the bron pointed at, as a click does; on the one chosen it reads it.
		const kies = pijl ?? gemarkeerd;
		if (e.key === 'Enter' && kies && opCanvas) {
			e.preventDefault();
			markeer(kies);
			return;
		}
		if (e.key === 'Escape') {
			onClear?.();
			return;
		}
		if (opCanvas && wijs(e.key)) e.preventDefault();
	}

	function toggleGroup(kind: ContainerKind) {
		const next = new Set(filters.hiddenGroups);
		if (next.has(kind)) next.delete(kind);
		else next.add(kind);
		store.setFilters({ hiddenGroups: next });
	}

	function toggleAnnexes() {
		store.setFilters({ hiddenAnnexes: !filters.hiddenAnnexes });
	}

	function toggleLine(l: LineKind) {
		const next = new Set(filters.hiddenLines);
		if (!next.delete(l)) next.add(l);
		store.setFilters({ hiddenLines: next });
	}

	/** The scale of a weergave of its own, by its zoom. */
	let middleScale = $state(1);
	const zoomBy = (f: number) => () => (middleScale = Math.min(3, Math.max(0.5, middleScale * f)));
	const zoomOfMidden = $derived(
		middenZoom ? { in: zoomBy(1.25), out: zoomBy(0.8), all: () => (middleScale = 1) } : null
	);
	/** The canvas and the cards over it (see the markup). */
	let buhne = $state<HTMLDivElement | null>(null);

	/** A phone: the bronnen and filters in a sheet, open for the weergave it opened in (B111). */
	let sheetFor = $state<string | null>(null);
	const sheetOpen = $derived(sheetFor === view);
	provideWeergaveBlad({
		open: () => (sheetFor = view),
		get isOpen() {
			return sheetOpen;
		}
	});
	let sheetOpener = $state<HTMLButtonElement | null>(null);
	/** The card of a bron marked is a sheet at the foot on a phone: the button stands above it. */
	let cardHeight = $state(0);
	let stripHeight = $state(0);
	function closeSheet() {
		sheetFor = null;
		sheetOpener?.focus();
	}

	// ── The tijdstrook ──────────────────────────────────────────────────────────
	// Every bron on the canvas with a date, whatever the period: the strip shows what lies
	// outside it too, so the period can widen again.
	let stippen = $state<Stip[]>([]);
	let undated = $state.raw<Collection[]>([]);
	let stippenSleutel = '';
	/** A publication (Staatsblad, Trb., Staatscourant) with a date, named by its key. */
	const changeName = (id: string) => {
		const m = /^instruments\/(stb|trb|stcrt)_(\d{4})_(\d+)/.exec(id);
		return m
			? (citationRecord({ kind: 'publication', series: m[1], year: m[2], number: m[3] })?.short ??
					undefined)
			: undefined;
	};
	function telJaren() {
		const nieuw: Stip[] = [];
		const zonder: Collection[] = [];
		const add = (date: string | null, from: Collection, id: string) => {
			const collection = countedAs(from, store.getNodeById(id)?.raw?.props);
			if (date === null) {
				if (kindOf(collection) || collection === 'articles' || collection === 'annexes')
					zonder.push(collection);
				return;
			}
			const jaar = yearFraction(date);
			if (jaar > 1000) nieuw.push({ jaar, collection, change: changeName(id) });
		};
		for (const [id, a] of kept) add(a.date, a.collection as Collection, id);
		const sleutel =
			nieuw.map((s) => `${s.jaar}${s.collection}${s.change ?? ''}`).join() + zonder.join();
		if (sleutel !== stippenSleutel) {
			stippenSleutel = sleutel;
			stippen = nieuw;
			undated = zonder;
		}
	}
	/** The dots of the strip: the canvas's, or those of a weergave of its own (Keten, Verband). */
	const strookStippen = $derived(externStippen ?? stippen);
	const jaarVan = (dag: string | null) => (dag ? Number(dag.slice(0, 4)) : null);
	/** A period chosen by its years: the bronfilter holds it as days (?van, ?tot). */
	function kiesPeriode(van: number | null, tot: number | null) {
		legend.onFilter({
			...filter,
			van: van === null ? null : `${van}-01-01`,
			tot: tot === null ? null : `${tot}-12-31`
		});
	}

	// ── How the bron of the card is tied to the chosen bronnen ─────────────────
	// Read from the lines on the canvas: "Haalt Art. 6:162 BW aan", "Art. 6:162 BW noemt deze
	// bron", in the words of every verbinding (relation-words.ts).
	const ties = $derived.by(() => {
		const n = hoverNode;
		void drawnIds;
		if (!n || !kept.has(n.id)) return [];
		const lines: { text: string; collection: Collection | null }[] = [];
		for (const other of pinnedIds) {
			if (other === n.id || !kept.has(other)) continue;
			const ander = lookup.get(other);
			const naam = ander ? kort(bronNaam(ander, $instrumentMetaStore)) : other;
			for (const [van, naar] of [
				[n.id, other],
				[other, n.id]
			]) {
				const edge = lineBetween.get(pairKey(van, naar));
				if (!edge) continue;
				const w = relationWords(
					edge.relation,
					lookup.get(van)?.collection ?? null,
					lookup.get(naar)?.collection ?? null,
					edge.meta
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

<svelte:window onkeydown={handleKeydown} />

<!-- Deel and the zoom, the same over the canvas and over a weergave of its own. -->
{#snippet controls(zoom: { in: () => void; out: () => void; all: () => void } | null)}
	{#if balk}<div class="doek-balk">{@render balk()}</div>{/if}
	{#if zoom}<div class="zoom">
			<IconButtonPaar
				name="Zoom"
				first={{ label: 'Uitzoomen', onclick: zoom.out, sign: '−' }}
				second={{ label: 'Inzoomen', onclick: zoom.in, sign: '+' }}
			/>
			<IconButton label="Alles in beeld" onclick={zoom.all}>⤢</IconButton>
		</div>{/if}
{/snippet}

{#snippet sheetButton()}
	<button
		type="button"
		class="btn sheet-button"
		aria-haspopup="dialog"
		aria-expanded={sheetOpen}
		bind:this={sheetOpener}
		onclick={() => (sheetFor = sheetOpen ? null : view)}>Weergave</button
	>
{/snippet}

{#snippet sidebar()}
	<GraphSidebar
		{...legend}
		{filter}
		reach={externCounts || yearPeriod ? null : reach}
		hiddenAnnexes={filters.hiddenAnnexes}
		onToggleAnnexes={toggleAnnexes}
		hiddenLines={externLines?.hidden ?? filters.hiddenLines}
		onToggleLine={externLines?.toggle ?? toggleLine}
		showLines={!!externLines}
		onToggleGroup={toggleGroup}
		canvasCounts={externCounts ?? canvasCounts}
		hasNodes={hasNodes || !!externCounts}
		{kindRowsShown}
		{kindsSettled}
		{withCurrentMember}
	/>
{/snippet}

<div class="graph-view" style:--strook-h="{stripHeight}px">
	<!-- The strip at the left (besluit 39): the way back and the Weergave, the chosen bronnen,
	     then the legend that is the filter and the period. First in the page, so a Tab reaches
	     them before the canvas and its zoom (keyboard audit, 10 Oct). -->
	<ViewSheet open={sheetOpen} onClose={closeSheet} opener={() => sheetOpener}>
		<aside class="strook strook--links" aria-label="Bronnen en filters">
			{@render canvasOverlay?.()}
			<!-- No bron chosen: the strip has + Bron toevoegen alone, the canvas says why (live-toets B8). -->
			{#if !nothingChosen}<NetworkChoice
					{view}
					viewSlot={viewChoice}
					depth={view === 'verband' ? pairSteps : depth}
					{onDepth}
					withNetwerk={netwerkActive && view === 'omgeving'}
				>
					<!-- Whatever the filter leaves drawn: the filters stay, so a kind switched off comes back. -->
					{#if (hasNodes || midden) && !legend.counting}
						<section class="legenda-inhoud" aria-label="Filters">
							{@render sidebar()}
						</section>
					{/if}
				</NetworkChoice>{/if}
		</aside>
	</ViewSheet>
	<div class="graph-main">
		<!-- On a phone Weergave, Deel and the zoom in a bar above the drawing, in every weergave:
		     over it they covered its bronnen and the rows of a list (UX-toets T10b, B48, R3). -->
		<div class="control-bar">
			{@render sheetButton()}
			{@render controls(midden ? zoomOfMidden : null)}
		</div>
		{#if midden}
			<div class="middle-stage">
				{@render midden(middleScale)}
				{@render controls(zoomOfMidden)}
			</div>
		{/if}
		<div class="buhne" bind:this={buhne} hidden={!!midden}>
			<!-- The bronnen on the canvas, for the keyboard: outside the canvas, so ← and →
		     keep stepping through the history there. -->
			<CanvasNodeList
				nodes={listNodes}
				pending={pending || !!legend.counting}
				isChosen={(id) => pinnedIds.has(id)}
				onFocusNode={onKeyNode}
				onKies={markeer}
				aangewezen={pijl}
				onTab={kaartIn}
				onEscape={closeCard}
				houdt={(el) => !!el && (!!citeEl?.contains(el) || el === canvasWrap)}
				{onToggleChosen}
			/>
			<!-- The canvas takes the focus so that ← and → act on it, and only then. -->
			<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
			<div
				class="graph-canvas-wrap"
				bind:this={canvasWrap}
				role="application"
				aria-label="Netwerk. Pijl links en rechts: vorige en volgende bron."
				data-aangewezen={pijl?.id}
				tabindex="0"
				onfocusout={(e) => {
					// Tab elsewhere: no bron pointed at. A tap (focus to nowhere) keeps it.
					if (e.relatedTarget && !canvasWrap?.contains(e.relatedTarget as Node)) pijl = null;
				}}
				onpointerdown={(e) => {
					// Not from the card of a bron: its own buttons take the press, and the focus
					// leaving the list for the canvas closed the card before their click (#38).
					if ((e.target as Element | null)?.closest?.('.citepanel')) return;
					canvasWrap?.focus({ preventScroll: true });
				}}
			>
				{@render controls(null)}
				{#if !hasNodes && !midden && !selection && onToevoegen}
					<!-- Nothing on the canvas yet (Netwerkkeuze, Leeg): the way on, not a white field. -->
					<div class="canvas-leeg">
						<p class="canvas-leeg__kop">Nog geen bron gekozen</p>
						<button type="button" class="btn raakvlak-knop" onclick={onToevoegen}
							>+ Bron toevoegen</button
						>
					</div>
				{/if}
				{#if !midden}
					<LanesView
						nodes={laneNodes}
						filter={{ period: yearPeriod, court: filter.rechter }}
						edges={laneEdges}
						chosen={laneChosen}
						visibility={{ hiddenKinds, hiddenLines: filters.hiddenLines }}
						onToggleLine={toggleLine}
						marked={gemarkeerd?.id ?? null}
						pointed={pijl?.id ?? keyNode?.id ?? null}
						onMark={(id) => markById(id, markeer)}
						onOpen={(id) => markById(id, open)}
						onUnmark={ontmarkeer}
						onDrawn={(set, held) => {
							drawn = set;
							laneDrawn = set;
							laneHeld = held;
							untrack(telCanvas);
						}}
					/>
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
					<p class="netwerk-melding" role="status" style:--kaart-h="{cardHeight}px">
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
		<div
			class="strook-hoogte"
			data-wacht={legend.counting || undefined}
			bind:clientHeight={stripHeight}
		>
			<Tijdstrook
				stippen={legend.counting ? [] : strookStippen}
				undated={externStippen ? [] : undated}
				van={jaarVan(filter.van)}
				tot={jaarVan(filter.tot)}
				fromDay={filter.van}
				toDay={filter.tot}
				onPeriode={kiesPeriode}
				onDays={(van, tot) => legend.onFilter({ ...filter, van: van || null, tot: tot || null })}
			/>
		</div>
	</div>
	<!-- The strip at the right: the card of the bron marked; on a phone a sheet under the canvas. -->
	<aside
		class="strook strook--kaart"
		class:is-open={!!(midden ? extern : hoverNode)}
		aria-label="Kaart"
		bind:clientHeight={cardHeight}
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
				openCount={inFluxMap.get(kaartNode.id) ?? 0}
				chosen={pinnedIds}
				{onAdd}
				changes
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
		grid-template-columns: var(--strook-links) minmax(0, 1fr) var(--strook);
		--strook: calc(var(--zijkolom) + 2 * var(--s-4));
		width: 100%;
		height: 100%;
		overflow: hidden;
		isolation: isolate;
	}
	/* The strip of the card takes room only while a bron is marked. */
	.graph-view:not(:has(.strook--kaart.is-open)) {
		grid-template-columns: var(--strook-links) minmax(0, 1fr);
	}
	.strook--kaart:not(.is-open) {
		display: none;
	}
	.strook {
		min-height: 0;
		overflow-y: auto;
		box-sizing: border-box;
		background: var(--paper);
	}
	.strook--links {
		padding: var(--s-4) var(--strook-marge);
		border-right: 1px solid var(--rule);
	}
	.strook--kaart {
		padding: var(--s-4);
		border-left: 1px solid var(--rule);
	}
	/* The card of a cluster stands in the strip on its paper, as the card of a bron does. */
	.strook--kaart :global(.canvas-kaart__kop),
	.strook--kaart :global(.canvas-kaart__inhoud) {
		padding-left: 0;
		padding-right: 0;
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
		margin: 0 0 var(--s-4);
		padding: 0;
	}
	/* The two blocks of the strip, Bronnen and Weergave, are headed as a section of a page
	   (Sectie, niveau 2); what is in them, Gekozen, Tonen, Relatie, a level lower (niveau 3). */
	.strook--links :global(.canvas-kaart__titel) {
		font: var(--niveau-1-sectie);
		color: var(--ink);
	}
	.strook--links :global(.canvas-kaart__kop),
	.strook--links :global(.canvas-kaart__inhoud) {
		padding-left: 0;
		padding-right: 0;
	}
	.strook--links :global(.canvas-kaart.netwerkkeuze) {
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	/* The blocks in them a step apart. */
	.strook--links :global(.canvas-kaart__inhoud) {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}
	.sheet-button {
		display: none;
	}
	/* Between a phone and three strips (1024): the strips narrower, the canvas and its tijdstrook
	   between them; the card's strip only while a bron is marked. */
	@media (min-width: 769px) and (max-width: 1100px) {
		.graph-view {
			grid-template-columns: var(--strook-links) minmax(0, 1fr);
		}
		/* A card marked: a strip of its own, the canvas narrower, nothing covered (T10b). */
		.graph-view:has(.strook--kaart.is-open) {
			grid-template-columns: var(--strook-links) minmax(0, 1fr) var(--strook);
		}
	}
	/* A phone: the canvas takes the width; the strip at the left heads it, with the filters in its
	   Weergave, and the card is a sheet at the foot of the canvas. */
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
			padding: var(--s-2) var(--s-4) var(--s-4);
			border-right: 0;
		}
		.strook--links > :global(*) {
			flex-basis: 100%;
		}
		.strook--links > :global(.canvas-kaart) {
			min-width: 0;
			margin: 0;
		}
		/* Weergave: a finger high; the sheet is its own. */
		.sheet-button {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
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
			box-shadow: none;
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
	.strook-hoogte {
		flex: none;
		display: flex;
		flex-direction: column;
	}
	/* The Tijdstrook is on its way: its place is held, so the canvas above it does not shrink. */
	.strook-hoogte[data-wacht] {
		min-height: 92px;
	}
	@media (max-width: 768px) {
		.strook-hoogte[data-wacht] {
			min-height: 116px;
		}
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
	/* Under a weergave of its own the buhne stands unseen. */
	.buhne[hidden] {
		position: absolute;
		inset: 0;
		visibility: hidden;
		pointer-events: none;
	}
	.canvas-leeg {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--s-3);
		pointer-events: none;
	}
	.canvas-leeg__kop {
		margin: 0;
		color: var(--ink-3);
	}
	.canvas-leeg .btn {
		pointer-events: auto;
	}
	.graph-canvas-wrap {
		flex: 1;
		position: relative;
		overflow: hidden;
	}
	/* The list of bronnen holds the focus for the keyboard: the canvas shows it. The ring is
	   drawn over the canvas, which would cover an outline of its own box. */
	:global(.buhne:has(.canvas-node-list :focus-visible) .graph-canvas-wrap)::after,
	.graph-canvas-wrap:focus-visible::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 1;
		box-shadow: inset 0 0 0 2px var(--netwerk-focus);
		pointer-events: none;
	}

	.graph-canvas-wrap:focus {
		outline: none;
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
		/* Above the Tijdstrook, or the card where it stands higher: over neither. */
		bottom: calc(var(--s-3) + max(var(--kaart-h, 0px), var(--strook-h, 0px)));
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

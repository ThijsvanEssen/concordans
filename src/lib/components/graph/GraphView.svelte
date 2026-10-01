<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Graph from 'graphology';
	import type FA2LayoutType from 'graphology-layout-forceatlas2/worker';
	import GraphCanvas from './GraphCanvas.svelte';
	import type { GraphCanvasApi } from './GraphCanvas.svelte';
	import GraphCitePanel from './GraphCitePanel.svelte';
	import CanvasNodeList from './CanvasNodeList.svelte';
	import { readingOrder } from './canvas-keys';
	import GraphSidebar from './GraphSidebar.svelte';
	import type { Snippet } from 'svelte';
	import type { GraphStore, GraphFilters } from '$lib/graph/graph-store';
	import type { GraphEdge, GraphNode, GraphNodeKind } from '$lib/graph/types';
	import { isVersionCollection } from '$lib/graph/types';
	import { spriteForVorm, IMAGE_SIZE_BUMP, tokens, fillFor, strokeFor } from './nodeSprites';
	import { vormVan } from '$lib/bron/vormen';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { bronNaam } from '$lib/bron/naam';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { BRON_KIND_COLLECTION } from '$lib/bron/vormen';
	import { BRON_KIND_LABEL } from '$lib/verbonden/filter';
	import {
		containerIdFor,
		containerMembershipStore,
		isDrawnGroup,
		momentOf,
		type Period,
		isContainerKind,
		type ContainerGroup
	} from '$lib/graph/container-membership';
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
		selectedEdgeId = null,
		inFluxMap = new Map() as NodeCounts,
		heatMap = new Map() as NodeCounts,
		overlay = { kind: 'none' } as Overlay,
		onNodeClick,
		onNodeDoubleClick,
		onToggleChosen,
		netwerkActive = false,
		onEdgeClick,
		onClear,
		onGoBack,
		onGoForward,
		onFilter,
		onOpenFilter,
		onDepth,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		onResetGraph,
		canvasOverlay
	}: {
		store: GraphStore;
		compact?: boolean;
		filter: VerbondenFilter;
		verbonden: VerbondenState;
		depth?: number;
		selectedEdgeId?: string | null;
		inFluxMap?: NodeCounts;
		heatMap?: NodeCounts;
		overlay?: Overlay;
		onNodeClick?: (node: GraphNode) => void;
		/** Replaces the canvas with the bron's own neighbourhood; a click only selects. */
		onNodeDoubleClick?: (node: GraphNode) => void;
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
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		onResetGraph?: () => void;
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
	}>({ nodes: 0, edges: 0, kinds: {} });
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
					from: filter.van !== null ? `${filter.van}-01-01` : null,
					to: filter.tot !== null ? `${filter.tot}-12-31` : null
				}
			: null
	);
	const groupPeriod = $derived<Period | null>(
		yearPeriod ??
			momentOf(focusNodeId, containerGroups.values(), new Date().toISOString().slice(0, 10))
	);

	const hiddenKinds = $derived<ReadonlySet<BronKind>>(
		filter.bronnen ? new Set(BRON_KINDS.filter((k) => !filter.bronnen!.has(k))) : new Set()
	);

	let compactFiltersOpen = $state(false);
	// Ronde 6: de zwevende legenda, dicht tot iemand hem opent; per browser onthouden.
	const LEGENDA = 'concordans:legenda';
	let legendaOpen = $state(false);
	$effect(() => {
		try {
			legendaOpen = localStorage.getItem(LEGENDA) === 'open';
		} catch {
			legendaOpen = false;
		}
	});
	const zetLegenda = (v: boolean) => {
		legendaOpen = v;
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
		const visible = new Set<string>();
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
			visible.add(id);
			nodes++;
		});
		g.forEachEdge((_id, attrs, src, tgt) => {
			if (attrs.layoutOnly) return;
			if (!visible.has(src) || !visible.has(tgt)) return;
			if (filters.hiddenRelations.has(attrs.relation as Relation)) return;
			edges++;
		});
		canvasCounts = { nodes, edges, kinds };
		drawnIds = [...visible];
	}

	$effect(() => {
		void hiddenKinds;
		void filters;
		countCanvas();
		canvas?.refresh();
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
		requestAnimationFrame(() => {
			fitScheduled = false;
			canvas?.fit();
		});
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
		keyNode = n;
		hoverAt = null;
		hoverNode = n;
	}
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let showTimer: ReturnType<typeof setTimeout> | null = null;

	// A stub (referenced, not loaded yet) has a paper fill and keeps the ring of its kind.
	function nodeColors(n: GraphNode): { color: string; borderColor: string } {
		const borderColor = strokeFor(n.kind);
		return { color: n.stub || n.kind === 'other' ? tokens().paper : fillFor(n.kind), borderColor };
	}

	const NODE_SIZE: Record<GraphNodeKind, number> = {
		article: 7,
		instrument: 9,
		judgment: 8,
		dossier: 11,
		committee: 10,
		faction: 10,
		member: 6.5,
		document: 6,
		activity: 5,
		other: 7
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
			scheduleFit();
		}, burst);
	}

	// Node label: one name per bron (bron/naam.ts), as in the netwerk panel.
	const nodeLabel = (n: GraphNode) => bronNaam(n, $instrumentMetaStore);

	// A container (a wet, fractie, commissie or dossier) is never a canvas node: its
	// children carry it as a hull instead (`syncContainerAnchors`, GraphCanvas). Nor
	// is a version, current-focus reader page or not: the network is about the
	// current text, and the reader reads a version's own data directly, not this
	// canvas.
	const isCanvasNode = (n: GraphNode) =>
		(n.anchor || !isContainerKind(n.kind)) && !isVersionCollection(n.collection);

	function syncNodes(nodes: GraphNode[]) {
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

		for (const n of nodes) {
			lookup.set(n.id, n);
			if (!isCanvasNode(n)) continue;
			const { color, borderColor } = nodeColors(n);
			// Ronde 5: elke bron als teken uit vormen.ts.
			const vorm = vormVan(n.id);
			const useImage = true;
			const stub = !!n.stub;
			const rawSize = nodeSize(n.id);
			const attrs: Record<string, unknown> = {
				label: nodeLabel(n),
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
					label: ''
				});
			const seed = n as GraphNode & { x?: number; y?: number };
			const seedHasPos = typeof seed.x === 'number' && typeof seed.y === 'number';
			if (g.hasNode(n.id)) {
				const merged = seedHasPos ? { ...attrs, x: seed.x, y: seed.y } : attrs;
				g.mergeNodeAttributes(n.id, merged);
			} else {
				let x: number, y: number;
				if (seedHasPos) {
					x = seed.x!;
					y = seed.y!;
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

	function syncEdges(allEdges: GraphEdge[]) {
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
		if (compact) return;
		// Ronde 6: de kaart staat naast de bron, niet los in een hoek.
		if (vx !== undefined && vy !== undefined && canvasWrap) {
			const W = 360, H = 240, GAP = 20;
			const w = canvasWrap.clientWidth, h = canvasWrap.clientHeight;
			const x = vx + GAP + W < w - 8 ? vx + GAP : Math.max(8, vx - GAP - W);
			const y = Math.min(Math.max(8, vy - 40), Math.max(8, h - H - 8));
			hoverAt = { x, y };
		}
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

	function handleNodeLeave() {
		if (compact) return;
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
				applyFilters();
			}),
			store.pinned.subscribe((s) => {
				pinnedIds = new Set(s);
				applyFilters();
			}),
			store.core.subscribe((c) => {
				coreIds = c;
				applyFilters();
			}),
			store.filters.subscribe((f) => {
				filters = f;
				applyFilters();
			}),
			containerMembershipStore.subscribe((groups) => {
				containerGroups = groups;
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

	function toggleRelation(r: Relation) {
		const next = new Set(filters.hiddenRelations);
		if (!next.delete(r)) next.add(r);
		store.setFilters({ hiddenRelations: next });
	}

	// The panel floating over the canvas, measured so that hull labels keep clear of it.
	let overlayHost = $state<HTMLDivElement | null>(null);
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

<svelte:window onkeydown={handleKeydown} />

{#snippet sidebar()}
	<GraphSidebar
		{verbonden}
		{filter}
		selectionCollection={selection?.collection ?? null}
		{onFilter}
		{onOpenFilter}
		{depth}
		{onDepth}
		hiddenRelations={filters.hiddenRelations}
		onToggleRelation={toggleRelation}
		{canvasCounts}
		{overlay}
		inFluxCount={inFluxMap.size}
		{netwerkActive}
		{onToggleHeat}
		{onHeatPeriodChange}
		{onToggleMutatie}
		{onResetGraph}
		{hasNodes}
	/>
{/snippet}

<div class="graph-view">
	<div class="graph-main">
		<!-- The bronnen on the canvas, for the keyboard: outside the canvas, so ← and →
		     keep stepping through the history there. -->
		<CanvasNodeList
			nodes={listNodes}
			isChosen={(id) => pinnedIds.has(id)}
			onFocusNode={onKeyNode}
			{onToggleChosen}
		/>
		<!-- The canvas takes the focus so that ← and → act on it, and only then. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="graph-canvas-wrap"
			bind:this={canvasWrap}
			role="application"
			aria-label="Netwerk. Pijl links en rechts: vorige en volgende bron."
			tabindex="0"
			onpointerenter={() => (fitFollows = false)}
			onpointerdown={() => canvasWrap?.focus({ preventScroll: true })}
			onwheel={() => (fitFollows = false)}
		>
			<div class="zoom" role="group" aria-label="Zoomen">
				<button
					type="button"
					class="zoom__btn"
					aria-label="Inzoomen"
					onclick={() => canvas?.zoom(1.5)}>+</button
				>
				<button
					type="button"
					class="zoom__btn"
					aria-label="Uitzoomen"
					onclick={() => canvas?.zoom(1 / 1.5)}>−</button
				>
				<button
					type="button"
					class="zoom__btn"
					aria-label="Alles in beeld"
					title="Alles in beeld"
					onclick={() => canvas?.fit()}>⤢</button
				>
			</div>
			{#if canvasOverlay}
				<div class="canvas-overlay" bind:this={overlayHost}>
					{@render canvasOverlay()}
				</div>
			{/if}
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
				externalHoveredId={hoverNode?.id ?? null}
				onNodeClick={(id) => {
					const n = lookup.get(id);
					if (n) onNodeClick?.(n);
				}}
				onNodeDoubleClick={(id) => {
					const n = lookup.get(id);
					if (n) onNodeDoubleClick?.(n);
				}}
				onEdgeClick={(id) => {
					const e = store.getEdgeById(id);
					if (e) onEdgeClick?.(e);
				}}
				onNodeHover={handleNodeHover}
				onNodeLeave={handleNodeLeave}
				onStageClick={() => onClear?.()}
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

			<!-- Ronde 6: de legenda zweeft boven het canvas, zoals het netwerkpaneel en de gids.
			     Dicht: de tekens van wat er staat. Open: filter, groepering en verbindingen. -->
			{#if !compact && canvasCounts.nodes > 0}
				<div class="r6-legenda" class:open={legendaOpen}>
					<button
						type="button"
						class="r6-legenda-kop"
						aria-expanded={legendaOpen}
						onclick={() => zetLegenda(!legendaOpen)}
					>
						<span class="r6-legenda-titel">Legenda</span>
						{#if !legendaOpen}
							{#each BRON_KINDS.filter((k) => (canvasCounts.kinds[k] ?? 0) > 0) as k (k)}
								<span class="r6-teken" title="{BRON_KIND_LABEL[k]}: {canvasCounts.kinds[k]}"
									><KindGlyph collection={BRON_KIND_COLLECTION[k]} size={11} /></span
								>
							{/each}
						{/if}
						<Caret open={legendaOpen} />
					</button>
					{#if legendaOpen}
						<div class="r6-legenda-inhoud">{@render sidebar()}</div>
					{/if}
				</div>
			{/if}
			{#if compact}
				<div class="compact-legend-wrap">
					<button
						type="button"
						class="btn compact-legend-btn"
						class:is-primary={compactFiltersOpen}
						onclick={() => (compactFiltersOpen = !compactFiltersOpen)}
						aria-expanded={compactFiltersOpen}>Legenda</button
					>
					{#if compactFiltersOpen}
						<div
							class="compact-legend-backdrop"
							role="presentation"
							onclick={() => (compactFiltersOpen = false)}
						></div>
						<div class="compact-legend-panel">
							{@render sidebar()}
						</div>
					{/if}
				</div>
			{/if}

			{#if hoverNode && (!compact || keyNode)}
				<GraphCitePanel
					node={hoverNode}
					isChosen={pinnedIds.has(hoverNode.id)}
					at={keyNode ? null : hoverAt}
					onOpen={() => {
						hoverNode = null;
					}}
					{onToggleChosen}
					onOmgeving={onNodeDoubleClick
						? (n) => {
								hoverNode = null;
								onNodeDoubleClick?.(n);
							}
						: undefined}
					onMouseEnter={cancelHide}
					onMouseLeave={() => {
						hoverNode = null;
					}}
				/>
			{/if}
		</div>
	</div>
</div>

<style>
	.graph-view {
		display: flex;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.graph-main {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.graph-canvas-wrap {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.graph-canvas-wrap:focus {
		outline: none;
	}
	.graph-canvas-wrap:focus-visible {
		outline: 2px solid var(--accent);
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
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		background: var(--paper);
		overflow: hidden;
	}
	.zoom__btn {
		width: 32px;
		height: 32px;
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-body-2);
		color: var(--ink-2);
		cursor: pointer;
	}
	.zoom__btn + .zoom__btn {
		border-top: 1px solid var(--rule);
	}
	.zoom__btn:hover {
		background: var(--paper-2);
		color: var(--ink);
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

	/* Ronde 6: de legenda links boven, een kaart zoals het netwerkpaneel rechts boven. */
	.r6-legenda {
		position: absolute;
		top: var(--s-3);
		left: var(--s-3);
		z-index: var(--z-float);
		max-height: calc(100% - 7rem);
		display: flex;
		flex-direction: column;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
	}
	.r6-legenda-kop {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-3);
		border: 0;
		background: none;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	.r6-legenda-kop:hover {
		color: var(--ink);
	}
	.r6-legenda-titel {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		color: var(--ink);
		margin-right: var(--s-1);
	}
	.r6-teken {
		display: inline-flex;
		color: var(--ink);
	}
	.r6-legenda-inhoud {
		overflow-y: auto;
		border-top: 1px solid var(--rule);
	}
	.r6-legenda-inhoud :global(.legend) {
		height: auto;
		border-right: 0;
		padding-top: var(--s-3);
	}

	/* Bottom left: the Netwerk panel holds the top of the canvas, the zoom the bottom right. */
	.compact-legend-wrap {
		position: absolute;
		bottom: var(--s-3);
		left: var(--s-3);
		z-index: var(--z-float);
	}

	.compact-legend-btn {
		background: var(--paper);
	}
	.compact-legend-btn:global(.is-primary) {
		background: var(--ink);
		color: var(--paper);
	}

	.compact-legend-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-float) - 1);
	}

	.compact-legend-panel {
		position: absolute;
		bottom: calc(100% + 6px);
		left: 0;
		max-height: calc(100vh - 160px);
		overflow-y: auto;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		z-index: var(--z-float);
	}
	.compact-legend-panel :global(.legend) {
		height: auto;
		border-right: 0;
	}

	@media (max-width: 768px) {
		.r6-legenda-inhoud :global(.legend) {
			width: min(250px, calc(100vw - 48px));
		}
	}
</style>

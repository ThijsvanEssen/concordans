<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import Graph from 'graphology';
	import type FA2LayoutType from 'graphology-layout-forceatlas2/worker';
	import GraphCanvas from './GraphCanvas.svelte';
	import type { GraphCanvasApi } from './GraphCanvas.svelte';
	import GraphCitePanel from './GraphCitePanel.svelte';
	import GraphSidebar from './GraphSidebar.svelte';
	import type { Snippet } from 'svelte';
	import type { GraphStore, GraphFilters } from '$lib/graph/graph-store';
	import type { GraphEdge, GraphNode, GraphNodeKind } from '$lib/graph/types';
	import { spriteFor, shapeFor, IMAGE_SIZE_BUMP } from './nodeSprites';
	import { instrumentMetaStore } from '$lib/api/instrument-cache';
	import { getLawIdFromProps } from '$lib/util/law-id';
	import type { NodeCounts } from '$lib/api/overlays';
	import type { Overlay } from '$lib/stores/overlay';
	import { DEFAULT_HEAT_MONTHS } from '$lib/stores/overlay';

	// ── Camera persistence across tab switches ────────────────────────────────
	// GraphView is unmounted/remounted whenever the user switches between Grafiek
	// and Gesplitst tabs (both use {#if}). Module-level state persists in the
	// same page session so we can restore the camera instead of re-fitting.
	// Keyed by compact so the full graph and the sidebar mini-graph don't share.
	const _cam: Record<string, { x: number; y: number; ratio: number } | null> = {
		full: null,
		compact: null
	};
	const _camNodeIds: Record<string, Set<string>> = { full: new Set(), compact: new Set() };

	let {
		store,
		compact = false,
		inFluxMap = new Map() as NodeCounts,
		heatMap = new Map() as NodeCounts,
		overlay = { kind: 'none' } as Overlay,
		visibleCount: visibleCountProp = 0,
		totalLoaded = 0,
		onNodeClick,
		onGoBack,
		onGoForward,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		onResetGraph,
		onRevealHidden,
		canvasOverlay
	}: {
		store: GraphStore;
		compact?: boolean;
		inFluxMap?: NodeCounts;
		heatMap?: NodeCounts;
		overlay?: Overlay;
		visibleCount?: number;
		totalLoaded?: number;
		onNodeClick?: (node: GraphNode) => void;
		onGoBack?: () => void;
		onGoForward?: () => void;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		onResetGraph?: () => void;
		/** Expand the focus again without the convergence prune. */
		onRevealHidden?: () => void;
		canvasOverlay?: Snippet;
	} = $props();

	// ── graphology (data + layout, no sigma) ─────────────────────────────────
	const g = new Graph();
	const lookup = new Map<string, GraphNode>();
	let canvas: GraphCanvasApi | null = null;

	// ── reactive state ────────────────────────────────────────────────────────
	let selection = $state<GraphNode | null>(null);
	let pinnedIds = $state<Set<string>>(new Set());
	let filters = $state<GraphFilters>(get(store.filters));
	let hasNodes = $state(false);
	let trimmedCount = $state(0);
	let trimmedDismissed = $state(false);
	let loadingMsg = $state<string | null>(null);
	let graphMode = $state<'expansion' | 'bulk'>('expansion');
	// Mirror of store.currentInstrumentBwb — non-null while the canvas is a
	// single-wet view (set by loadInstrument). Used by computeLevelSuppression
	// to relax the strict-Artikelen rule that would otherwise hide every
	// instrument node on the canvas, including the related-wet nodes the user
	// explicitly fetched via Lagen Wetten.
	let currentInstrumentBwb = $state<string | null>(null);

	// Wetten view (true): articles are hidden and each law is one instrument.
	// Artikelen view (false): instruments are hidden for laws whose articles are
	// on the canvas. A deliberate choice of the user: loading instruments must
	// not collapse the article view.
	let collapseToLaws = $state(false);

	// Instrument filter panel data
	let instruments = $state<{ bwbId: string; label: string; count: number }[]>([]);

	// Resolve pinned IDs to GraphNode objects for the sidebar list.
	const pinnedNodes = $derived.by<GraphNode[]>(() => {
		const list: GraphNode[] = [];
		for (const id of pinnedIds) {
			const n = lookup.get(id) ?? store.getNodeById(id);
			if (n) list.push(n);
		}
		return list;
	});

	// Compact-mode filter panel
	let compactFiltersOpen = $state(false);

	// Mobile sheet (full graph mode, narrow viewports)
	let mobileSidebarOpen = $state(false);

	// The synthetic instrument proxies exist only in Wetten view, where they are visible.
	$effect(() => {
		store.setCollapseToLaws(collapseToLaws);
		computeLevelSuppression();
		canvas?.refresh();
	});

	// Sidebar filter list: articles per law. Laws with a short title share one entry.
	function lawGroupKey(bwbId: string): string {
		return $instrumentMetaStore.get(bwbId)?.shortTitle ?? bwbId;
	}

	function computeInstruments() {
		const counts = new Map<string, number>();
		lookup.forEach((node) => {
			if (node.kind !== 'article') return;
			const p = node.raw?.props as Record<string, unknown> | undefined;
			const bwbId = getLawIdFromProps(p, node.key);
			if (bwbId) {
				const groupKey = lawGroupKey(bwbId);
				counts.set(groupKey, (counts.get(groupKey) ?? 0) + 1);
			}
		});
		instruments = [...counts.entries()]
			.map(([groupKey, count]) => {
				// groupKey is already the best human-readable key (shortTitle or bwbId)
				const instMeta = $instrumentMetaStore.get(groupKey);
				const label = instMeta?.citationTitle ?? instMeta?.title ?? groupKey;
				return { bwbId: groupKey, label, count };
			})
			.sort((a, b) => b.count - a.count);
	}

	// ── camera ────────────────────────────────────────────────────────────────
	// One rule: refit whenever the topology actually changes (nodes or edges
	// added/removed). Selection, hover, filter toggles do NOT touch the camera.
	// Calls coalesce within a frame so a node-add + edge-add only fits once.
	// skipNextFit is set when remounting with unchanged graph data — the camera
	// will be restored instead, so we must not overwrite it with a fit-all.
	let fitScheduled = false;
	let skipNextFit = false;
	// While `fitSuppressed` is true, syncNodes/syncEdges and runLayout's
	// settle-timer don't trigger a fit. The caller (explore page) raises this
	// before a load operation and lowers it via `fitWhenSettled` so we get one
	// clean fit at the end instead of a chain of jerky intermediate ones.
	let fitSuppressed = false;
	function scheduleFit() {
		if (skipNextFit || fitSuppressed) return;
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

	/** Re-centre the layout on `focalId` after a prune-only update. The store
	 *  delivered the post-prune node set via syncNodes, but every surviving
	 *  node kept its old position — so the new focal isn't visually central
	 *  and FA2 doesn't restart (no nodes added). This snaps the focal to the
	 *  origin, drops its level-1 onto a ring around it, places everything
	 *  else further out, leaves pinned nodes alone, and triggers a short FA2
	 *  burst with the focal pinned so the new positions settle naturally. */
	export function reseatAround(focalId: string) {
		if (!g.hasNode(focalId)) return;
		if (graphMode === 'bulk') return; // bulk has its own structural layout

		const pinnedSet = get(store.pinned);

		// Direct neighbours of the focal.
		const l1 = new Set<string>();
		g.forEachEdge((_id, _attrs, src, tgt) => {
			if (src === focalId) l1.add(tgt);
			else if (tgt === focalId) l1.add(src);
		});
		l1.delete(focalId);

		// Three buckets: focal, level-1 (movable, on inner ring), other movable
		// (convergence + path nodes, on outer ring). Pinned nodes are left in
		// place — the user explicitly anchored them.
		const l1List: string[] = [];
		const outerList: string[] = [];
		g.forEachNode((id) => {
			if (id === focalId) return;
			if (pinnedSet.has(id)) return;
			if (l1.has(id)) l1List.push(id);
			else outerList.push(id);
		});

		// Focal at origin.
		g.setNodeAttribute(focalId, 'x', 0);
		g.setNodeAttribute(focalId, 'y', 0);

		// Level-1 on inner ring. Radius grows with √N so dense neighbourhoods
		// don't pack on top of each other.
		const innerR = Math.max(120, 60 + Math.sqrt(l1List.length) * 30);
		l1List.forEach((id, i) => {
			const ang = (i / Math.max(l1List.length, 1)) * Math.PI * 2 - Math.PI / 2;
			g.setNodeAttribute(id, 'x', Math.cos(ang) * innerR);
			g.setNodeAttribute(id, 'y', Math.sin(ang) * innerR);
		});

		// Outer ring for convergence + path nodes. Half-step offset so they
		// don't sit radially behind the l1 nodes.
		const outerR = innerR + Math.max(140, Math.sqrt(outerList.length) * 30);
		outerList.forEach((id, i) => {
			const ang =
				(i / Math.max(outerList.length, 1)) * Math.PI * 2 -
				Math.PI / 2 +
				Math.PI / Math.max(l1List.length, 1);
			g.setNodeAttribute(id, 'x', Math.cos(ang) * outerR);
			g.setNodeAttribute(id, 'y', Math.sin(ang) * outerR);
		});

		// FA2 burst. Pass the movable set as `addedThisSync` so runLayout pins
		// the focal (and pinned) and only relaxes the
		// ring-seeded movables.
		const movable = new Set<string>([...l1List, ...outerList]);
		void runLayout(movable);
	}
	/** Lift the suppression and fire one final fit *after* FA2 has actually
	 *  stopped — not on a fixed timeout. Polls the layout's running flag every
	 *  100 ms until it settles (or a hard ceiling of 6 s for runaway graphs).
	 *  Ensures the camera fits the final positions, not an intermediate frame. */
	export function fitWhenSettled() {
		fitSuppressed = false;
		const FIT_MAX_WAIT_MS = 6000;
		const POLL_MS = 100;
		// Tiny grace period so any pending syncNodes/runLayout calls (queued by
		// the await chain that just resolved) get a chance to kick FA2 off again.
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

	// Hover CitationPanel state (only in graph/full mode)
	let hoverNode = $state<GraphNode | null>(null);
	let hideTimer: ReturnType<typeof setTimeout> | null = null;
	let showTimer: ReturnType<typeof setTimeout> | null = null;

	// ── node colors ───────────────────────────────────────────────────────────
	// Three domains: wetgeving (ink), rechtspraak (indigo) and parlement. Parlement
	// has three families in which a leaf takes the hue of its hub, so that
	// "document belongs to dossier" reads before the kind is identified:
	//   dossier (spine)   : dossier solid, document
	//   committee (ochre) : committee solid, activity
	//   faction (slate)   : faction solid, member
	const NODE_COLOR: Record<GraphNodeKind, string> = {
		article: '#1A1814',
		instrument: '#1A1814',
		judgment: '#2B3A5C',
		dossier: '#7A1F1A',
		committee: '#8A6A1F',
		faction: '#44505E',
		member: '#44505E',
		document: '#7A1F1A',
		activity: '#8A6A1F',
		other: '#9A9485'
	};
	const PAPER = '#FFFDF4';

	// A stub (referenced, not loaded yet) has a paper fill and keeps the ring of
	// its kind, so it stays recognisable when zoomed out.
	function nodeColors(n: GraphNode): { color: string; borderColor: string } {
		const borderColor = NODE_COLOR[n.kind];
		return { color: n.stub || n.kind === 'other' ? PAPER : borderColor, borderColor };
	}

	// Size encodes hub versus leaf within a domain; sizes across domains stay close
	// so no domain dominates the layout.
	const NODE_SIZE: Record<GraphNodeKind, number> = {
		article: 7,
		instrument: 9,
		judgment: 8,
		// Parliamentary hubs are larger than their leaves.
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
		// Bulk-loaded nodes (e.g. instrument-layer/judgment-layer) carry degree-scaled size.
		const seeded = (n as GraphNode & { size?: number }).size;
		if (typeof seeded === 'number') return seeded;
		return NODE_SIZE[n.kind];
	}

	// Mutual exclusion between an instrument and its articles: the Detail-niveau
	// toggle decides which one shows (see computeLevelSuppression). Stored as a
	// `suppressedByLevel` attribute that the canvas reducers respect.
	function computeLevelSuppression() {
		if (g.order === 0) return;
		// Strict mode: Wetten view shows only instruments (real + synth proxies);
		// Artikelen view shows only articles. The synth-proxy machinery in the
		// store materialises an instrument stand-in for every orphan article-bwb
		// when collapseToLaws is true, so hiding every article in that mode still
		// leaves each wet represented. In Artikelen mode the store drops those
		// proxies and we hide every real instrument.
		//
		// 'other' (unclassified) nodes are hidden in both strict modes — they
		// belong to no layer, the sidebar can't toggle them, and leaving them
		// visible only adds noise. The focal node is never suppressed regardless
		// of kind, so the user always sees what they selected.
		//
		// Effective mode: a strict toggle wipes the canvas if the user's chosen
		// mode has nothing to render (e.g. Artikelen view on a fresh Wetten layer
		// — zero articles to show). Mirror the Sidebar's Detail-niveau control,
		// which already disables the Artikelen tab when no articles are loaded:
		// flip the mode to match what's actually on canvas so the bulk overview
		// is visible instead of empty.
		//
		// Focus scope: when an instrument is the focal node in Artikelen view,
		// restrict the canvas to the focal + its own articles (same bwb) + the
		// articles those articles reference directly. Everything else hides for
		// the duration of that selection so the user gets a clean "this law's
		// articles and where they point" picture without unrelated traffic.
		let hasArticles = false;
		let hasInstruments = false;
		g.forEachNode((_id, attrs) => {
			if (attrs.kind === 'article') hasArticles = true;
			else if (attrs.kind === 'instrument') hasInstruments = true;
		});
		let effectiveCollapse = collapseToLaws;
		if (!effectiveCollapse && !hasArticles) effectiveCollapse = true;
		if (effectiveCollapse && !hasInstruments) effectiveCollapse = false;

		const focalId = selection?.id ?? null;
		const focalAttrs =
			focalId && g.hasNode(focalId)
				? {
						kind: g.getNodeAttribute(focalId, 'kind') as string | undefined,
						bwb: g.getNodeAttribute(focalId, 'bwb') as string | undefined
					}
				: null;

		let scope: Set<string> | null = null;
		if (!effectiveCollapse && focalId && focalAttrs?.kind === 'instrument' && focalAttrs.bwb) {
			const focalBwb = focalAttrs.bwb;
			// Bulk-overview safety belt: if the canvas carries 3+ other instruments
			// whose own articles aren't on canvas, we're sitting in a Wetten Lagen
			// overview. Scoping there would wipe the whole overview to just the
			// focal — the opposite of what the user wants. Skip scope and let the
			// standard strict rules apply (which here means effective Wetten when
			// few articles are present, otherwise normal Artikelen).
			const articleBwbs = new Set<string>();
			g.forEachNode((_id, attrs) => {
				if (attrs.kind === 'article') {
					const b = attrs.bwb as string | undefined;
					if (b) articleBwbs.add(b);
				}
			});
			let orphanInstrumentCount = 0;
			g.forEachNode((id, attrs) => {
				if (id === focalId) return;
				if (attrs.kind !== 'instrument') return;
				const b = attrs.bwb as string | undefined;
				if (!b || !articleBwbs.has(b)) orphanInstrumentCount++;
			});

			if (orphanInstrumentCount < 3) {
				scope = new Set<string>([focalId]);
				// Step 1: articles belonging to the focal law.
				g.forEachNode((id, attrs) => {
					if (attrs.kind === 'article' && (attrs.bwb as string | undefined) === focalBwb) {
						scope!.add(id);
					}
				});
				// Step 2: articles referenced by those — one hop, article→article only.
				// Walk both directions so inbound citations from other wets land too.
				const lawArticles = [...scope];
				for (const aid of lawArticles) {
					if (aid === focalId) continue;
					g.forEachNeighbor(aid, (nid, nattrs) => {
						if (nattrs.kind === 'article') scope!.add(nid);
					});
				}
				// No articles of this law on canvas yet → don't scope to {focal}
				// alone; fall through to the normal strict rules so the user sees
				// surrounding context instead of a single floating instrument.
				if (scope.size <= 1) scope = null;
			}
		}

		// Wet view exception: in a single-wet bulk view (loadInstrument →
		// currentInstrumentBwb set), the user is looking at "this wet's articles
		// + whatever extra context the Lagen handlers add". The Artikelen-mode
		// rule that hides every instrument is wrong here — related-wet
		// instruments added via Lagen Wetten are exactly what the user asked
		// for. Skip the kind-based suppression and let articles + instruments
		// coexist. Focus scope still applies if a focal is selected.
		const inWetView = currentInstrumentBwb !== null;

		g.forEachNode((id, attrs) => {
			if (id === focalId) {
				g.setNodeAttribute(id, 'suppressedByLevel', false);
				return;
			}
			let suppress = false;
			if (scope) {
				if (!scope.has(id)) suppress = true;
			} else if (inWetView) {
				// Wet view: only suppress 'other' (unclassified) noise. Articles
				// and instruments both visible.
				if (attrs.kind === 'other') suppress = true;
			} else if (effectiveCollapse) {
				if (attrs.kind === 'article' || attrs.kind === 'other') suppress = true;
			} else {
				if (attrs.kind === 'instrument' || attrs.kind === 'other') suppress = true;
			}
			g.setNodeAttribute(id, 'suppressedByLevel', suppress);
		});
	}

	// Focus styling (node fill, edge dimming) lives in sigma's reducers, so a
	// selection change re-runs them once per frame instead of rewriting
	// attributes on hundreds of nodes and edges.
	function applyFilters() {
		computeLevelSuppression();
		canvas?.refresh();
	}

	// When the instrument cache updates (e.g. shortTitle "Sr" arrives in the
	// background), refresh node labels so existing graphology nodes pick it
	// up. Cheap: only writes the label attribute, no topology change.
	$effect(() => {
		void $instrumentMetaStore;
		if (g.order === 0) return;
		g.forEachNode((id) => {
			const n = lookup.get(id);
			if (n) g.setNodeAttribute(id, 'label', nodeLabel(n));
		});
		canvas?.refresh();
		computeInstruments();
	});

	// Worker-based forceAtlas2 layout — runs continuously off the main thread
	// and animates positions until we stop it. Sigma re-renders automatically
	// when graphology emits node-attribute updates.
	let layout: FA2LayoutType | null = null;
	let layoutStopTimer: ReturnType<typeof setTimeout> | null = null;
	let layoutPromise: Promise<void> | null = null;

	async function ensureLayout() {
		if (layout) return;
		if (!layoutPromise) {
			layoutPromise = (async () => {
				const { default: FA2Layout } = await import('graphology-layout-forceatlas2/worker');
				// Force-layout is only used for small expansion graphs; bulk loads
				// are positioned structurally and skip fa2 entirely.
				// Spread the graph wider to use the available canvas space.
				// scalingRatio is the dominant spread knob — higher = stronger
				// repulsion between nodes. gravity stays low so the layout doesn't
				// collapse to a single dense ball when the graph grows large.
				layout = new FA2Layout(g, {
					settings: {
						gravity: 0.25,
						// Heavier repulsion so nodes have breathing room — at the previous
						// 12, dense clusters became unreadable. 30 keeps labels legible
						// even when several layers are stacked.
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

		// Bulk graphs use the pre-computed structural ring positions — no force
		// layout needed. Camera fit is triggered by syncNodes/syncEdges via
		// scheduleFit, so we don't need to touch it here.
		if (graphMode === 'bulk') return;

		// Pin every existing node whenever ANY new node arrives. FA2 only moves
		// the newcomers; established context stays put regardless of batch size.
		// Combined with the ring-seeded initial positions in syncNodes, this
		// eliminates the "everything wobbles when new stuff arrives" feel.
		// graphology-layout-forceatlas2 honours the `fixed` attribute. We unpin
		// after the burst so big-bulk loads can later relax the whole layout.
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
			// Unpin if we bailed before starting
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
		// Burst length:
		//  - Pinning + ring-seeded newcomers: FA2 only nudges newcomers into the
		//    gaps. ~500 ms is plenty.
		//  - No prior nodes / no pinning (first load): full burst.
		const burst = pinExisting
			? Math.min(800, 350 + (addedThisSync?.size ?? 0) * 18)
			: Math.min(2500, 600 + g.order * 6);
		layoutStopTimer = setTimeout(() => {
			layout?.stop();
			// Release the pin so subsequent big additions can relax everything again.
			for (const id of pinnedDuringBurst) {
				try {
					g.removeNodeAttribute(id, 'fixed');
				} catch {
					/* gone */
				}
			}
			// Layout finished moving nodes around — fit once at rest.
			scheduleFit();
		}, burst);
	}

	// Node label. An article gets the short title of its law when known ("Art. 287 Sr");
	// an instrument the best name the cache or its props offer. Both read the
	// instrument cache, so labels refresh when it resolves.
	function nodeLabel(n: GraphNode): string {
		const p = n.raw?.props ?? undefined;
		if (n.kind === 'instrument') {
			const meta = $instrumentMetaStore.get(getLawIdFromProps(p, n.key) ?? n.key);
			return (
				meta?.shortTitle ??
				meta?.citationTitle ??
				(p?.['citation_title'] as string | undefined) ??
				(p?.['title'] as string | undefined) ??
				n.label
			);
		}
		if (n.kind !== 'article') return n.label;
		const bwb = getLawIdFromProps(p, n.key);
		const shortTitle = bwb ? $instrumentMetaStore.get(bwb)?.shortTitle : null;
		return shortTitle ? `${n.label} ${shortTitle}` : n.label;
	}

	function syncNodes(nodes: GraphNode[]) {
		const camKey = compact ? 'compact' : 'full';
		const newIds = new Set(nodes.map((n) => n.id));
		const prev = _camNodeIds[camKey];
		const sameGraph =
			prev.size > 0 && newIds.size === prev.size && [...newIds].every((id) => prev.has(id));
		// Additive expansion: every previous node still present (superset). Keep
		// the user's viewport; new nodes settle into existing context. Only refit
		// when the topology actually changes (drops or wholesale replacement).
		const additive =
			prev.size > 0 && newIds.size >= prev.size && [...prev].every((id) => newIds.has(id));
		if (sameGraph && _cam[camKey]) {
			// Remount with identical graph data — restore camera, suppress fit-all.
			skipNextFit = true;
		} else if (additive) {
			skipNextFit = true;
		} else {
			// New data: clear any saved camera so we don't restore a stale position.
			_cam[camKey] = null;
			skipNextFit = false;
		}
		_camNodeIds[camKey] = newIds;

		let changed = false;
		const addedThisSync = new Set<string>();
		const keep = newIds;
		const toDrop = g.nodes().filter((id) => !keep.has(id));

		// Only use the atomic g.clear() shortcut for wholesale replacements — i.e.
		// when *nothing* from the previous graph survives. A partial prune (e.g.
		// the convergence prune at the end of node expansion) drops some nodes
		// but keeps others; clearing + re-adding loses every kept node's position
		// and kills the FA2 worker mid-burst, snapping the whole layout. Use
		// individual drops there so kept nodes retain their settled coordinates.
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
		// Pre-pass: count newcomers that need a seeded position so we can lay
		// them out on a ring instead of all piling at the focal node. FA2 then
		// only refines, no big explosion.
		let unseededCount = 0;
		for (const n of nodes) {
			if (g.hasNode(n.id)) continue;
			const seed = n as GraphNode & { x?: number; y?: number };
			if (typeof seed.x !== 'number' || typeof seed.y !== 'number') unseededCount++;
		}
		const focalIdForSeed = selection && g.hasNode(selection.id) ? selection.id : null;
		const fxSeed = focalIdForSeed ? ((g.getNodeAttribute(focalIdForSeed, 'x') as number) ?? 0) : 0;
		const fySeed = focalIdForSeed ? ((g.getNodeAttribute(focalIdForSeed, 'y') as number) ?? 0) : 0;
		// Ring radius scales with incoming count so dense expansions don't
		// overlap. The √N factor matches typical FA2 settling extents.
		const seedRingR = Math.max(18, 8 + Math.sqrt(Math.max(unseededCount, 1)) * 7);
		let seededIdx = 0;

		for (const n of nodes) {
			lookup.set(n.id, n);
			const { color, borderColor } = nodeColors(n);
			// bwb attribute: lets the mutual-exclusion pass match an article to its instrument.
			const bwb =
				n.kind === 'article' || n.kind === 'instrument'
					? (
							getLawIdFromProps(n.raw?.props ?? undefined, n.key) ??
							(n.kind === 'instrument' ? n.key : '')
						).toLowerCase() || undefined
					: undefined;
			// Shape per kind (see nodeSprites.KIND_SHAPE). Circles use sigma's
			// border program — its two-ring composition gives the cleanest selection
			// ring for the densest node class. Everything else renders as an SVG
			// sprite via NodeImageProgram, with the kind colour baked into the
			// sprite. For sprite nodes we zero the node-level `color` so the
			// background-mode shader doesn't paint a coloured square behind the
			// shape (the SVG already contains all the colour we need).
			const shape = shapeFor(n.kind);
			const useImage = shape !== 'circle';
			const stub = !!n.stub;
			const rawSize = nodeSize(n.id);
			const attrs: Record<string, unknown> = {
				label: nodeLabel(n),
				color: useImage ? 'rgba(0,0,0,0)' : color,
				borderColor,
				kind: n.kind,
				stub,
				bwb,
				// Sprite-rendered nodes are visually smaller than border-rendered
				// circles at the same nominal size (see IMAGE_SIZE_BUMP in
				// nodeSprites.ts). Bump so the visual weight matches.
				size: useImage ? rawSize * IMAGE_SIZE_BUMP : rawSize,
				type: useImage ? 'image' : 'border'
			};
			if (useImage) attrs.image = spriteFor(n.kind, stub, false);
			const seed = n as GraphNode & { x?: number; y?: number };
			const seedHasPos = typeof seed.x === 'number' && typeof seed.y === 'number';
			if (g.hasNode(n.id)) {
				// If the new payload carries a seed position (e.g. bulk load with the
				// structural ring) overwrite x/y; otherwise keep the existing layout.
				const merged = seedHasPos ? { ...attrs, x: seed.x, y: seed.y } : attrs;
				g.mergeNodeAttributes(n.id, merged);
			} else {
				// Place newcomers on a ring around the focal node — spread out by
				// construction, so FA2's job shrinks to local refinement and the
				// "explode from a tight pile" wobble is gone.
				let x: number, y: number;
				if (seedHasPos) {
					x = seed.x!;
					y = seed.y!;
				} else {
					const angle = (seededIdx / Math.max(unseededCount, 1)) * Math.PI * 2;
					// Tiny per-node jitter to break perfect symmetry — FA2 settles
					// faster when nodes aren't exactly equidistant.
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
		hasNodes = lookup.size > 0;
		applyFilters();
		if (changed) scheduleFit();
		runLayout(addedThisSync);
		computeInstruments();
	}

	function syncEdges(es: GraphEdge[]) {
		let changed = false;
		const keep = new Set(es.map((e) => e.id));
		g.edges()
			.filter((id) => !keep.has(id))
			.forEach((id) => {
				g.dropEdge(id);
				changed = true;
			});
		for (const e of es) {
			// The canvas reducer chooses the drawing type (arrow, or dashed for votes).
			const attrs = {
				relation: e.relation,
				confidence: e.confidence ?? null,
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
					// A parallel edge between this source/target already exists with a
					// different key (e.g. strict + semantic). Graphology's simple graph
					// forbids duplicates; silently skip the redundant edge.
				}
			}
		}
		applyFilters();
		if (changed) scheduleFit();
	}

	// ── canvas event handlers ─────────────────────────────────────────────────
	// The panel opens only after the pointer rests on a node for 400 ms.
	// Sweeping across a dense network would otherwise request an article per source.
	function handleNodeHover(nodeId: string, _vx: number, _vy: number) {
		if (compact) return;
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

	// ── mount: wire up store subscriptions ───────────────────────────────────

	onMount(() => {
		const unsub = [
			// graphMode must be set before nodes/edges so runLayout() sees the
			// correct mode when syncNodes fires on mount (bulk → skip FA2).
			store.graphMode.subscribe((m) => {
				graphMode = m;
			}),
			store.currentInstrumentBwb.subscribe((b) => {
				currentInstrumentBwb = b;
				// Suppression rules depend on wet-view state, so refresh whenever it changes.
				applyFilters();
			}),
			store.trimmedCount.subscribe((n) => {
				trimmedCount = n;
			}),
			store.nodes.subscribe(syncNodes),
			store.edges.subscribe(syncEdges),
			store.selection.subscribe((n) => {
				// No camera move — sigma's nodeReducer paints the focus ring and the
				// user keeps their current viewport. They can use "passend" to refit.
				selection = n;
				// Focus scope in Artikelen view depends on the selection, so re-run
				// suppression whenever the focal changes.
				applyFilters();
			}),
			store.loading.subscribe((s) => {
				if (s.kind === 'idle') {
					loadingMsg = null;
					return;
				}
				if (s.kind === 'parliamentary') {
					loadingMsg = s.phase === 'fetching' ? 'Parlementaire data ophalen…' : 'Netwerk opbouwen…';
				} else {
					loadingMsg = s.phase === 'fetching' ? 'Wet ophalen…' : 'Netwerk opbouwen…';
				}
			}),
			store.pinned.subscribe((s) => {
				pinnedIds = new Set(s);
				applyFilters();
			}),
			store.filters.subscribe((f) => {
				filters = f;
				applyFilters();
			})
		];
		return () => unsub.forEach((u) => u());
	});

	onDestroy(() => {
		if (layoutStopTimer) clearTimeout(layoutStopTimer);
		layout?.kill();
		layout = null;
	});

	// ── keyboard shortcuts ────────────────────────────────────────────────────
	function handleKeydown(e: KeyboardEvent) {
		if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
		if (e.key === 'ArrowLeft' && onGoBack) {
			e.preventDefault();
			onGoBack();
		}
		if (e.key === 'ArrowRight' && onGoForward) {
			e.preventDefault();
			onGoForward();
		}
		if (e.key === 'Escape') store.setSelection(null);
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#snippet sidebar()}
	<GraphSidebar
		{filters}
		{instruments}
		{overlay}
		inFluxCount={inFluxMap.size}
		{pinnedNodes}
		onInstrumentToggle={(bwbId) => {
			const next = new Set(filters.activeInstruments);
			if (!next.delete(bwbId)) next.add(bwbId);
			store.setFilters({ activeInstruments: next });
		}}
		{collapseToLaws}
		onCollapseToLawsChange={(v) => {
			collapseToLaws = v;
		}}
		{onToggleHeat}
		{onHeatPeriodChange}
		{onToggleMutatie}
		{onResetGraph}
		{hasNodes}
		hasSelection={selection != null}
		hiddenCount={Math.max(0, totalLoaded - visibleCountProp)}
		{onRevealHidden}
		onUnpin={(id) => store.unpinNode(id)}
		onClearPins={() => {
			for (const id of pinnedIds) store.unpinNode(id);
		}}
	/>
{/snippet}

<div class="graph-view">
	<!-- Sidebar (legend + filters, non-compact only) -->
	{#if !compact}
		<button
			type="button"
			class="mobile-filter-toggle"
			class:mobile-filter-toggle--open={mobileSidebarOpen}
			onclick={() => (mobileSidebarOpen = !mobileSidebarOpen)}
			aria-expanded={mobileSidebarOpen}
			aria-label="Filters"
		>
			<svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
				<path
					d="M2 4h12M4 8h8M6 12h4"
					stroke="currentColor"
					stroke-width="1.5"
					stroke-linecap="round"
				/>
			</svg>
			Filters
		</button>
		<div class="graph-sidebar-wrap" class:graph-sidebar-wrap--open={mobileSidebarOpen}>
			{@render sidebar()}
		</div>
		{#if mobileSidebarOpen}
			<div
				class="mobile-sidebar-backdrop"
				role="presentation"
				onclick={() => (mobileSidebarOpen = false)}
			></div>
		{/if}
	{/if}

	<!-- Canvas column -->
	<div class="graph-main" class:graph-main--with-panel={!compact && selection != null}>
		<div class="graph-canvas-wrap">
			{#if canvasOverlay}
				{@render canvasOverlay()}
			{/if}
			<GraphCanvas
				graph={g}
				focusedId={selection?.id ?? null}
				{filters}
				{pinnedIds}
				{collapseToLaws}
				{graphMode}
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
				onNodeHover={handleNodeHover}
				onNodeLeave={handleNodeLeave}
				onStageClick={() => store.setSelection(null)}
				onReady={(api) => {
					canvas = api;
					canvas.refresh();
					const camKey = compact ? 'compact' : 'full';
					if (skipNextFit && _cam[camKey]) {
						// Tab switch with same graph data — restore previous viewport.
						canvas.restoreCamera(_cam[camKey]!);
						skipNextFit = false;
					} else {
						// First mount or new data: fit now. syncNodes fired before sigma
						// was ready so its scheduleFit RAF was a no-op (canvas was null).
						canvas.fit();
					}
				}}
				onCameraChange={(state) => {
					_cam[compact ? 'compact' : 'full'] = state;
				}}
			/>

			{#if compact}
				<div class="compact-filter-wrap">
					<button
						type="button"
						class="compact-filter-btn"
						class:compact-filter-btn--active={compactFiltersOpen}
						onclick={() => (compactFiltersOpen = !compactFiltersOpen)}
						aria-label="Filters"
						aria-expanded={compactFiltersOpen}
						title="Filters"
					>
						<svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
							<path
								d="M2 4h12M4 8h8M6 12h4"
								stroke="currentColor"
								stroke-width="1.5"
								stroke-linecap="round"
							/>
						</svg>
						Filters
					</button>
					{#if compactFiltersOpen}
						<div
							class="compact-filter-backdrop"
							role="presentation"
							onclick={() => (compactFiltersOpen = false)}
						></div>
						<div class="compact-filter-panel">
							{@render sidebar()}
						</div>
					{/if}
				</div>
			{/if}

			{#if loadingMsg}
				<div class="graph-loading-banner" role="status" aria-live="polite">
					<span class="graph-loading-banner__dot" aria-hidden="true"></span>
					<span>{loadingMsg}</span>
				</div>
			{/if}

			<!-- Node cap notification -->
			{#if trimmedCount > 0 && !trimmedDismissed}
				<div class="trimmed-notice" role="status">
					<span class="trimmed-notice__text"
						>{trimmedCount} oudste {trimmedCount === 1 ? 'bron' : 'bronnen'} verwijderd. Het netwerk telt
						meer dan 400 bronnen.</span
					>
					<button
						type="button"
						class="trimmed-notice__close"
						onclick={() => (trimmedDismissed = true)}
						aria-label="Melding sluiten"
					>
						<svg width="10" height="10" viewBox="0 0 10 10" fill="none" aria-hidden="true">
							<line
								x1="1.5"
								y1="1.5"
								x2="8.5"
								y2="8.5"
								stroke="currentColor"
								stroke-width="1.4"
								stroke-linecap="round"
							/>
							<line
								x1="8.5"
								y1="1.5"
								x2="1.5"
								y2="8.5"
								stroke="currentColor"
								stroke-width="1.4"
								stroke-linecap="round"
							/>
						</svg>
					</button>
				</div>
			{/if}

			<!-- Hover citation panel -->
			{#if !compact && hoverNode}
				<GraphCitePanel
					node={hoverNode}
					isPinned={pinnedIds.has(hoverNode.id)}
					onOpen={(n) => {
						hoverNode = null;
						onNodeClick?.(n);
					}}
					onTogglePin={(n) => {
						store.togglePin(n.id);
					}}
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

	/* ── Canvas wrap ─────────────────────────────────────────────────────── */
	.graph-canvas-wrap {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.trimmed-notice {
		position: absolute;
		bottom: var(--s-3);
		left: 50%;
		transform: translateX(-50%);
		z-index: 5;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 5px 8px 5px 12px;
		background: var(--paper);
		border: 1px solid var(--ochre-faint, #f5e8c0);
		border-radius: 999px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		box-shadow: 0 2px 8px rgba(20, 18, 14, 0.06);
		white-space: nowrap;
		pointer-events: auto;
	}
	.trimmed-notice__text {
		flex: 1;
	}
	.trimmed-notice__close {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 18px;
		height: 18px;
		background: none;
		border: none;
		border-radius: 50%;
		cursor: pointer;
		color: var(--ink-4);
		padding: 0;
		flex-shrink: 0;
	}
	.trimmed-notice__close:hover {
		background: var(--paper-3);
		color: var(--ink);
	}

	/* ── Compact filter button (split mode) ─────────────────────────────── */
	.compact-filter-wrap {
		position: absolute;
		top: var(--s-3);
		left: var(--s-3);
		z-index: var(--z-float);
	}

	.compact-filter-btn {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		height: 26px;
		padding: 0 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		cursor: pointer;
		box-shadow: var(--shadow-sm);
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.compact-filter-btn:hover,
	.compact-filter-btn--active {
		background: var(--paper-2);
		color: var(--ink);
	}

	.compact-filter-backdrop {
		position: fixed;
		inset: 0;
		z-index: calc(var(--z-float) - 1);
	}

	.compact-filter-panel {
		position: absolute;
		top: calc(100% + 6px);
		left: 0;
		width: 220px;
		max-height: calc(100vh - 140px);
		overflow-y: auto;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		z-index: var(--z-float);
	}

	/* Loading banner at the top of the canvas; the network stays interactive. */
	.graph-loading-banner {
		position: absolute;
		top: var(--s-3);
		left: 50%;
		transform: translateX(-50%);
		z-index: var(--z-float);
		display: inline-flex;
		align-items: center;
		gap: 8px;
		height: 26px;
		padding: 0 12px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: 999px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		box-shadow: var(--shadow-sm);
		pointer-events: none;
	}
	.graph-loading-banner__dot {
		width: 8px;
		height: 8px;
		background: var(--spine);
		border-radius: 50%;
		animation: graph-loading-pulse 1.1s ease-in-out infinite;
	}
	@keyframes graph-loading-pulse {
		0%,
		100% {
			opacity: 0.3;
			transform: scale(0.7);
		}
		50% {
			opacity: 1;
			transform: scale(1.1);
		}
	}

	/* Mobile filter sheet (full graph mode only) */
	.mobile-filter-toggle {
		display: none;
		position: absolute;
		top: var(--s-3);
		left: var(--s-3);
		z-index: var(--z-float);
		align-items: center;
		gap: 5px;
		height: 28px;
		padding: 0 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		cursor: pointer;
		box-shadow: var(--shadow-sm);
	}
	.mobile-filter-toggle:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.mobile-sidebar-backdrop {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.2);
		z-index: calc(var(--z-float) - 1);
	}

	@media (max-width: 768px) {
		.mobile-filter-toggle {
			display: inline-flex;
		}
		.graph-sidebar-wrap {
			position: fixed;
			top: 64px;
			left: 0;
			bottom: 0;
			width: 240px;
			z-index: var(--z-float);
			background: var(--paper);
			border-right: 1px solid var(--rule);
			transform: translateX(-100%);
			transition: transform var(--dur-1) var(--ease);
		}
		.graph-sidebar-wrap--open {
			transform: translateX(0);
		}
		.mobile-sidebar-backdrop {
			display: block;
		}
	}
</style>

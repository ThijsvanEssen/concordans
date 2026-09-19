<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { track } from '$lib/analytics';
	import { createGraphStore, type GraphFilters } from '$lib/graph/graph-store';
	import GraphView from '$lib/components/graph/GraphView.svelte';
	import KindReader from '$lib/components/explore/KindReader.svelte';
	import CitationRail from '$lib/components/explore/CitationRail.svelte';
	import StatusBar from '$lib/components/explore/StatusBar.svelte';
	import LezenNav from '$lib/components/explore/LezenNav.svelte';
	import EmptyCanvas from '$lib/components/explore/EmptyCanvas.svelte';
	import WalkthroughCard from '$lib/components/explore/WalkthroughCard.svelte';
		import WholeLawReader from '$lib/components/explore/WholeLawReader.svelte';
	import IndexView from '$lib/components/explore/IndexView.svelte';
	import { get } from 'svelte/store';
	import { SvelteSet } from 'svelte/reactivity';
	import { perfStart } from '$lib/util/perf';
	import type { GraphNode } from '$lib/graph/types';
	import { kindsForLayer } from '$lib/graph/types';
	import { parseOverlay, DEFAULT_HEAT_MONTHS, type Overlay } from '$lib/stores/overlay';
	import {
		fetchInFluxMap,
		fetchHeatMap,
		fetchDossierInFluxMap,
	} from '$lib/api/parliamentary-client';
	import type { InFluxMap, HeatMap } from '$lib/api/parliamentary';

	// One store for the lifetime of this page — survives mode switches.
	const store = createGraphStore();

	// Single source of truth for "currently selected node": the store. We
	// mirror it via a Svelte store subscription so the rest of the page (status
	// bar, reader, citation rail) stays declarative.
	let selectedNode = $state<GraphNode | null>(null);
	store.selection.subscribe((n) => {
		selectedNode = n;
	});

	// Empty-graph signal drives the launch pad in graph mode.
	let nodeCount = $state(0);
	let firstNodeTracked = false;
	store.nodes.subscribe((ns) => {
		nodeCount = ns.length;
		if (ns.length > 0 && !firstNodeTracked) {
			firstNodeTracked = true;
			const kind = ns[0]?.kind ?? 'unknown';
			track('first_node', { kind });
		}
	});


	let focusError = $state<string | null>(null);
	let loadingGlobal = $state(false);
	let loadingJudgments = $state(false);
	let loadingCommissies = $state(false);
	let loadingDossiers = $state(false);
	let canGoBack = $state(false);
	let canGoForward = $state(false);
	store.canGoBack.subscribe((v) => {
		canGoBack = v;
	});
	// Track whether the canvas is showing a single wet's article set (set by
	// loadInstrument). Lagen handlers route to wet-scoped endpoints when this
	// is non-null instead of dumping the global layer onto the canvas.
	let currentInstrumentBwb = $state<string | null>(null);
	store.currentInstrumentBwb.subscribe((v) => {
		currentInstrumentBwb = v;
	});
	store.canGoForward.subscribe((v) => {
		canGoForward = v;
	});

	const mode = $derived($page.url.searchParams.get('mode') ?? 'graph');
	const trackedModes = new Set<string>();
	$effect(() => {
		if ((mode === 'split' || mode === 'read') && !trackedModes.has(mode)) {
			trackedModes.add(mode);
			track('mode_used', { mode });
		}
	});
	// For Lezen mode: prefer ?wet=BWBR... in the URL, otherwise infer from the
	// currently selected article so reading mode can show the whole law. Als
	// laatste fallback gebruiken we de instrument-focus van de graph-store
	// (entry via /explore?focus=instruments/BWBR…), zodat Lezen ook werkt
	// wanneer alleen een wet is gefocust zonder dat een specifiek artikel
	// is geselecteerd.
	const wholeLawBwb = $derived.by(() => {
		const w = $page.url.searchParams.get('wet');
		if (w) return w;
		if (selectedNode?.collection === 'instrument_articles') {
			const p = selectedNode.raw?.props as Record<string, unknown> | undefined;
			const bwb = (p?.['bwb_id'] as string | null) ?? (p?.['celex'] as string | null) ?? null;
			if (bwb) return bwb;
			const artNum = (p?.['article_number'] as string | null) ?? null;
			if (artNum && selectedNode.key.endsWith('_' + artNum)) {
				return selectedNode.key.slice(0, -(artNum.length + 1)) || null;
			}
		}
		// Wet-focus zonder geselecteerd artikel — Lezen toont dan de hele wet.
		if (currentInstrumentBwb) return currentInstrumentBwb;
		return null;
	});
	const showWholeLaw = $derived(
		!$page.url.searchParams.get('focus') ||
			$page.url.searchParams.get('wet') !== null ||
			(currentInstrumentBwb !== null && !selectedNode)
	);

	// Article list from LezenNav — used to compute prev/next article navigation.
	let navItems = $state<{ key: string; label: string }[]>([]);
	const selectedArticleIndex = $derived(
		selectedNode ? navItems.findIndex((it) => it.key === selectedNode!.key) : -1
	);
	const prevArticleKey = $derived(
		selectedArticleIndex > 0 ? navItems[selectedArticleIndex - 1].key : null
	);
	const nextArticleKey = $derived(
		selectedArticleIndex >= 0 && selectedArticleIndex < navItems.length - 1
			? navItems[selectedArticleIndex + 1].key
			: null
	);

	async function navigateToArticle(key: string) {
		// handleRailNavigate already updates ?focus= via setUrl, so refreshing
		// Lezen mode after a prev/next click preserves the current article.
		await handleRailNavigate('instrument_articles', key);
	}


	// ── Convergence-path expansion ───────────────────────────────────────────
	// Strategy: BFS *bidirectionally* from the focused node, then prune to:
	//   • the focused node
	//   • its direct neighbours (level-1) — both inbound and outbound
	//   • convergence nodes — reachable from 2+ distinct level-1 nodes
	//   • intermediate nodes on the shortest path between l1 and convergence
	//
	// Treating edges as undirected here matters: a citation graph has many
	// articles that cite the focused article (inbound) — those must be visible
	// as neighbours, not just the articles the focused one cites.

	const MAX_DEPTH = 3;
	const MAX_CONVERGENCE_HOPS = 2;

	// Soft cap on visible nodes when "Toon ook indirecte buren" is active.
	// Prevents canvas overload; user can override with "Laad alles".

	// Show-all state — drives whether convergence pruning runs.
	let showAllNeighbours = $state(false);
	let unboundedShowAll = $state(false); // user clicked "Laad alles"
	let totalLoaded = $state(0);
	let visibleCount = $state(0);
	// §22 — counts for the visibility badge:
	//   level1Count  = focused node's direct neighbours that are currently visible
	//   hiddenCount  = totalLoaded − visibleCount

	// Race-safe expansion: every focus operation increments this counter; late
	// callbacks that don't match the current epoch are dropped.
	let focusEpoch = 0;

	// BFS outward from focusedId, following edges in both directions.
	async function expandToDepth(focusedId: string) {
		// One backend traversal replaces the N-fetch BFS waterfall. Synth
		// proxies have no real DB identity — skip; their article→instrument
		// synth edge already surfaces the wet for traversal purposes.
		const focal = store.getNodeById(focusedId);
		if (!focal || focal.id.startsWith('synth:')) return;
		await store.expandNeighborhood(focal.collection, focal.key, {
			depth: MAX_DEPTH,
			cap: 200,
		});
	}

	// Shortest path between `from` and `to` over an *undirected* view of the
	// adjacency map (uses both forward and reverse adjacency).
	function bfsPath(
		adj: Map<string, string[]>,
		radj: Map<string, string[]>,
		from: string,
		to: string
	): string[] | null {
		if (from === to) return [from];
		const parent = new Map<string, string | null>([[from, null]]);
		const queue = [from];
		while (queue.length > 0) {
			const cur = queue.shift()!;
			const neighbours = [...(adj.get(cur) ?? []), ...(radj.get(cur) ?? [])];
			for (const next of neighbours) {
				if (!parent.has(next)) {
					parent.set(next, cur);
					if (next === to) {
						const path: string[] = [];
						let c: string | null = to;
						while (c !== null) {
							path.unshift(c);
							c = parent.get(c) ?? null;
						}
						return path;
					}
					queue.push(next);
				}
			}
		}
		return null;
	}

	// Compute the set of node IDs to keep: focused + level-1 + convergence paths.
	function computeConvergencePaths(focusedId: string): Set<string> {
		const allEdges = get(store.edges);
		const adj = new Map<string, string[]>();
		const radj = new Map<string, string[]>(); // reverse: target → [sources]
		for (const e of allEdges) {
			// Synth edges are cosmetic — they exist to surface derived
			// relationships (article→wet, dossier→wet, …). Letting the
			// convergence walk traverse them turns shared synth hubs (a wet
			// proxy reachable from N cross-ref articles) into "convergence
			// nodes" that get preserved through every prune. Walk only real
			// backend edges so convergence reflects actual citations and
			// parliamentary links.
			if (e.id.startsWith('synth:')) continue;
			if (!adj.has(e.source)) adj.set(e.source, []);
			adj.get(e.source)!.push(e.target);
			if (!radj.has(e.target)) radj.set(e.target, []);
			radj.get(e.target)!.push(e.source);
		}

		// Direct neighbours = union of outbound + inbound (undirected adjacency).
		const level1 = new Set<string>([...(adj.get(focusedId) ?? []), ...(radj.get(focusedId) ?? [])]);
		const keep = new Set<string>([focusedId, ...level1]);
		if (level1.size < 2) return keep;

		// Undirected BFS from each level-1 node up to MAX_CONVERGENCE_HOPS, tracking
		// which level-1 sources can reach each visited node.
		const reachableFrom = new Map<string, Set<string>>();
		for (const l1 of level1) {
			const dist = new Map<string, number>([[l1, 0]]);
			const queue = [l1];
			while (queue.length > 0) {
				const cur = queue.shift()!;
				const d = dist.get(cur)!;
				if (!reachableFrom.has(cur)) reachableFrom.set(cur, new Set());
				reachableFrom.get(cur)!.add(l1);
				if (d < MAX_CONVERGENCE_HOPS) {
					const neighbours = [...(adj.get(cur) ?? []), ...(radj.get(cur) ?? [])];
					for (const next of neighbours) {
						if (next === focusedId) continue; // don't route through the focal node
						if (!dist.has(next)) {
							dist.set(next, d + 1);
							queue.push(next);
						}
					}
				}
			}
		}

		// Convergence nodes: reachable from 2+ distinct level-1 nodes.
		const convergenceNodes = new Set<string>();
		for (const [id, sources] of reachableFrom) {
			if (sources.size >= 2) {
				convergenceNodes.add(id);
				keep.add(id);
			}
		}

		// Add intermediate nodes on the shortest l1 ↔ convergence path so the
		// convergence node is graph-connected and survives the isolation prune.
		for (const conv of convergenceNodes) {
			const sources = reachableFrom.get(conv) ?? new Set<string>();
			for (const l1 of sources) {
				const path = bfsPath(adj, radj, l1, conv);
				if (path) {
					for (const nodeId of path) keep.add(nodeId);
				}
			}
		}

		// Drop nodes isolated within the kept subgraph (no edge to/from any other
		// kept node) so we don't render floating dots.
		for (const id of [...keep]) {
			if (id === focusedId || level1.has(id)) continue;
			const connected =
				(adj.get(id) ?? []).some((t) => keep.has(t)) ||
				(radj.get(id) ?? []).some((s) => keep.has(s));
			if (!connected) keep.delete(id);
		}

		return keep;
	}

	// Node expansion: BFS depth-3 around the focal node, then prune to a
	// convergence keep-set (focal + level-1 + nodes reachable from ≥2
	// distinct level-1 sources).
	//
	// Loading semantics:
	//   • No pre-clear. The user's prior canvas stays put while the
	//     expansion fetches in the background — no jarring "canvas blanks
	//     then re-pops" flash.
	//   • The final prune collapses the canvas to the new focal's
	//     neighbourhood. Pinned nodes (the user's explicit "keep this
	//     around" gesture) survive, and so does the shortest path from
	//     focal to each pinned node so they stay graph-connected.
	//   • Run via Lagen handlers (additive layer loads) — that's deliberate.
	async function expandWithConvergencePaths(node: GraphNode, epoch: number) {
		await expandToDepth(node.id);
		if (epoch !== focusEpoch) return; // stale

		const props = node.raw?.props as Record<string, unknown> | undefined;
		const isEuArticle = node.collection === 'instrument_articles' && !props?.['bwb_id'];

		const allNodes = get(store.nodes);
		totalLoaded = allNodes.length;

		const allEdges = get(store.edges);
		const l1 = new Set<string>();
		for (const e of allEdges) {
			if (e.source === node.id) l1.add(e.target);
			if (e.target === node.id) l1.add(e.source);
		}
		l1.delete(node.id);

		if (isEuArticle) {
			visibleCount = totalLoaded;
			return;
		}

		// Convergence keep-set around the new focus.
		const keep = computeConvergencePaths(node.id);

		// Pinned nodes always survive, and so does the shortest path from
		// focal to each pinned node — otherwise the pinned node would float
		// disconnected and the relationship the user pinned for is lost.
		const pinnedIds = get(store.pinned);
		if (pinnedIds.size > 0) {
			const adj = new Map<string, string[]>();
			const radj = new Map<string, string[]>();
			for (const e of allEdges) {
				if (e.id.startsWith('synth:')) continue;
				if (!adj.has(e.source)) adj.set(e.source, []);
				adj.get(e.source)!.push(e.target);
				if (!radj.has(e.target)) radj.set(e.target, []);
				radj.get(e.target)!.push(e.source);
			}
			for (const pinId of pinnedIds) {
				if (!store.getNodeById(pinId)) continue; // pinned but no longer in graph
				keep.add(pinId);
				const path = bfsPath(adj, radj, node.id, pinId);
				if (path) for (const id of path) keep.add(id);
			}
		}

		store.pruneNodes(keep);
		// Drop nodes that survived the prune but have zero remaining edges.
		// Otherwise FA2's repulsion flings them far and the camera fit zooms
		// out to include them.
		store.sweepOrphans();
		visibleCount = keep.size;
	}

	// Capped variant: keep focal node + BFS-ordered neighbours up to `cap`.

	// Cross-references between articles in a freshly-bulk-loaded wet only
	// appear after each article's neighbourhood is fetched. We used to do that
	// eagerly for every article — 200+ parallel /api/nodes calls. Now expansion
	// happens lazily on click, so the canvas appears instantly and the user
	// pulls in cross-references as they explore.

	// Load the focused node whenever the ?focus= URL param changes — covers both
	// initial mount and same-page navigations from search results / external links.
	let lastLoadedFocus = '';
	// Set to true by handleGoBack/handleGoForward so the $effect skips pushing
	// the re-expanded node back onto history (it's already at the right position).
	let isHistoryNav = false;
	$effect(() => {
		const raw = $page.url.searchParams.get('focus') ?? '';
		const focusParam = raw;
		focusError = null;
		if (!focusParam) return; // no focus → stay on launch pad
		if (focusParam === lastLoadedFocus) return;
		lastLoadedFocus = focusParam;

		const i = focusParam.indexOf('/');
		const collection = i >= 0 ? focusParam.slice(0, i) : 'instrument_articles';
		const key = i >= 0 ? focusParam.slice(i + 1) : focusParam;

		// Search hits carry ?from=search. Search is an explicit jump (the user
		// picked a target), not an accumulation of context — wipe the canvas
		// before expanding so the result lands clean. In-graph navigation
		// (clicks, rail) does not carry this marker and keeps accumulating.
		const fromSearch = $page.url.searchParams.get('from') === 'search';
		if (fromSearch) {
			store.reset();
			// Strip the marker so a refresh doesn't re-trigger the wipe and so
			// the param doesn't pollute the URL bar.
			const url = new URL($page.url.toString());
			url.searchParams.delete('from');
			goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
		}

		// Skip loading in bulk mode — the node is already in the graph.
		// (Skipped when fromSearch: the reset above flipped us out of bulk.)
		if (!fromSearch && get(store.graphMode) === 'bulk') {
			const nodeId = `${collection}/${key}`;
			const existing = store.getNodeById(nodeId);
			if (existing) {
				store.focusNode(existing.id, { recordHistory: false });
				return;
			}
		}

		focusError = null;
		store
			.expandNode(collection, key, { neighborLimit: 30 })
			.then(async (node) => {
				if (!node) {
					focusError = `Bron '${key}' kon niet worden gevonden.`;
					return;
				}
				const addToHistory = !isHistoryNav;
				isHistoryNav = false;
				store.focusNode(node.id, { recordHistory: addToHistory });

				if (get(store.graphMode) !== 'bulk') {
					graphView?.suppressFit();
					const epoch = ++focusEpoch;
					expandWithConvergencePaths(node, epoch).then(() => {
						if (epoch !== focusEpoch) return;
						store.focusNode(node.id, { recordHistory: false });
						graphView?.reseatAround(node.id);
						graphView?.fitWhenSettled();

						// D2 — laad arresten en dossiers attached aan het focuspunt
						// zodat de Verkenner niet opent met "X bronnen niet zichtbaar".
						// De handlers checken zelf of de laag al actief is en doen
						// attached-only fetch wanneer er een focal node is. Niet voor
						// arresten/dossiers/commissies zelf: die hebben al genoeg
						// connecties uit de BFS en triggeren anders een dubbele fetch.
						if (node.kind === 'article' || node.kind === 'instrument') {
							if (!activatedLayers.has('judgment')) void handleLoadJudgments();
							if (!activatedLayers.has('dossier')) void handleLoadDossiers();
						}
					});
				}
			})
			.catch((err) => {
				console.warn('[explore] focus load failed:', err);
				focusError = `Kon '${key}' niet laden. Controleer of het adres klopt.`;
			});
	});

	async function handleNodeClick(node: GraphNode) {
		const end = perfStart(`click ${node.id}`);
		if (!node.id.startsWith('synth:')) {
			track('network_expanded', { kind: node.kind });
		}

		// Synth proxy click. Proxies are visual stand-ins (Wetten view) with
		// no real backend identity beyond their bwb. Hitting expandNode here
		// would fetch the wet's full article list from /api/nodes/instruments/
		// — the same flood we already guard against in BFS. Just focus the
		// proxy so the FAB can offer "Open hele wet" if the user wants the
		// real instrument loaded. No expansion.
		if (node.id.startsWith('synth:')) {
			store.focusNode(node.id, { recordHistory: true });
			lastLoadedFocus = node.id;
			end();
			return;
		}

		store.focusNode(node.id, { recordHistory: true });
		lastLoadedFocus = node.id; // guard: prevent $effect from pushing a 2nd history entry

		// In a bulk overview, anchor clicks just focus the node so the
		// "Open volledig overzicht" FAB can take it from there (drilling deeper
		// into a wet/dossier/etc.). Non-anchor clicks swap to split view so the
		// user can read the article/arrest they tapped.
		//
		// Exception: a wet view (loadInstrument → graphMode='bulk' AND
		// currentInstrumentBwb set) is not a Lagen overview, it's a single
		// wet's article structure. Article clicks there should expand to
		// reveal neighbours, not jump to split-view reader. Let the
		// expansion path below handle them.
		if (get(store.graphMode) === 'bulk' && !currentInstrumentBwb) {
			if (!['instrument', 'dossier', 'commissie', 'lid', 'fractie'].includes(node.kind)) {
				setUrl({ mode: 'split', focus: node.id });
			} else {
				setUrl({ focus: node.id });
			}
			end();
			return;
		}

		// Instrument click → drill into the wet's full article set via the
		// dedicated /api/instruments/{bwb}/articles endpoint. The generic BFS
		// below caps at 30 articles via /api/nodes/{collection}/{key} and that
		// endpoint doesn't even surface PART_OF_INSTRUMENT children — so the
		// drill-in path is the only way to get a wet's actual articles on
		// canvas. loadInstrument wipes and rebuilds with the breadcrumb-cluster
		// structural layout (graphMode → 'bulk').
		if (node.kind === 'instrument') {
			const props = node.raw?.props as Record<string, unknown> | undefined;
			const bwbId = ((props?.['bwb_id'] as string | null) ?? node.key) || '';
			if (bwbId) {
				const result = await store.loadInstrument(bwbId);
				if (result && result.count > 0) {
					// Fire-and-forget: pre-fetch the Lagen counts so the
					// sidebar's "+N" badge surfaces availability before the
					// user clicks. Doesn't block the wet-view render.
					void store.prefetchInstrumentLayerCounts(bwbId);
					// Auto-load cross-wet article references on wet entry.
					// The Knooppunten "Wetgeving" toggle is already implicitly
					// on (the 810 article nodes count toward it), so making
					// the user click Lagen Wetten just to surface
					// REFERS_TO_ARTICLE neighbours reads as redundant. Lazy
					// stays for Arresten + Dossiers, which are heavier and
					// more situational. Mark the layer as activated so the
					// sidebar button reads "on" while the fetch runs.
					activatedLayers.add('instrument');
					void store.loadInstrumentCitations(bwbId, {
						relations: ['REFERS_TO_ARTICLE']
					});
					// D2 — open een wet met alle lagen tegelijk in plaats van lazy.
					// Arresten + dossiers worden meegeladen zodat de Verkenner direct
					// het netwerk toont waar de homepage-tegel om belooft.
					activatedLayers.add('judgment');
					ensureNodeTypesVisible('judgment');
					void store.loadInstrumentJudgmentsLayer(bwbId);
					activatedLayers.add('dossier');
					ensureNodeTypesVisible('dossier');
					void store.loadInstrumentDossiersLayer(bwbId);
					// loadInstrument clears selection + flips to bulk; the
					// instrument node itself is no longer on the canvas, so
					// drop the focus param rather than pointing at a stale id.
					const url = new URL($page.url.toString());
					url.searchParams.delete('focus');
					url.searchParams.set('mode', 'graph');
					goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
					graphView?.fitWhenSettled();
					end();
					return;
				}
				// loadInstrument failed/empty → fall through to generic expansion.
			}
		}

		// Additive expansion for every kind — Article, Judgment, MvT, Dossier,
		// Fractie, Lid, Commissie, Instrument. /api/nodes/{collection}/{key}
		// returns the immediate neighbour set; mergeResponse adds them to the
		// current graph without wiping. Bulk loaders stay opt-in.
		setUrl({ focus: node.id });
		graphView?.suppressFit();
		const epoch = ++focusEpoch;
		await expandWithConvergencePaths(node, epoch);
		if (epoch !== focusEpoch) {
			end();
			return;
		}
		store.focusNode(node.id, { recordHistory: false });
		graphView?.reseatAround(node.id);
		graphView?.fitWhenSettled();
		end();
	}

	function handleOpenSplit(node: GraphNode) {
		setUrl({ mode: 'split', focus: node.id });
	}

	async function handleRailNavigate(collection: string, key: string) {
		const node = await store.expandNode(collection, key, { neighborLimit: 30 });
		if (node) {
			store.focusNode(node.id, { recordHistory: true });
			// Set lastLoadedFocus before setUrl so the ?focus= $effect sees this
			// navigation as already handled and doesn't re-run expandWithConvergencePaths.
			lastLoadedFocus = node.id;
			setUrl({ focus: node.id });
			const epoch = ++focusEpoch;
			await expandWithConvergencePaths(node, epoch);
			if (epoch !== focusEpoch) return;
			store.focusNode(node.id, { recordHistory: false });
			graphView?.reseatAround(node.id);
		}
	}

	function handleGoBack() {
		const nodeId = store.goBack();
		if (nodeId) {
			isHistoryNav = true;
			lastLoadedFocus = ''; // force $effect to re-expand the node
			setUrl({ focus: nodeId });
		}
	}

	function handleGoForward() {
		const nodeId = store.goForward();
		if (nodeId) {
			isHistoryNav = true;
			lastLoadedFocus = '';
			setUrl({ focus: nodeId });
		}
	}

	// Lagen handlers have two flavours:
	//   - Empty graph → load the full layer (the legacy "show me everything"
	//     entry point).
	//   - Non-empty graph → re-expand the existing nodes and keep ONLY new
	//     nodes of the target kind. So clicking "Arresten" on an article view
	//     where no judgments are related stays at 0 — instead of dumping all
	//     ~1000 judgments onto the canvas.
	function ensureNodeTypesVisible(...keys: Array<keyof GraphFilters['nodeTypeToggles']>) {
		const cur = get(store.filters);
		const patch = { ...cur.nodeTypeToggles };
		let changed = false;
		for (const k of keys) {
			if (!patch[k]) { patch[k] = true; changed = true; }
		}
		if (changed) store.setFilters({ nodeTypeToggles: patch });
	}

	// Cap re-expansion to keep API spike bounded. 30 covers a typical focused
	// view (article + its level-1 neighbours).
	const ATTACHED_EXPAND_CAP = 30;

	// Layers the user has activated via the Lagen buttons. Drives the
	// "pressed" state on those buttons regardless of how many nodes of the
	// kind made it onto the canvas — so when an attached-only load produces
	// zero newcomers, the user can still see that the layer is active.
	const activatedLayers = new SvelteSet<import('$lib/graph/types').GraphNodeKind>();

	// Re-expand the existing nodes and prune the result to keep
	//   (everything that was already on canvas) ∪ (target-kinds newcomers).
	// Anchor proxies (synth: instruments) are skipped — they have no real
	// API endpoint to expand against. Accepts a set of kinds so a layer like
	// Dossier can pull in both dossier hubs *and* their tkstuk publications
	// in one pass.
	async function loadAttachedOnly(
		targetKinds: ReadonlySet<import('$lib/graph/types').GraphNodeKind>
	) {
		const all = get(store.nodes);
		const beforeIds = new Set(all.map((n) => n.id));
		const toExpand = all
			.filter((n) => !n.id.startsWith('synth:'))
			.slice(0, ATTACHED_EXPAND_CAP);
		await Promise.all(
			toExpand.map((n) =>
				store.expandNode(n.collection, n.key, { neighborLimit: 50 }).catch(() => null)
			)
		);
		const afterAll = get(store.nodes);
		const keep = new Set<string>(beforeIds);
		for (const n of afterAll) {
			if (beforeIds.has(n.id)) continue;
			if (targetKinds.has(n.kind)) keep.add(n.id);
		}
		store.pruneNodes(keep);
		store.sweepOrphans();
	}

	// Lagen click policy:
	//   - No focal node selected   → load the full layer (disjoint subgraph
	//     allowed; this is how the user assembles a multi-layer view).
	//   - A focal node is selected → attached-only (the original behaviour,
	//     so clicking Arresten on a focused article doesn't dump ~1000 nodes).
	// Either way, we mark the layer as activated so the Lagen button reads
	// as "pressed" even when the attached pass produces zero newcomers.

	async function handleLoadGlobal() {
		loadingGlobal = true;
		activatedLayers.add('instrument');
		try {
			console.log('[lagen] handleLoadGlobal — currentInstrumentBwb=', currentInstrumentBwb, 'selectedNode=', selectedNode?.id ?? null);
			ensureNodeTypesVisible('instrument', 'article');
			// Wet view + Artikelen mode (the default for a wet view): surface
			// cross-wet *article-level* references — foreign articles + the
			// REFERS_TO_ARTICLE edges that connect them to Sv articles. The
			// /related-instruments aggregate (wet hubs with count-only
			// metadata) doesn't carry per-article edges, so its nodes would
			// just float; not useful here.
			if (currentInstrumentBwb && !selectedNode) {
				const result = await store.loadInstrumentCitations(currentInstrumentBwb, {
					relations: ['REFERS_TO_ARTICLE']
				});
				if (!result || result.count === 0) {
					console.warn('[explore] loadInstrumentCitations(REFERS_TO_ARTICLE) returned no nodes');
				}
				return;
			}
			if (selectedNode) {
				await loadAttachedOnly(new Set(['instrument', 'article']));
				return;
			}
			const result = await store.loadInstrumentLayerGraph({ additive: true });
			if (!result || result.count === 0) {
				console.warn('[explore] loadInstrumentLayerGraph returned no nodes');
				return;
			}
			setUrl({ mode: 'graph' });
		} finally {
			loadingGlobal = false;
		}
	}

	async function handleLoadJudgments() {
		loadingJudgments = true;
		activatedLayers.add('judgment');
		try {
			console.log('[lagen] handleLoadJudgments — currentInstrumentBwb=', currentInstrumentBwb, 'selectedNode=', selectedNode?.id ?? null);
			ensureNodeTypesVisible('judgment');
			// Wet view: scope to judgments that cite this wet's articles.
			if (currentInstrumentBwb && !selectedNode) {
				const result = await store.loadInstrumentJudgmentsLayer(currentInstrumentBwb);
				if (!result || result.count === 0) {
					console.warn('[explore] loadInstrumentJudgmentsLayer returned no nodes');
				}
				return;
			}
			if (selectedNode) {
				await loadAttachedOnly(new Set(['judgment']));
				return;
			}
			ensureNodeTypesVisible('judgment', 'instrument');
			const result = await store.loadJudgmentLayerGraph({ additive: true });
			if (!result || result.count === 0) {
				console.warn('[explore] loadJudgmentLayerGraph returned no nodes');
				return;
			}
			setUrl({ mode: 'graph' });
		} finally {
			loadingJudgments = false;
		}
	}

	async function handleLoadCommissies() {
		loadingCommissies = true;
		activatedLayers.add('commissie');
		try {
			ensureNodeTypesVisible('commissie', 'activity');
			if (selectedNode) {
				await loadAttachedOnly(new Set(['commissie', 'activity']));
				return;
			}
			ensureNodeTypesVisible('commissie', 'activity', 'lid');
			const result = await store.loadCommissiesLayerGraph({ additive: true });
			if (!result || result.count === 0) {
				console.warn('[explore] loadCommissiesLayerGraph returned no nodes');
				return;
			}
			setUrl({ mode: 'graph' });
		} finally {
			loadingCommissies = false;
		}
	}

	let loadingLeden = $state(false);
	async function handleLoadLeden() {
		loadingLeden = true;
		activatedLayers.add('lid');
		try {
			ensureNodeTypesVisible('lid');
			if (selectedNode) {
				await loadAttachedOnly(new Set(['lid']));
				return;
			}
			const result = await store.loadLedenLayerGraph({ additive: true });
			if (!result || result.count === 0) {
				console.warn('[explore] loadLedenLayerGraph returned no nodes');
				return;
			}
			setUrl({ mode: 'graph' });
		} finally {
			loadingLeden = false;
		}
	}

	let loadingFracties = $state(false);
	async function handleLoadFracties() {
		loadingFracties = true;
		activatedLayers.add('fractie');
		try {
			ensureNodeTypesVisible('fractie', 'lid');
			if (selectedNode) {
				await loadAttachedOnly(new Set(['fractie', 'lid']));
				return;
			}
			ensureNodeTypesVisible('fractie', 'lid');
			const result = await store.loadFractiesLayerGraph({ additive: true });
			if (!result || result.count === 0) {
				console.warn('[explore] loadFractiesLayerGraph returned no nodes');
				return;
			}
			setUrl({ mode: 'graph' });
		} finally {
			loadingFracties = false;
		}
	}

	// Load a curated example that exercises all legend items.
	// 126ffa Sv is the literal motivating example from the methode: it has 3 outbound
	// cross-references to 126nba/126uba/126zpa which in turn cite each other and have
	// judicial citations — convergence shows those shared targets.
	// Loading the sub-articles bidirectionally pulls in their judgment neighbors.

	// "Maak ze zichtbaar" — re-expand the current focus but skip the
	// convergence prune so every BFS-fetched node lands on the canvas.
	// Snapshots the prior state, runs expandToDepth, then preserves the
	// entire post-expansion node set (just sweeps strict orphans).
	async function handleRevealHidden() {
		const sel = get(store.selection);
		if (!sel) return;
		graphView?.suppressFit();
		const epoch = ++focusEpoch;
		await expandToDepth(sel.id);
		if (epoch !== focusEpoch) return;
		// No prune — everything fetched stays. Just clean up strict orphans
		// (nodes with zero incident edges) so isolated junk doesn't drag the
		// camera. Counts get recomputed reactively.
		store.sweepOrphans();
		const allNodes = get(store.nodes);
		totalLoaded = allNodes.length;
		visibleCount = allNodes.length;
		graphView?.fitWhenSettled();
	}

	// Remove every node of the given kind from the canvas (and incident edges).
	// The orphan sweep that follows drops anything left disconnected — e.g. the
	// stemmingen/activiteiten halo around a deloaded fractie/dossier evaporates
	// instead of lingering as ghost dots.
	function handleDeloadLayer(kind: import('$lib/graph/types').GraphNodeKind) {
		// Deload the union of the layer (primary + sub-kinds). The Lagen
		// buttons treat e.g. Dossier as {dossier, tkstuk} for counts and
		// activation, so deload has to remove both to match.
		const drop = new Set(kindsForLayer(kind));
		const all = get(store.nodes);
		const keep = new Set<string>();
		for (const n of all) {
			if (!drop.has(n.kind)) keep.add(n.id);
		}
		store.pruneNodes(keep);
		store.sweepOrphans();
		activatedLayers.delete(kind);
	}

	async function handleLoadDossiers() {
		loadingDossiers = true;
		activatedLayers.add('dossier');
		try {
			console.log('[lagen] handleLoadDossiers — currentInstrumentBwb=', currentInstrumentBwb, 'selectedNode=', selectedNode?.id ?? null);
			ensureNodeTypesVisible('dossier', 'tkstuk');
			// Wet view: fire both endpoints in parallel.
			//   /dossiers           → dossier nodes + dossier→article (raakt) edges.
			//   /citations filtered → publication nodes + publication→article
			//                         (WIJZIGT/INTRODUCEERT/TREKT_IN) edges so
			//                         the user actually sees the dossier ↔
			//                         publication ↔ article chain rather than
			//                         floating dossier nodes with only their
			//                         derived raakt edges.
			if (currentInstrumentBwb && !selectedNode) {
				const bwb = currentInstrumentBwb;
				const [dossiersResult, citationsResult] = await Promise.all([
					store.loadInstrumentDossiersLayer(bwb),
					store.loadInstrumentCitations(bwb, {
						relations: ['WIJZIGT', 'INTRODUCEERT', 'TREKT_IN'],
					}),
				]);
				if ((!dossiersResult || dossiersResult.count === 0) &&
				    (!citationsResult || citationsResult.count === 0)) {
					console.warn('[explore] dossiers + publication citations both returned no nodes');
				}
				return;
			}
			if (selectedNode) {
				await loadAttachedOnly(new Set(['dossier', 'tkstuk']));
				return;
			}
			ensureNodeTypesVisible('dossier', 'tkstuk');
			const result = await store.loadRecentDossiersGraph({ additive: true });
			if (!result || result.count === 0) {
				console.warn('[explore] loadRecentDossiersGraph returned no nodes');
				return;
			}
			setUrl({ mode: 'graph' });
		} finally {
			loadingDossiers = false;
		}
	}

	function setUrl(params: Record<string, string>) {
		const url = new URL($page.url.toString());
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function setMode(newMode: string) {
		const url = new URL($page.url.toString());
		url.searchParams.set('mode', newMode);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	// ── Parliamentary graph seeding ───────────────────────────────────────────
	// ?seed=lid:abc        → loadLidGraph, then strip the param
	// ?seed=fractie:abc    → loadFractieGraph, then strip the param
	// (dossier and commissie deep-link views removed — the wet-view Lagen
	// workflow covers those use cases now.)
	let lastSeedParam = '';
	$effect(() => {
		const seedParam = $page.url.searchParams.get('seed') ?? '';
		if (!seedParam || seedParam === lastSeedParam) return;
		lastSeedParam = seedParam;

		const url = new URL($page.url.toString());
		url.searchParams.delete('seed');

		if (seedParam.startsWith('lid:')) {
			const key = seedParam.slice('lid:'.length);
			store.loadLidGraph(key).then(() => {
				goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
			});
		} else if (seedParam.startsWith('fractie:')) {
			const key = seedParam.slice('fractie:'.length);
			store.loadFractieGraph(key).then(() => {
				goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
			});
		}
	});

	// ── Graph overlay (mutually exclusive: Activiteit OR Mutatie) ────────────
	const overlayParam = $derived($page.url.searchParams.get('overlay'));
	const overlay = $derived<Overlay>(parseOverlay(overlayParam));

	// Bound to <GraphView> so we can request a fit-to-screen after expansion.
	let graphView = $state<GraphView | null>(null);
	// Data maps are populated only for the currently active overlay; the other
	// stays empty so the canvas doesn't render stale signal.
	let inFluxMap = $state<InFluxMap>(new Map());
	let heatMap = $state<HeatMap>(new Map());

	$effect(() => {
		const o = overlay;
		let cancelled = false;

		if (o.kind === 'heat') {
			heatMap = new Map();
			inFluxMap = new Map();
			fetchHeatMap(o.months)
				.then((m) => { if (!cancelled) heatMap = m; })
				.catch(() => {});
		} else if (o.kind === 'open') {
			heatMap = new Map();
			inFluxMap = new Map();
			fetchInFluxMap()
				.then((m) => { if (!cancelled) inFluxMap = m; })
				.catch(() => {});
		} else if (o.kind === 'dossier') {
			heatMap = new Map();
			inFluxMap = new Map();
			fetchDossierInFluxMap(o.id)
				.then((m) => { if (!cancelled) inFluxMap = m; })
				.catch(() => {});
		} else {
			heatMap = new Map();
			inFluxMap = new Map();
		}

		return () => { cancelled = true; };
	});

	function setOverlayParam(value: string | null) {
		const url = new URL($page.url.toString());
		if (value === null) url.searchParams.delete('overlay');
		else url.searchParams.set('overlay', value);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	function toggleHeat() {
		setOverlayParam(overlay.kind === 'heat' ? null : `heat:${DEFAULT_HEAT_MONTHS}`);
	}

	function setHeatPeriod(months: number) {
		setOverlayParam(`heat:${months}`);
	}

	function toggleMutatie() {
		// Toggles the broad "all open dossiers" scope. A dossier-scoped overlay
		// is only entered via deep link (?overlay=dossier:X) — clicking the
		// toggle while in dossier scope clears the overlay entirely.
		setOverlayParam(overlay.kind === 'open' || overlay.kind === 'dossier' ? null : 'open');
	}


	// ── Share view (Phase 7 §27) ─────────────────────────────────────────────
	// Direct copy-to-clipboard on ↗ Deel — no preview modal. The button surface
	// flips to "✓ Gekopieerd" for ~1.8s as the affordance.
	let shareCopied = $state(false);
	const shareUrl = $derived.by(() => {
		const url = new URL($page.url.toString());
		if (showAllNeighbours) url.searchParams.set('all', unboundedShowAll ? 'unbound' : '1');
		else url.searchParams.delete('all');
		return url.toString();
	});

	async function handleShareView() {
		try {
			await navigator.clipboard.writeText(shareUrl);
			shareCopied = true;
			setTimeout(() => {
				shareCopied = false;
			}, 1800);
		} catch {
			/* clipboard blocked — silently no-op */
		}
	}

	// Read ?all= on mount.
	$effect(() => {
		const v = $page.url.searchParams.get('all');
		if (v === '1') {
			showAllNeighbours = true;
			unboundedShowAll = false;
		} else if (v === 'unbound') {
			showAllNeighbours = true;
			unboundedShowAll = true;
		}
	});

	// Mobile panel tab for split mode
	let mobilePanel = $state<'reader' | 'graph' | 'citations'>('reader');

	// Mobile degradation notice — shown once per session on narrow viewports.
	let showMobileNotice = $state(false);
	function dismissMobileNotice() {
		showMobileNotice = false;
		try { sessionStorage.setItem('concordans:mobile-notice-dismissed', '1'); } catch { /* ignore */ }
	}

	// ── Resizable panels ─────────────────────────────────────────────────────
	const PANEL_STORAGE_KEY = 'concordans:panel-widths';
	let splitGraphW = $state(320);
	let splitRailW = $state(220);
	let readNavW = $state(200);
	let readRailW = $state(220);

	onMount(() => {
		try {
			const raw = localStorage.getItem(PANEL_STORAGE_KEY);
			if (raw) {
				const p = JSON.parse(raw) as Record<string, number>;
				if (p.splitGraphW) splitGraphW = p.splitGraphW;
				if (p.splitRailW) splitRailW = p.splitRailW;
				if (p.readNavW) readNavW = p.readNavW;
				if (p.readRailW) readRailW = p.readRailW;
			}
		} catch {
			/* ignore */
		}

		// Autoload removed in Phase 2 — cold visit is the empty graph canvas.

		if (window.innerWidth < 768) {
			try {
				if (!sessionStorage.getItem('concordans:mobile-notice-dismissed')) {
					showMobileNotice = true;
				}
			} catch { /* ignore */ }
		}
	});

	function savePanelWidths() {
		try {
			localStorage.setItem(
				PANEL_STORAGE_KEY,
				JSON.stringify({ splitGraphW, splitRailW, readNavW, readRailW })
			);
		} catch {
			/* ignore */
		}
	}

	type DragHandle = 'split-graph' | 'split-rail' | 'read-nav' | 'read-rail';
	let activeDrag: { handle: DragHandle; startX: number; startW: number } | null = null;

	function startResize(e: PointerEvent, handle: DragHandle) {
		e.preventDefault();
		const startW =
			handle === 'split-graph'
				? splitGraphW
				: handle === 'split-rail'
					? splitRailW
					: handle === 'read-nav'
						? readNavW
						: readRailW;
		activeDrag = { handle, startX: e.clientX, startW };
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onResizeMove(e: PointerEvent) {
		if (!activeDrag) return;
		const delta = e.clientX - activeDrag.startX;
		if (activeDrag.handle === 'split-graph') {
			splitGraphW = Math.max(180, Math.min(540, activeDrag.startW + delta));
		} else if (activeDrag.handle === 'split-rail') {
			splitRailW = Math.max(160, Math.min(400, activeDrag.startW - delta));
		} else if (activeDrag.handle === 'read-nav') {
			readNavW = Math.max(140, Math.min(320, activeDrag.startW + delta));
		} else {
			readRailW = Math.max(160, Math.min(400, activeDrag.startW - delta));
		}
	}

	function onResizeEnd() {
		if (!activeDrag) return;
		activeDrag = null;
		savePanelWidths();
	}

	// ── Keyboard shortcuts ────────────────────────────────────────────────────
	// Plain 1 / 2 / 3 (no modifier) — ⌘1-9 conflicts with browser tab-switching.
	// Guarded against firing while the user is typing in an input/textarea.
	function handleKeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key !== '1' && e.key !== '2' && e.key !== '3') return;
		const tag = (document.activeElement as HTMLElement)?.tagName;
		if (
			tag === 'INPUT' ||
			tag === 'TEXTAREA' ||
			(document.activeElement as HTMLElement)?.isContentEditable
		)
			return;
		e.preventDefault();
		const targetMode =
			e.key === '1' ? 'graph' :
			e.key === '2' ? 'split' : 'read';
		// split/read need a node; graph is altijd bereikbaar.
		if ((targetMode === 'split' || targetMode === 'read') && !selectedNode) return;
		if (targetMode !== mode) setUrl({ mode: targetMode });
	}

	// ── Index mode (catalogus / lijst-launchpad) ─────────────────────────────
	// ?kind=… picks the active category in IndexView. Defaults to 'dossiers'
	// since that's the largest live dataset.
	type IndexCategory =
		| 'wetten' | 'arresten' | 'dossiers' | 'commissies'
		| 'leden' | 'fracties' | 'stemmingen';
	const INDEX_CATEGORIES: ReadonlySet<IndexCategory> = new Set([
		'wetten', 'arresten', 'dossiers', 'commissies', 'leden', 'fracties', 'stemmingen'
	]);
	// Onbekende of stale ?kind=-waardes (typo's, dode links) vallen terug op
	// 'dossiers' in plaats van een lege pagina te tonen.
	const indexCategory = $derived<IndexCategory>((() => {
		const raw = $page.url.searchParams.get('kind');
		return raw && INDEX_CATEGORIES.has(raw as IndexCategory)
			? (raw as IndexCategory)
			: 'dossiers';
	})());
	function handleIndexCategory(k: IndexCategory) {
		setUrl({ mode: 'index', kind: k });
	}
	// "Verdiepen" — split-modus met netwerk + leespanel.
	function handleIndexSelect(collection: string, key: string) {
		setUrl({ mode: 'split', focus: `${collection}/${key}` });
	}
	// "Ontdekken" — graph-modus met focus op de bron.
	function handleIndexDiscover(collection: string, key: string) {
		setUrl({ mode: 'graph', focus: `${collection}/${key}` });
	}
	// "Lezen" — volledige tekst zonder netwerk.
	function handleIndexRead(collection: string, key: string) {
		setUrl({ mode: 'read', focus: `${collection}/${key}` });
	}
	// Aantal getoonde resultaten in Index, gespiegeld in de StatusBar-breadcrumb.
	let indexResultCount = $state<{ filtered: number; total: number } | null>(null);
	function handleIndexResultCount(info: { filtered: number; total: number; category: IndexCategory }) {
		indexResultCount = { filtered: info.filtered, total: info.total };
	}
	// Bij categorie-wissel reset zodat geen stale count blijft hangen.
	$effect(() => { void indexCategory; indexResultCount = null; });
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Verkenner — Concordans</title>
</svelte:head>

<div class="explore-shell">
	<StatusBar
		node={selectedNode}
		{focusError}
		{loadingCommissies}
		{canGoBack}
		{canGoForward}
		{mode}
		indexCategory={mode === 'index' ? indexCategory : null}
		indexResultCount={mode === 'index' ? indexResultCount : null}
		{shareCopied}
		onShareView={handleShareView}
		onGoBack={handleGoBack}
		onGoForward={handleGoForward}
		onLoadCommissies={handleLoadCommissies}
		onModeChange={setMode}
	/>

	<div class="explore-content">
		{#if mode === 'index'}
			<IndexView
				category={indexCategory}
				onSelectCategory={handleIndexCategory}
				onSelectItem={handleIndexSelect}
				onDiscoverItem={handleIndexDiscover}
				onReadItem={handleIndexRead}
				onResultCountChange={handleIndexResultCount}
			/>
		{:else if mode === 'graph'}
			<div class="explore-graph">
				{#if nodeCount === 0}
					<EmptyCanvas />
				{/if}
				<GraphView
					bind:this={graphView}
					{store}
					{inFluxMap}
					{heatMap}
					{overlay}
					{visibleCount}
					{totalLoaded}
					onNodeClick={handleNodeClick}
					onOpenSplit={handleOpenSplit}
					onGoBack={handleGoBack}
					onGoForward={handleGoForward}
					onToggleHeat={toggleHeat}
					onHeatPeriodChange={setHeatPeriod}
					onToggleMutatie={toggleMutatie}
					onLoadGlobal={handleLoadGlobal}
					onLoadJudgments={handleLoadJudgments}
					onLoadCommissies={handleLoadCommissies}
					onLoadDossiers={handleLoadDossiers}
					onLoadLeden={handleLoadLeden}
					onLoadFracties={handleLoadFracties}
					onDeloadLayer={handleDeloadLayer}
					onResetGraph={() => { store.reset(); activatedLayers.clear(); }}
					onRevealHidden={handleRevealHidden}
					{loadingGlobal}
					{loadingJudgments}
					{loadingCommissies}
					{loadingDossiers}
					{loadingLeden}
					{loadingFracties}
					{activatedLayers}
				/>
			</div>
		{:else if mode === 'split'}
			<div
				class="explore-split"
				class:is-resizing={!!activeDrag}
				style:--split-graph-w="{splitGraphW}px"
				style:--split-rail-w="{splitRailW}px"
			>
				<nav class="split-mobile-tabs" aria-label="Panelen">
					<button
						type="button"
						class="split-mobile-tab"
						class:active={mobilePanel === 'reader'}
						onclick={() => (mobilePanel = 'reader')}>Tekst</button
					>
					<button
						type="button"
						class="split-mobile-tab"
						class:active={mobilePanel === 'graph'}
						onclick={() => (mobilePanel = 'graph')}>Netwerk</button
					>
					<button
						type="button"
						class="split-mobile-tab"
						class:active={mobilePanel === 'citations'}
						onclick={() => (mobilePanel = 'citations')}>Citaten</button
					>
				</nav>
				<div class="split-graph" class:mobile-hidden={mobilePanel !== 'graph'}>
					<GraphView
						bind:this={graphView}
						{store}
						compact
						{inFluxMap}
						{heatMap}
						{overlay}
						{visibleCount}
						{totalLoaded}
						onNodeClick={(n) => {
							handleNodeClick(n);
							mobilePanel = 'reader';
						}}
						onGoBack={handleGoBack}
						onGoForward={handleGoForward}
						onToggleHeat={toggleHeat}
						onHeatPeriodChange={setHeatPeriod}
						onToggleMutatie={toggleMutatie}
						onLoadGlobal={handleLoadGlobal}
						onLoadJudgments={handleLoadJudgments}
						onLoadCommissies={handleLoadCommissies}
						onLoadDossiers={handleLoadDossiers}
						onLoadLeden={handleLoadLeden}
						onLoadFracties={handleLoadFracties}
						onDeloadLayer={handleDeloadLayer}
					onResetGraph={() => { store.reset(); activatedLayers.clear(); }}
					onRevealHidden={handleRevealHidden}
						{loadingGlobal}
						{loadingJudgments}
						{loadingCommissies}
						{loadingDossiers}
						{loadingLeden}
						{loadingFracties}
						{activatedLayers}
					/>
				</div>
				<div
					class="panel-resize-handle"
					onpointerdown={(e) => startResize(e, 'split-graph')}
					onpointermove={onResizeMove}
					onpointerup={onResizeEnd}
					aria-hidden="true"
				></div>
				<div class="split-reader" class:mobile-hidden={mobilePanel !== 'reader'}>
					{#if !selectedNode}
						<div class="reader-empty">
							<p>Zoek een artikel of arrest via de zoekbalk.</p>
						</div>
					{:else}
						<KindReader selection={selectedNode} onNavigate={handleRailNavigate} />
					{/if}
				</div>
				<div
					class="panel-resize-handle panel-resize-handle--right"
					onpointerdown={(e) => startResize(e, 'split-rail')}
					onpointermove={onResizeMove}
					onpointerup={onResizeEnd}
					aria-hidden="true"
				></div>
				<div class="split-rail" class:mobile-hidden={mobilePanel !== 'citations'}>
					<CitationRail
						selection={selectedNode}
						onNavigate={(col, key) => {
							handleRailNavigate(col, key);
							mobilePanel = 'reader';
						}}
					/>
				</div>
			</div>
		{:else if mode === 'read'}
			{#if !selectedNode && !currentInstrumentBwb && !wholeLawBwb}
				<div class="explore-read-empty">
					<p class="explore-read-empty__text">
						Zoek een artikel of arrest via de zoekbalk.
					</p>
					<button class="explore-read-empty__btn" onclick={() => setUrl({ mode: 'graph' })}>
						Ga naar netwerk →
					</button>
				</div>
			{:else}
				<div
					class="explore-read"
					class:is-resizing={!!activeDrag}
					style:--read-nav-w="{readNavW}px"
					style:--read-rail-w="{readRailW}px"
				>
					<LezenNav
						selection={selectedNode}
						bwb={currentInstrumentBwb}
						onNavigate={handleRailNavigate}
						onitems={(it) => {
							navItems = it;
						}}
					/>
					<div
						class="panel-resize-handle"
						onpointerdown={(e) => startResize(e, 'read-nav')}
						onpointermove={onResizeMove}
						onpointerup={onResizeEnd}
						aria-hidden="true"
					></div>
					<div class="explore-read__measure">
						{#if showWholeLaw && wholeLawBwb}
							<WholeLawReader bwbId={wholeLawBwb} onNavigate={handleRailNavigate} />
						{:else}
							<KindReader
								selection={selectedNode}
								onNavigate={handleRailNavigate}
								onPrev={prevArticleKey ? () => navigateToArticle(prevArticleKey!) : undefined}
								onNext={nextArticleKey ? () => navigateToArticle(nextArticleKey!) : undefined}
							/>
						{/if}
					</div>
					<div
						class="panel-resize-handle panel-resize-handle--right"
						onpointerdown={(e) => startResize(e, 'read-rail')}
						onpointermove={onResizeMove}
						onpointerup={onResizeEnd}
						aria-hidden="true"
					></div>
					<aside class="explore-read__rail">
						<CitationRail selection={selectedNode} onNavigate={handleRailNavigate} />
					</aside>
				</div>
			{/if}
		{/if}
	</div>

</div>

<!-- Eerste-keer-tip rechtsonder. Verbergt zichzelf na dismiss en blijft
     dan weg dankzij localStorage. Niet getoond op mobiel — daar zit de
     mobile-notice al een banner-positie in. -->
{#if !showMobileNotice}
	<WalkthroughCard />
{/if}

{#if showMobileNotice}
	<div class="mobile-notice" role="alert">
		<span class="mobile-notice__text">Het netwerk werkt het best op een groter scherm. Op mobiel kun je wel lezen en de Index gebruiken.</span>
		<a href="/explore?mode=index&kind=dossiers" class="mobile-notice__link" onclick={dismissMobileNotice}>Open Index →</a>
		<button type="button" class="mobile-notice__close" onclick={dismissMobileNotice} aria-label="Sluiten">×</button>
	</div>
{/if}

<style>
	.explore-shell {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 64px);
		overflow: hidden;
	}

	.explore-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.explore-graph {
		flex: 1;
		display: flex;
		position: relative;
		overflow: hidden;
	}

	.explore-split {
		flex: 1;
		display: grid;
		grid-template-columns: var(--split-graph-w, 320px) 5px minmax(0, 1fr) 5px var(
				--split-rail-w,
				220px
			);
		grid-template-rows: 1fr;
		overflow: hidden;
	}

	.split-mobile-tabs {
		display: none;
	}

	.split-graph {
		height: 100%;
		overflow: hidden;
	}
	.split-reader {
		height: 100%;
		overflow: hidden;
		display: flex;
		justify-content: center;
	}

	.split-reader :global(.reader-frame) {
		max-width: 700px;
		width: 100%;
	}

	.split-reader :global(.whole-law) {
		padding: var(--s-5) var(--s-5) var(--s-7);
	}
	.split-rail {
		height: 100%;
		overflow: hidden;
	}
	.reader-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		padding: var(--s-6);
		color: var(--ink-4);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
		text-align: center;
	}
	.reader-empty p { margin: 0; }

	/* Drag handle shared styles */
	.panel-resize-handle {
		height: 100%;
		width: 5px;
		cursor: col-resize;
		background: var(--rule);
		transition: background var(--dur-1) var(--ease);
		flex-shrink: 0;
		position: relative;
		z-index: 5;
	}

	.panel-resize-handle:hover,
	.is-resizing .panel-resize-handle {
		background: var(--spine-faint);
	}

	/* Right-side handles: dragging shrinks that rail */
	.panel-resize-handle--right {
		cursor: col-resize;
	}

	@media (max-width: 768px) {
		.explore-split {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}

		.split-mobile-tabs {
			display: flex;
			grid-column: 1;
			grid-row: 1;
			border-bottom: 1px solid var(--rule);
			background: var(--paper-2);
			flex-shrink: 0;
		}

		.split-mobile-tab {
			flex: 1;
			font-family: var(--font-sans);
			font-size: 11px;
			color: var(--ink-3);
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			padding: 8px 4px 9px;
			cursor: pointer;
			white-space: nowrap;
			margin-bottom: -1px;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}

		.split-mobile-tab.active {
			color: var(--ink);
			border-bottom-color: var(--ink);
			font-weight: 500;
		}

		.split-graph,
		.split-reader,
		.split-rail {
			grid-row: 2;
		}

		.panel-resize-handle {
			display: none;
		}

		.mobile-hidden {
			display: none;
		}
	}

	/* Tighter body font in the narrow split column */
	.split-reader :global(.reader-body) {
		font-size: 16px;
	}
	.split-reader :global(.lid-text) {
		font-size: 16px;
	}

	/* Tablet: drop citation rail to give reader more room */
	@media (max-width: 1100px) and (min-width: 769px) {
		.explore-split {
			grid-template-columns: var(--split-graph-w, 280px) 5px minmax(0, 1fr);
		}
		.split-rail {
			display: none;
		}
		.panel-resize-handle--right {
			display: none;
		}
	}

	.explore-read {
		flex: 1;
		display: grid;
		grid-template-columns: var(--read-nav-w, 200px) 5px minmax(0, 1fr) 5px var(--read-rail-w, 220px);
		overflow: hidden;
	}

	/* Tablet: collapse side panels in read mode */
	@media (max-width: 1100px) and (min-width: 769px) {
		.explore-read {
			grid-template-columns: var(--read-nav-w, 180px) 5px minmax(0, 1fr);
		}
		.explore-read__rail {
			display: none;
		}
	}

	.explore-read__measure {
		height: 100%;
		overflow-y: auto;
		display: flex;
		justify-content: center;
	}

	.explore-read__rail {
		height: 100%;
		overflow: hidden;
		border-left: 1px solid var(--rule);
	}

	.explore-read-empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--s-4);
		color: var(--ink-3);
	}

	.explore-read-empty__text {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 17px;
		margin: 0;
		color: var(--fg-3);
	}

	.explore-read-empty__btn {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 6px 14px;
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.explore-read-empty__btn:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	/* Pad the inner reader to a comfortable measure when in full Lezen mode */
	.explore-read__measure :global(.reader-frame) {
		max-width: 900px;
		width: 100%;
		padding: var(--s-7) var(--s-7) var(--s-8);
	}

	/* Mobile degradation notice */
	.mobile-notice {
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		z-index: 500;
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px;
		background: var(--ink);
		color: var(--paper);
		font-family: var(--font-sans);
		font-size: 13px;
		flex-wrap: wrap;
	}

	.mobile-notice__text {
		flex: 1;
		min-width: 0;
	}

	.mobile-notice__link {
		color: var(--paper);
		border-bottom: 1px solid rgba(255,255,255,0.4);
		text-decoration: none;
		white-space: nowrap;
		font-size: 13px;
		transition: border-color var(--dur-1) var(--ease);
	}
	.mobile-notice__link:hover { border-color: var(--paper); }

	.mobile-notice__close {
		background: none;
		border: none;
		color: var(--paper);
		opacity: 0.6;
		cursor: pointer;
		font-size: 18px;
		line-height: 1;
		padding: 0 4px;
		flex-shrink: 0;
	}
	.mobile-notice__close:hover { opacity: 1; }
</style>

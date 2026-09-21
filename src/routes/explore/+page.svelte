<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { SvelteSet } from 'svelte/reactivity';
	import { track } from '$lib/analytics';
	import { api, unwrap } from '$lib/api/client';
	import { getInFlux, getHeat, getDossierInFlux, type NodeCounts } from '$lib/api/overlays';
	import { createGraphStore } from '$lib/graph/graph-store';
	import GraphView from '$lib/components/graph/GraphView.svelte';
	import KindReader from '$lib/components/explore/KindReader.svelte';
	import CitationRail from '$lib/components/explore/CitationRail.svelte';
	import StatusBar from '$lib/components/explore/StatusBar.svelte';
	import LezenNav from '$lib/components/explore/LezenNav.svelte';
	import EmptyCanvas from '$lib/components/explore/EmptyCanvas.svelte';
	import WalkthroughCard from '$lib/components/explore/WalkthroughCard.svelte';
	import WholeLawReader from '$lib/components/explore/WholeLawReader.svelte';
	import IndexView from '$lib/components/explore/IndexView.svelte';
	import { perfStart } from '$lib/util/perf';
	import { getLawIdFromProps } from '$lib/util/law-id';
	import { kindsForLayer, type GraphNode, type GraphNodeKind } from '$lib/graph/types';
	import { parseOverlay, DEFAULT_HEAT_MONTHS, type Overlay } from '$lib/stores/overlay';
	import { isCollection, nodeId, parseNodeId } from '$lib/vocabulary';

	// One store for the lifetime of this page, so it survives mode switches.
	const store = createGraphStore();

	let selectedNode = $state<GraphNode | null>(null);
	store.selection.subscribe((n) => {
		selectedNode = n;
	});

	// An empty network shows the launch pad in graph mode.
	let nodeCount = $state(0);
	let firstNodeTracked = false;
	store.nodes.subscribe((ns) => {
		nodeCount = ns.length;
		if (ns.length > 0 && !firstNodeTracked) {
			firstNodeTracked = true;
			track('first_node', { kind: ns[0]?.kind ?? 'unknown' });
		}
	});

	let focusError = $state<string | null>(null);
	let canGoBack = $state(false);
	let canGoForward = $state(false);
	store.canGoBack.subscribe((v) => {
		canGoBack = v;
	});
	store.canGoForward.subscribe((v) => {
		canGoForward = v;
	});
	// Set while the network shows one instrument's articles (loadInstrument).
	// Layer loads then use the instrument endpoints instead of the global layer.
	let currentInstrumentBwb = $state<string | null>(null);
	store.currentInstrumentBwb.subscribe((v) => {
		currentInstrumentBwb = v;
	});

	const MODES = ['graph', 'split', 'read', 'index'];
	const mode = $derived.by(() => {
		const m = $page.url.searchParams.get('mode');
		return m && MODES.includes(m) ? m : 'graph';
	});
	const showsGraph = (m: string) => m === 'graph' || m === 'split';

	const trackedModes = new Set<string>();
	$effect(() => {
		if ((mode === 'split' || mode === 'read') && !trackedModes.has(mode)) {
			trackedModes.add(mode);
			track('mode_used', { mode });
		}
	});

	// Read mode: ?wet= wins, then the law of the selected article, then the
	// instrument shown in the network. Without a selected article the whole law is shown.
	const wholeLawBwb = $derived.by(() => {
		const wet = $page.url.searchParams.get('wet');
		if (wet) return wet;
		if (selectedNode?.collection === 'articles') {
			const id = getLawIdFromProps(selectedNode.raw?.props ?? undefined, selectedNode.key);
			if (id) return id;
		}
		return currentInstrumentBwb;
	});
	const showWholeLaw = $derived(
		!$page.url.searchParams.get('focus') ||
			$page.url.searchParams.get('wet') !== null ||
			(currentInstrumentBwb !== null && !selectedNode)
	);

	// Article list from LezenNav, for previous/next navigation.
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

	// ── Expansion around a focus ─────────────────────────────────────────────
	// One neighbourhood request (depth 3), then a prune to: the focus, its direct
	// neighbours, and the sources reachable from two or more of those neighbours
	// (convergence) with the shortest paths that connect them. Edges are read as
	// undirected: articles citing the focus are as relevant as those it cites.

	const MAX_DEPTH = 3;
	const MAX_CONVERGENCE_HOPS = 2;

	let totalLoaded = $state(0);
	let visibleCount = $state(0);

	// Every expansion takes a new epoch; a late result of an older one is dropped.
	let focusEpoch = 0;

	async function expandToDepth(focusedId: string) {
		// Synthetic proxies have no identity in the API.
		const focal = store.getNodeById(focusedId);
		if (!focal || focal.id.startsWith('synth:')) return;
		await store.expandNeighborhood(focal.collection, focal.key, { depth: MAX_DEPTH, cap: 200 });
	}

	type Adjacency = { adj: Map<string, string[]>; radj: Map<string, string[]> };

	// Synthetic edges are cosmetic. Walking them turns a shared proxy into a
	// convergence source that survives every prune.
	function buildAdjacency(): Adjacency {
		const adj = new Map<string, string[]>();
		const radj = new Map<string, string[]>();
		for (const e of get(store.edges)) {
			if (e.id.startsWith('synth:')) continue;
			if (!adj.has(e.source)) adj.set(e.source, []);
			adj.get(e.source)!.push(e.target);
			if (!radj.has(e.target)) radj.set(e.target, []);
			radj.get(e.target)!.push(e.source);
		}
		return { adj, radj };
	}

	const neighboursOf = ({ adj, radj }: Adjacency, id: string) => [
		...(adj.get(id) ?? []),
		...(radj.get(id) ?? [])
	];

	// Shortest path between two sources over the undirected adjacency.
	function bfsPath(g: Adjacency, from: string, to: string): string[] | null {
		if (from === to) return [from];
		const parent = new Map<string, string | null>([[from, null]]);
		const queue = [from];
		while (queue.length > 0) {
			const cur = queue.shift()!;
			for (const next of neighboursOf(g, cur)) {
				if (parent.has(next)) continue;
				parent.set(next, cur);
				if (next === to) {
					const path: string[] = [];
					for (let c: string | null = to; c !== null; c = parent.get(c) ?? null) path.unshift(c);
					return path;
				}
				queue.push(next);
			}
		}
		return null;
	}

	// Ids to keep: the focus, its direct neighbours and the convergence paths.
	function computeConvergencePaths(g: Adjacency, focusedId: string): Set<string> {
		const level1 = new Set(neighboursOf(g, focusedId));
		const keep = new Set<string>([focusedId, ...level1]);
		if (level1.size < 2) return keep;

		// Undirected BFS from each level-1 source, remembering which of them reach what.
		const reachableFrom = new Map<string, Set<string>>();
		for (const l1 of level1) {
			const dist = new Map<string, number>([[l1, 0]]);
			const queue = [l1];
			while (queue.length > 0) {
				const cur = queue.shift()!;
				const d = dist.get(cur)!;
				if (!reachableFrom.has(cur)) reachableFrom.set(cur, new Set());
				reachableFrom.get(cur)!.add(l1);
				if (d >= MAX_CONVERGENCE_HOPS) continue;
				for (const next of neighboursOf(g, cur)) {
					if (next === focusedId || dist.has(next)) continue;
					dist.set(next, d + 1);
					queue.push(next);
				}
			}
		}

		// Convergence sources, with the shortest path from each level-1 source so
		// they stay connected and survive the isolation prune below.
		for (const [id, sources] of reachableFrom) {
			if (sources.size < 2) continue;
			keep.add(id);
			for (const l1 of sources) for (const step of bfsPath(g, l1, id) ?? []) keep.add(step);
		}

		for (const id of [...keep]) {
			if (id === focusedId || level1.has(id)) continue;
			if (!neighboursOf(g, id).some((n) => keep.has(n))) keep.delete(id);
		}
		return keep;
	}

	// Expand around `node`, then prune to the convergence keep-set. The canvas
	// is not cleared first, so the prior network stays until the result arrives.
	// Pinned sources survive with their shortest path to the focus.
	async function expandWithConvergencePaths(node: GraphNode, epoch: number) {
		await expandToDepth(node.id);
		if (epoch !== focusEpoch) return;

		totalLoaded = get(store.nodes).length;

		// An EU article has no bwb_id and no useful neighbourhood to prune.
		const isEuArticle = node.collection === 'articles' && !node.raw?.props?.['bwb_id'];
		if (isEuArticle) {
			visibleCount = totalLoaded;
			return;
		}

		const g = buildAdjacency();
		const keep = computeConvergencePaths(g, node.id);
		for (const pinId of get(store.pinned)) {
			if (!store.getNodeById(pinId)) continue;
			keep.add(pinId);
			for (const step of bfsPath(g, node.id, pinId) ?? []) keep.add(step);
		}

		store.pruneNodes(keep);
		// Without edges a source is thrown far away by the layout and the camera fit zooms out.
		store.sweepOrphans();
		visibleCount = keep.size;
	}

	// ── Focus ────────────────────────────────────────────────────────────────
	// ?focus={collection}/{key} is loaded when it changes. The node is fetched in
	// every mode but index; the expansion around it only where the network is
	// shown, and later when the mode switches to one that shows it.
	let loadedFocus = ''; // focus param whose node is in the store
	let focusedNodeId: string | null = null;
	let deepenedId = ''; // node whose surroundings are expanded
	// Set by back/forward so the re-expanded node is not pushed onto the history again.
	let isHistoryNav = false;

	$effect(() => {
		const focus = $page.url.searchParams.get('focus') ?? '';
		if (!focus) {
			focusError = null;
			return;
		}
		if (mode === 'index') return;
		if (focus !== loadedFocus) {
			loadedFocus = focus;
			void loadFocus(focus);
		} else if (showsGraph(mode) && focusedNodeId) {
			const node = store.getNodeById(focusedNodeId);
			if (node) void deepen(node, true);
		}
	});

	async function loadFocus(focus: string) {
		focusError = null;
		const target = parseNodeId(focus);
		if (!target) {
			focusError = `Bron '${focus}' kon niet worden gevonden.`;
			return;
		}

		// A search hit is an explicit jump, not accumulated context: start clean.
		// The marker is stripped so a reload does not wipe again.
		if ($page.url.searchParams.get('from') === 'search') {
			store.reset();
			activatedLayers.clear();
			deepenedId = '';
			const url = new URL($page.url.toString());
			url.searchParams.delete('from');
			goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
		} else if (get(store.graphMode) === 'bulk') {
			const existing = store.getNodeById(focus);
			if (existing) {
				focusedNodeId = existing.id;
				store.focusNode(existing.id, { recordHistory: false });
				return;
			}
		}

		try {
			const node = await store.expandNode(target.collection, target.key, { neighborLimit: 30 });
			if (focus !== loadedFocus) return; // superseded while loading
			if (!node) {
				focusError = `Bron '${target.key}' kon niet worden gevonden.`;
				return;
			}
			focusedNodeId = node.id;
			store.focusNode(node.id, { recordHistory: !isHistoryNav });
			isHistoryNav = false;
			if (showsGraph(mode)) await deepen(node, true);
		} catch (err) {
			console.warn('[explore] focus load failed:', err);
			focusError = `Kon '${target.key}' niet laden. Controleer of het adres klopt.`;
		}
	}

	// Expand around `node` once. `withLayers` also fetches the judgments and
	// dossiers attached to an article or instrument, so the network does not
	// open with sources that are not visible.
	async function deepen(node: GraphNode, withLayers = false) {
		if (deepenedId === node.id) return;
		deepenedId = node.id;
		if (get(store.graphMode) === 'bulk') return;
		graphView?.suppressFit();
		const epoch = ++focusEpoch;
		await expandWithConvergencePaths(node, epoch);
		if (epoch !== focusEpoch) return;
		store.focusNode(node.id, { recordHistory: false });
		graphView?.reseatAround(node.id);
		graphView?.fitWhenSettled();
		if (withLayers && (node.kind === 'article' || node.kind === 'instrument')) {
			const missing = (['judgment', 'dossier'] as const).filter((l) => !activatedLayers.has(l));
			if (missing.length > 0) void loadAttachedLayers(missing);
		}
	}

	// Clicking one of these in a bulk overview only takes focus.
	const ANCHOR_KINDS = new Set<GraphNodeKind>([
		'instrument',
		'dossier',
		'committee',
		'member',
		'faction'
	]);

	async function handleNodeClick(node: GraphNode) {
		const end = perfStart(`click ${node.id}`);
		const synthetic = node.id.startsWith('synth:');
		if (!synthetic) track('network_expanded', { kind: node.kind });

		store.focusNode(node.id, { recordHistory: true });
		focusedNodeId = node.id;
		loadedFocus = node.id; // the focus effect must not push a second history entry

		// A synthetic proxy only gets focus: it has no identity in the API to expand.
		if (synthetic) {
			end();
			return;
		}

		// In a bulk overview, anchors only take focus (the "Open volledig overzicht"
		// button drills deeper) and other sources open in split mode. A single
		// instrument's view is bulk too, but there a click expands the neighbours.
		if (get(store.graphMode) === 'bulk' && !currentInstrumentBwb) {
			setUrl(ANCHOR_KINDS.has(node.kind) ? { focus: node.id } : { mode: 'split', focus: node.id });
			end();
			return;
		}

		// An instrument opens with all its articles: /api/nodes lists only some of them.
		if (node.kind === 'instrument') {
			const props = node.raw?.props;
			const bwbId = ((props?.['bwb_id'] as string | null) ?? node.key) || '';
			const result = bwbId ? await store.loadInstrument(bwbId) : null;
			if (result && result.count > 0) {
				// Every layer is loaded on entry, so the layer buttons read as on.
				void handleLoadLayer('instrument');
				void handleLoadLayer('judgment');
				void handleLoadLayer('dossier');
				// loadInstrument clears the selection, so the focus param would point at a stale id.
				const url = new URL($page.url.toString());
				url.searchParams.delete('focus');
				url.searchParams.set('mode', 'graph');
				goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
				graphView?.fitWhenSettled();
				end();
				return;
			}
			// Nothing loaded: fall through to the generic expansion.
		}

		setUrl({ focus: node.id });
		await deepen(node);
		end();
	}

	function handleOpenSplit(node: GraphNode) {
		setUrl({ mode: 'split', focus: node.id });
	}

	async function handleRailNavigate(collection: string, key: string) {
		if (!isCollection(collection)) return;
		const node = await store.expandNode(collection, key, { neighborLimit: 30 });
		if (!node) return;
		store.focusNode(node.id, { recordHistory: true });
		focusedNodeId = node.id;
		loadedFocus = node.id; // the focus effect must not load it again
		setUrl({ focus: node.id });
		if (showsGraph(mode)) await deepen(node);
	}

	function handleGoBack() {
		const id = store.goBack();
		if (id) navigateHistory(id);
	}

	function handleGoForward() {
		const id = store.goForward();
		if (id) navigateHistory(id);
	}

	// The focus effect reloads the node from the store cache and expands it again.
	function navigateHistory(id: string) {
		isHistoryNav = true;
		loadedFocus = '';
		deepenedId = '';
		setUrl({ focus: id });
	}

	// ── Layers ───────────────────────────────────────────────────────────────
	// A layer button loads one kind of source into the network:
	//   - a source is selected: only what is attached to the network already,
	//     so Judgments on a focused article does not add every judgment;
	//   - an instrument is shown: the instrument's own endpoint;
	//   - otherwise: the whole layer.
	// Activated layers read as pressed even when nothing new arrived.
	const activatedLayers = new SvelteSet<GraphNodeKind>();
	const loadingLayers = new SvelteSet<GraphNodeKind>();

	function ensureNodeTypesVisible(...kinds: GraphNodeKind[]) {
		const toggles = get(store.filters).nodeTypeToggles;
		if (kinds.every((k) => toggles[k])) return;
		store.setFilters({
			nodeTypeToggles: { ...toggles, ...Object.fromEntries(kinds.map((k) => [k, true])) }
		});
	}

	// Attached-only loads expand this many sources of the network, one request each.
	const ATTACHED_EXPAND_CAP = 30;

	// Expand the sources on the canvas and keep what was there plus the new
	// sources of the target kinds.
	async function loadAttachedOnly(targetKinds: ReadonlySet<GraphNodeKind>) {
		const before = get(store.nodes);
		const beforeIds = new Set(before.map((n) => n.id));
		const toExpand = before.filter((n) => !n.id.startsWith('synth:')).slice(0, ATTACHED_EXPAND_CAP);
		await Promise.all(
			toExpand.map((n) =>
				store.expandNode(n.collection, n.key, { neighborLimit: 50 }).catch(() => null)
			)
		);
		const keep = new Set(beforeIds);
		for (const n of get(store.nodes)) if (targetKinds.has(n.kind)) keep.add(n.id);
		store.pruneNodes(keep);
		store.sweepOrphans();
	}

	// One pass for several layers: separate passes would request the same sources twice.
	async function loadAttachedLayers(layers: GraphNodeKind[]) {
		const kinds = layers.flatMap(kindsForLayer);
		for (const l of layers) {
			activatedLayers.add(l);
			loadingLayers.add(l);
		}
		ensureNodeTypesVisible(...kinds);
		try {
			await loadAttachedOnly(new Set(kinds));
		} finally {
			for (const l of layers) loadingLayers.delete(l);
		}
	}

	type LayerLoader = {
		/** Also made visible when the whole layer is loaded. */
		extra?: GraphNodeKind[];
		/** The layer for the instrument in view. */
		instrument?: (bwb: string) => Promise<unknown>;
		whole: () => Promise<{ count: number } | null>;
	};

	const additive = { additive: true };
	const LAYERS: Partial<Record<GraphNodeKind, LayerLoader>> = {
		instrument: {
			instrument: (bwb) => store.loadInstrumentCitations(bwb, { relations: ['REFERS_TO'] }),
			whole: () => store.loadInstrumentLayerGraph(additive)
		},
		judgment: {
			extra: ['instrument'],
			instrument: (bwb) => store.loadInstrumentJudgmentsLayer(bwb),
			whole: () => store.loadJudgmentLayerGraph(additive)
		},
		// The dossiers of an instrument come with the documents that change its
		// articles, so the chain dossier, document, article is complete.
		dossier: {
			instrument: (bwb) =>
				Promise.all([
					store.loadInstrumentDossiersLayer(bwb),
					store.loadInstrumentCitations(bwb, { relations: ['AMENDS', 'INTRODUCES', 'REPEALS'] })
				]),
			whole: () => store.loadRecentDossiersGraph(additive)
		},
		committee: {
			extra: ['member'],
			whole: () => store.loadCommitteesLayerGraph(additive)
		},
		member: { whole: () => store.loadMembersLayerGraph(additive) },
		faction: { whole: () => store.loadFactionsLayerGraph(additive) }
	};

	async function handleLoadLayer(layer: GraphNodeKind) {
		const loader = LAYERS[layer];
		if (!loader) return;
		if (selectedNode) return loadAttachedLayers([layer]);

		loadingLayers.add(layer);
		activatedLayers.add(layer);
		try {
			ensureNodeTypesVisible(...kindsForLayer(layer));
			if (currentInstrumentBwb && loader.instrument) {
				await loader.instrument(currentInstrumentBwb);
				return;
			}
			ensureNodeTypesVisible(...(loader.extra ?? []));
			const result = await loader.whole();
			if (result && result.count > 0) setUrl({ mode: 'graph' });
		} finally {
			loadingLayers.delete(layer);
		}
	}

	// Re-expand the focus without the convergence prune, so every fetched source is shown.
	async function handleRevealHidden() {
		const sel = get(store.selection);
		if (!sel) return;
		graphView?.suppressFit();
		const epoch = ++focusEpoch;
		await expandToDepth(sel.id);
		if (epoch !== focusEpoch) return;
		store.sweepOrphans();
		totalLoaded = visibleCount = get(store.nodes).length;
		graphView?.fitWhenSettled();
	}

	// Remove every source of a layer (its sub-kinds included) and what the
	// orphan sweep leaves disconnected.
	function handleDeloadLayer(kind: GraphNodeKind) {
		const drop = new Set(kindsForLayer(kind));
		store.pruneNodes(
			new Set(
				get(store.nodes)
					.filter((n) => !drop.has(n.kind))
					.map((n) => n.id)
			)
		);
		store.sweepOrphans();
		activatedLayers.delete(kind);
	}

	function handleResetGraph() {
		store.reset();
		activatedLayers.clear();
		loadedFocus = '';
		deepenedId = '';
	}

	function setUrl(params: Record<string, string>) {
		const url = new URL($page.url.toString());
		for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	const setMode = (newMode: string) => setUrl({ mode: newMode });

	// ── Seed ─────────────────────────────────────────────────────────────────
	// ?seed=member:{key} | faction:{key} loads that network; dossier:{number} and
	// committee:{slug} become ?focus=. The parameter is one-shot: it is stripped
	// afterwards so a reload does not repeat it.
	let lastSeed = '';
	$effect(() => {
		const seed = $page.url.searchParams.get('seed') ?? '';
		if (!seed || seed === lastSeed) return;
		lastSeed = seed;
		void applySeed(seed);
	});

	async function applySeed(seed: string) {
		const colon = seed.indexOf(':');
		const type = seed.slice(0, colon);
		const value = seed.slice(colon + 1);
		let focus: string | null = null;
		try {
			if (type === 'member') await store.loadMemberGraph(value);
			else if (type === 'faction') await store.loadFactionGraph(value);
			else if (type === 'dossier') focus = nodeId('dossiers', value);
			else if (type === 'committee') {
				// The node key of a committee is a GUID; the seed carries the slug.
				const committees = await unwrap(api.GET('/api/committees'));
				const committee = committees.find((c) => c.slug === value);
				if (committee) focus = nodeId('committees', committee.key);
			}
		} catch (err) {
			console.warn('[explore] seed failed:', err);
		}
		const url = new URL($page.url.toString());
		url.searchParams.delete('seed');
		if (focus) url.searchParams.set('focus', focus);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	// ── Overlay (Activiteit or Mutatie, never both) ──────────────────────────
	// Two steps: `$page` changes on every navigation, the parameter string only when
	// the overlay does. The overlay object is what the effect below depends on.
	const overlayParam = $derived($page.url.searchParams.get('overlay'));
	const overlay = $derived<Overlay>(parseOverlay(overlayParam));

	// Bound to <GraphView> to request a fit after an expansion.
	let graphView = $state<GraphView | null>(null);
	// Only the active overlay is fetched, once per change of the parameter, and a
	// request the user has moved on from is aborted. Heat is a large answer.
	let inFluxMap = $state<NodeCounts>(new Map());
	let heatMap = $state<NodeCounts>(new Map());

	$effect(() => {
		const o = overlay;
		inFluxMap = new Map();
		heatMap = new Map();
		if (o.kind === 'none') return;

		const ctrl = new AbortController();
		const request =
			o.kind === 'heat'
				? getHeat(o.months, ctrl.signal)
				: o.kind === 'open'
					? getInFlux(ctrl.signal)
					: getDossierInFlux(o.id, ctrl.signal);
		request
			.then((counts) => {
				if (ctrl.signal.aborted) return;
				if (o.kind === 'heat') heatMap = counts;
				else inFluxMap = counts;
			})
			.catch((err) => {
				if (!ctrl.signal.aborted) console.warn('[explore] overlay load failed:', err);
			});
		return () => ctrl.abort();
	});

	function setOverlayParam(value: string | null) {
		const url = new URL($page.url.toString());
		if (value === null) url.searchParams.delete('overlay');
		else url.searchParams.set('overlay', value);
		goto(url.toString(), { replaceState: true, noScroll: true, keepFocus: true });
	}

	const toggleHeat = () =>
		setOverlayParam(overlay.kind === 'heat' ? null : `heat:${DEFAULT_HEAT_MONTHS}`);
	const setHeatPeriod = (months: number) => setOverlayParam(`heat:${months}`);
	// The toggle covers all open dossiers. A dossier overlay is entered by link
	// only; the toggle clears it.
	const toggleMutatie = () =>
		setOverlayParam(overlay.kind === 'open' || overlay.kind === 'dossier' ? null : 'open');

	// ── Share ────────────────────────────────────────────────────────────────
	let shareCopied = $state(false);

	async function handleShareView() {
		try {
			await navigator.clipboard.writeText($page.url.toString());
			shareCopied = true;
			setTimeout(() => {
				shareCopied = false;
			}, 1800);
		} catch {
			/* clipboard blocked */
		}
	}

	// Mobile panel tab for split mode
	let mobilePanel = $state<'reader' | 'graph' | 'citations'>('reader');

	// Notice on narrow viewports, shown once per session.
	let showMobileNotice = $state(false);
	function dismissMobileNotice() {
		showMobileNotice = false;
		try {
			sessionStorage.setItem('concordans:mobile-notice-dismissed', '1');
		} catch {
			/* ignore */
		}
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

		if (window.innerWidth < 768) {
			try {
				if (!sessionStorage.getItem('concordans:mobile-notice-dismissed')) {
					showMobileNotice = true;
				}
			} catch {
				/* ignore */
			}
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
	let activeDrag = $state<{ handle: DragHandle; startX: number; startW: number } | null>(null);

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
	// Plain 1, 2 and 3: with a modifier they switch browser tabs. Ignored while typing.
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
		const targetMode = e.key === '1' ? 'graph' : e.key === '2' ? 'split' : 'read';
		// Split and read need a selected source.
		if ((targetMode === 'split' || targetMode === 'read') && !selectedNode) return;
		if (targetMode !== mode) setUrl({ mode: targetMode });
	}

	// ── Index ────────────────────────────────────────────────────────────────
	// ?kind= picks the category in IndexView; an unknown value falls back to dossiers.
	const INDEX_KINDS = [
		'instruments',
		'judgments',
		'dossiers',
		'committees',
		'members',
		'factions',
		'decisions'
	] as const;
	type IndexKind = (typeof INDEX_KINDS)[number];
	const indexKind = $derived<IndexKind>(
		INDEX_KINDS.find((k) => k === $page.url.searchParams.get('kind')) ?? 'dossiers'
	);
	const handleIndexKind = (kind: IndexKind) => setUrl({ mode: 'index', kind });
	// Verdiepen: split mode, network next to the reader.
	const handleIndexSelect = (collection: string, key: string) =>
		setUrl({ mode: 'split', focus: `${collection}/${key}` });
	// Ontdekken: graph mode focused on the source.
	const handleIndexDiscover = (collection: string, key: string) =>
		setUrl({ mode: 'graph', focus: `${collection}/${key}` });
	// Lezen: full text without the network.
	const handleIndexRead = (collection: string, key: string) =>
		setUrl({ mode: 'read', focus: `${collection}/${key}` });

	// Result count of the index, shown in the status bar.
	let indexResultCount = $state<{ filtered: number; total: number } | null>(null);
	$effect(() => {
		void indexKind;
		indexResultCount = null;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Verkenner · Concordans</title>
</svelte:head>

{#snippet network(compact: boolean)}
	<GraphView
		bind:this={graphView}
		{store}
		{compact}
		{inFluxMap}
		{heatMap}
		{overlay}
		{visibleCount}
		{totalLoaded}
		onNodeClick={(n) => {
			handleNodeClick(n);
			if (compact) mobilePanel = 'reader';
		}}
		onOpenSplit={handleOpenSplit}
		onGoBack={handleGoBack}
		onGoForward={handleGoForward}
		onToggleHeat={toggleHeat}
		onHeatPeriodChange={setHeatPeriod}
		onToggleMutatie={toggleMutatie}
		onLoadLayer={handleLoadLayer}
		onDeloadLayer={handleDeloadLayer}
		onResetGraph={handleResetGraph}
		onRevealHidden={handleRevealHidden}
		{loadingLayers}
		{activatedLayers}
	/>
{/snippet}

<div class="explore-shell">
	<StatusBar
		node={selectedNode}
		{focusError}
		loadingCommittees={loadingLayers.has('committee')}
		{canGoBack}
		{canGoForward}
		{mode}
		indexCategory={mode === 'index' ? indexKind : null}
		indexResultCount={mode === 'index' ? indexResultCount : null}
		{shareCopied}
		onShareView={handleShareView}
		onGoBack={handleGoBack}
		onGoForward={handleGoForward}
		onLoadCommittees={() => handleLoadLayer('committee')}
		onModeChange={setMode}
	/>

	<div class="explore-content">
		{#if mode === 'index'}
			<IndexView
				category={indexKind}
				onSelectCategory={handleIndexKind}
				onSelectItem={handleIndexSelect}
				onDiscoverItem={handleIndexDiscover}
				onReadItem={handleIndexRead}
				onResultCountChange={({ filtered, total }) => (indexResultCount = { filtered, total })}
			/>
		{:else if mode === 'graph'}
			<div class="explore-graph">
				{#if nodeCount === 0}
					<EmptyCanvas />
				{/if}
				{@render network(false)}
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
					{@render network(true)}
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
					<p class="explore-read-empty__text">Zoek een artikel of arrest via de zoekbalk.</p>
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
								onPrev={prevArticleKey
									? () => handleRailNavigate('articles', prevArticleKey!)
									: undefined}
								onNext={nextArticleKey
									? () => handleRailNavigate('articles', nextArticleKey!)
									: undefined}
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

<!-- Tip voor eerste gebruik, rechtsonder. Blijft weg na sluiten (localStorage).
     Niet op mobiel: daar staat al de mobile-notice. -->
{#if !showMobileNotice}
	<WalkthroughCard />
{/if}

{#if showMobileNotice}
	<div class="mobile-notice" role="alert">
		<span class="mobile-notice__text"
			>Het netwerk werkt het best op een groter scherm. Op mobiel zijn lezen en de Index
			beschikbaar.</span
		>
		<a
			href="/explore?mode=index&kind=dossiers"
			class="mobile-notice__link"
			onclick={dismissMobileNotice}>Open Index →</a
		>
		<button
			type="button"
			class="mobile-notice__close"
			onclick={dismissMobileNotice}
			aria-label="Sluiten">×</button
		>
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
	.reader-empty p {
		margin: 0;
	}

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
		border-bottom: 1px solid rgba(255, 255, 255, 0.4);
		text-decoration: none;
		white-space: nowrap;
		font-size: 13px;
		transition: border-color var(--dur-1) var(--ease);
	}
	.mobile-notice__link:hover {
		border-color: var(--paper);
	}

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
	.mobile-notice__close:hover {
		opacity: 1;
	}
</style>

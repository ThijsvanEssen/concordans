<script lang="ts">
	// The explorer: one bron at a time, in one of three modes. Lezen shows the bron with
	// its verbindingen alongside; Netwerk shows the canvas and, once a bron is selected,
	// the same reader beside it; Bladeren lists bronnen. The URL holds the state:
	// ?mode, ?focus (the bron), ?naast (a toelichting opened beside an article),
	// ?overlay, ?kind (Bladeren) and the position inside the text as the fragment.
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { get } from 'svelte/store';
	import { track } from '$lib/analytics';
	import { getInFlux, getHeat, getDossierInFlux, type NodeCounts } from '$lib/api/overlays';
	import { bronHref } from '$lib/bron/href';
	import { createGraphStore } from '$lib/graph/graph-store';
	import GraphView from '$lib/components/graph/GraphView.svelte';
	import KindReader from '$lib/components/explore/KindReader.svelte';
	import DocumentReader from '$lib/components/explore/readers/DocumentReader.svelte';
	import StatusBar from '$lib/components/explore/StatusBar.svelte';
	import LezenNav from '$lib/components/explore/LezenNav.svelte';
	import IndexView from '$lib/components/explore/IndexView.svelte';
	import Verbonden from '$lib/verbonden/Verbonden.svelte';
	import { perfStart } from '$lib/util/perf';
	import { articleIdentity } from '$lib/util/law-id';
	import type { GraphNode } from '$lib/graph/types';
	import { parseOverlay, DEFAULT_HEAT_MONTHS, type Overlay } from '$lib/stores/overlay';
	import { isMode, parseNodeId, type Mode } from '$lib/vocabulary';

	// One store for the lifetime of this page, so it survives mode switches.
	const store = createGraphStore();

	let selectedNode = $state<GraphNode | null>(null);
	store.selection.subscribe((n) => {
		selectedNode = n;
	});

	let firstNodeTracked = false;
	store.nodes.subscribe((ns) => {
		if (ns.length > 0 && !firstNodeTracked) {
			firstNodeTracked = true;
			track('first_node', { kind: ns[0]?.kind ?? 'unknown' });
		}
	});

	let focusError = $state<string | null>(null);

	const param = (name: string) => page.url.searchParams.get(name);
	const mode = $derived<Mode>(isMode(param('mode')) ? (param('mode') as Mode) : 'graph');
	const focus = $derived(param('focus') ?? '');
	// A toelichting opened beside the article: the article stays the selected bron.
	const beside = $derived(parseNodeId(param('naast') ?? ''));

	const trackedModes = new Set<string>();
	$effect(() => {
		if (!trackedModes.has(mode)) {
			trackedModes.add(mode);
			track('mode_used', { mode });
		}
	});

	// Previous and next article in Lezen, from the table of contents of the law.
	let navItems = $state<{ key: string; label: string }[]>([]);
	const articleIndex = $derived(
		selectedNode ? navItems.findIndex((it) => it.key === selectedNode!.key) : -1
	);
	const articleHref = (i: number) =>
		i >= 0 && i < navItems.length
			? bronHref({ collection: 'articles', key: navItems[i].key })
			: undefined;

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
	// every mode but Bladeren; the expansion around it only where the canvas is
	// shown, and later when the mode switches to it. The browser keeps the history:
	// every link to a bron is a navigation.
	let loadedFocus = ''; // focus param whose node is in the store
	let deepenedId = ''; // node whose surroundings are expanded

	$effect(() => {
		if (!focus) {
			focusError = null;
			if (selectedNode) store.setSelection(null);
			return;
		}
		if (mode === 'index') return;
		if (focus !== loadedFocus) {
			loadedFocus = focus;
			void loadFocus(focus);
		} else if (mode === 'graph' && selectedNode) {
			void deepen(selectedNode);
		}
	});

	async function loadFocus(id: string) {
		focusError = null;
		const target = parseNodeId(id);
		if (!target) {
			focusError = `Bron '${id}' niet gevonden.`;
			return;
		}
		try {
			const node = await store.expandNode(target.collection, target.key, { neighborLimit: 30 });
			if (id !== loadedFocus) return; // superseded while loading
			if (!node) {
				focusError = `Bron '${target.key}' niet gevonden.`;
				return;
			}
			store.focusNode(node.id);
			if (mode === 'graph') await deepen(node);
		} catch (err) {
			console.warn('[explore] focus load failed:', err);
			focusError = `'${target.key}' niet geladen.`;
		}
	}

	// Expand around `node` once.
	async function deepen(node: GraphNode) {
		if (deepenedId === node.id) return;
		deepenedId = node.id;
		graphView?.suppressFit();
		const epoch = ++focusEpoch;
		await expandWithConvergencePaths(node, epoch);
		if (epoch !== focusEpoch) return;
		store.focusNode(node.id);
		graphView?.reseatAround(node.id);
		graphView?.fitWhenSettled();
	}

	// Selecting a bron on the canvas is opening it.
	function handleNodeClick(node: GraphNode) {
		const end = perfStart(`click ${node.id}`);
		if (!node.id.startsWith('synth:')) {
			track('network_expanded', { kind: node.kind });
			void goto(bronHref(node), { noScroll: true, keepFocus: true });
		}
		end();
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

	function handleResetGraph() {
		store.reset();
		loadedFocus = '';
		deepenedId = '';
	}

	function setUrl(params: Record<string, string | null>) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		void goto(url.pathname + url.search + url.hash, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	const setMode = (m: Mode) => setUrl({ mode: m, naast: null });

	// ── Overlay (open dossiers or citations per month, never both) ────────────
	const overlayParam = $derived(param('overlay'));
	const overlay = $derived<Overlay>(parseOverlay(overlayParam));

	// Bound to <GraphView> to request a fit after an expansion.
	let graphView = $state<GraphView | null>(null);
	// Only the active overlay is fetched, once per change of the parameter, and a
	// request the user has moved on from is aborted.
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

	const toggleHeat = () =>
		setUrl({ overlay: overlay.kind === 'heat' ? null : `heat:${DEFAULT_HEAT_MONTHS}` });
	const setHeatPeriod = (months: number) => setUrl({ overlay: `heat:${months}` });
	// The toggle covers all open dossiers. A dossier overlay is entered by link
	// only; the toggle clears it.
	const toggleMutatie = () =>
		setUrl({ overlay: overlay.kind === 'open' || overlay.kind === 'dossier' ? null : 'open' });

	// ── Share ────────────────────────────────────────────────────────────────
	let shareCopied = $state(false);

	async function handleShareView() {
		try {
			await navigator.clipboard.writeText(page.url.toString());
			shareCopied = true;
			setTimeout(() => {
				shareCopied = false;
			}, 1800);
		} catch {
			/* clipboard blocked */
		}
	}

	// Narrow viewports show one column at a time.
	let mobilePanel = $state<'reader' | 'graph' | 'verbonden'>('reader');

	// ── Resizable columns ────────────────────────────────────────────────────
	const WIDTHS_KEY = 'concordans:panel-widths';
	let navW = $state(200);
	let panelW = $state(260);
	let graphW = $state(360);

	onMount(() => {
		try {
			const raw = localStorage.getItem(WIDTHS_KEY);
			if (raw) {
				const p = JSON.parse(raw) as Record<string, number>;
				if (p.navW) navW = p.navW;
				if (p.panelW) panelW = p.panelW;
				if (p.graphW) graphW = p.graphW;
			}
		} catch {
			/* ignore */
		}
	});

	function saveWidths() {
		try {
			localStorage.setItem(WIDTHS_KEY, JSON.stringify({ navW, panelW, graphW }));
		} catch {
			/* ignore */
		}
	}

	type Handle = 'nav' | 'panel' | 'graph';
	let drag = $state<{ handle: Handle; startX: number; startW: number } | null>(null);

	function startResize(e: PointerEvent, handle: Handle) {
		e.preventDefault();
		const startW = handle === 'nav' ? navW : handle === 'panel' ? panelW : graphW;
		drag = { handle, startX: e.clientX, startW };
		(e.target as HTMLElement).setPointerCapture(e.pointerId);
	}

	function onResizeMove(e: PointerEvent) {
		if (!drag) return;
		const delta = e.clientX - drag.startX;
		if (drag.handle === 'nav') navW = Math.max(140, Math.min(320, drag.startW + delta));
		else if (drag.handle === 'graph') graphW = Math.max(200, Math.min(640, drag.startW + delta));
		else panelW = Math.max(180, Math.min(420, drag.startW - delta));
	}

	function onResizeEnd() {
		if (!drag) return;
		drag = null;
		saveWidths();
	}

	// ── Keys ─────────────────────────────────────────────────────────────────
	// 1, 2, 3 switch mode. With a modifier they switch browser tabs; ignored while typing.
	function handleKeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const index = ['1', '2', '3'].indexOf(e.key);
		if (index < 0) return;
		const el = document.activeElement as HTMLElement | null;
		if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
		e.preventDefault();
		const target = (['read', 'graph', 'index'] as const)[index];
		if (target !== mode) setMode(target);
	}

	// ── Bladeren ─────────────────────────────────────────────────────────────
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
	const indexKind = $derived<IndexKind>(INDEX_KINDS.find((k) => k === param('kind')) ?? 'dossiers');
	const openInMode = (m: Mode) => (collection: string, key: string) =>
		goto(bronHref(`${collection}/${key}`, { keepMode: false, mode: m }));

	let indexResultCount = $state<{ filtered: number; total: number } | null>(null);
	$effect(() => {
		void indexKind;
		indexResultCount = null;
	});

	const besideArticle = $derived(
		selectedNode?.collection === 'articles'
			? articleIdentity(selectedNode.raw?.props ?? undefined, selectedNode.key)?.articleNumber
			: null
	);
	const closeBesideHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.delete('naast');
		return url.pathname + url.search;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>Verkenner · Concordans</title>
</svelte:head>

{#snippet reader()}
	{#if selectedNode}
		<div class="reader" class:reader--pair={!!beside}>
			<div class="reader__main">
				<KindReader
					selection={selectedNode}
					prevHref={articleHref(articleIndex - 1)}
					nextHref={articleIndex >= 0 ? articleHref(articleIndex + 1) : undefined}
				/>
			</div>
			{#if beside}
				<div class="reader__beside">
					<a
						class="reader__close"
						href={closeBesideHref}
						data-sveltekit-noscroll
						aria-label="Sluiten">×</a
					>
					<DocumentReader node={beside} articleNumber={besideArticle} />
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet handle(which: Handle)}
	<div
		class="resize-handle"
		onpointerdown={(e) => startResize(e, which)}
		onpointermove={onResizeMove}
		onpointerup={onResizeEnd}
		aria-hidden="true"
	></div>
{/snippet}

<div class="explore-shell">
	<StatusBar
		node={selectedNode}
		{focusError}
		{mode}
		indexCategory={mode === 'index' ? indexKind : null}
		indexResultCount={mode === 'index' ? indexResultCount : null}
		{shareCopied}
		onShareView={handleShareView}
		onGoBack={() => history.back()}
		onGoForward={() => history.forward()}
		onModeChange={setMode}
	/>

	<div class="explore-content">
		{#if mode === 'index'}
			<IndexView
				category={indexKind}
				onSelectCategory={(kind) => setUrl({ kind })}
				onSelectItem={openInMode('read')}
				onDiscoverItem={openInMode('graph')}
				onReadItem={openInMode('read')}
				onResultCountChange={({ filtered, total }) => (indexResultCount = { filtered, total })}
			/>
		{:else if mode === 'graph'}
			<div
				class="explore-graph"
				class:explore-graph--with-reader={!!selectedNode}
				class:is-resizing={!!drag}
				style:--graph-w="{graphW}px"
				style:--panel-w="{panelW}px"
			>
				{#if selectedNode}
					<nav class="mobile-tabs" aria-label="Panelen">
						{#each [['reader', 'Tekst'], ['graph', 'Netwerk'], ['verbonden', 'Verbonden']] as [id, label] (id)}
							<button
								type="button"
								class="mobile-tab"
								class:active={mobilePanel === id}
								onclick={() => (mobilePanel = id as typeof mobilePanel)}>{label}</button
							>
						{/each}
					</nav>
				{/if}
				<div class="col col--graph" class:mobile-hidden={selectedNode && mobilePanel !== 'graph'}>
					<GraphView
						bind:this={graphView}
						{store}
						compact={!!selectedNode}
						{inFluxMap}
						{heatMap}
						{overlay}
						{visibleCount}
						{totalLoaded}
						onNodeClick={(n) => {
							handleNodeClick(n);
							mobilePanel = 'reader';
						}}
						onGoBack={() => history.back()}
						onGoForward={() => history.forward()}
						onToggleHeat={toggleHeat}
						onHeatPeriodChange={setHeatPeriod}
						onToggleMutatie={toggleMutatie}
						onResetGraph={handleResetGraph}
						onRevealHidden={handleRevealHidden}
					/>
				</div>
				{#if selectedNode}
					{@render handle('graph')}
					<div class="col col--reader" class:mobile-hidden={mobilePanel !== 'reader'}>
						{@render reader()}
					</div>
					{@render handle('panel')}
					<div class="col col--panel" class:mobile-hidden={mobilePanel !== 'verbonden'}>
						<Verbonden {store} selection={selectedNode} network />
					</div>
				{/if}
			</div>
		{:else if selectedNode}
			{@const withNav =
				selectedNode.collection === 'articles' || selectedNode.collection === 'instruments'}
			<div
				class="explore-read"
				class:explore-read--with-nav={withNav}
				class:is-resizing={!!drag}
				style:--nav-w="{navW}px"
				style:--panel-w="{panelW}px"
			>
				<nav class="mobile-tabs" aria-label="Panelen">
					{#each [['reader', 'Tekst'], ['verbonden', 'Verbonden']] as [id, label] (id)}
						<button
							type="button"
							class="mobile-tab"
							class:active={mobilePanel === id}
							onclick={() => (mobilePanel = id as typeof mobilePanel)}>{label}</button
						>
					{/each}
				</nav>
				{#if withNav}
					<div class="col col--nav mobile-hidden">
						<LezenNav selection={selectedNode} onitems={(it) => (navItems = it)} />
					</div>
					{@render handle('nav')}
				{/if}
				<div class="col col--reader col--measure" class:mobile-hidden={mobilePanel === 'verbonden'}>
					{@render reader()}
				</div>
				{@render handle('panel')}
				<div class="col col--panel" class:mobile-hidden={mobilePanel !== 'verbonden'}>
					<Verbonden {store} selection={selectedNode} />
				</div>
			</div>
		{:else if focusError}
			<p class="explore-empty">{focusError}</p>
		{/if}
	</div>
</div>

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

	.explore-graph,
	.explore-read {
		flex: 1;
		display: grid;
		grid-template-rows: 1fr;
		overflow: hidden;
	}

	.explore-graph {
		grid-template-columns: minmax(0, 1fr);
	}

	.explore-graph--with-reader {
		grid-template-columns: var(--graph-w) 5px minmax(0, 1fr) 5px var(--panel-w);
	}

	.explore-read {
		grid-template-columns: minmax(0, 1fr) 5px var(--panel-w);
	}

	.explore-read--with-nav {
		grid-template-columns: var(--nav-w) 5px minmax(0, 1fr) 5px var(--panel-w);
	}

	.col {
		height: 100%;
		min-width: 0;
		overflow: hidden;
	}

	.col--graph {
		display: flex;
		position: relative;
	}

	.col--panel {
		border-left: 1px solid var(--rule);
	}

	.reader {
		display: flex;
		height: 100%;
		justify-content: center;
	}

	.reader__main,
	.reader__beside {
		flex: 1;
		min-width: 0;
		height: 100%;
		overflow: hidden;
	}

	.reader__beside {
		position: relative;
		border-left: 1px solid var(--rule);
		background: var(--paper-2);
	}

	.reader__close {
		position: absolute;
		top: 6px;
		right: 10px;
		z-index: 2;
		font-family: var(--font-sans);
		font-size: 18px;
		line-height: 1;
		color: var(--ink-4);
		text-decoration: none;
	}

	.reader__close:hover {
		color: var(--ink);
	}

	.col--reader :global(.reader-frame) {
		max-width: 700px;
		width: 100%;
	}

	.col--measure :global(.reader-frame) {
		max-width: 900px;
		padding: var(--s-7) var(--s-7) var(--s-8);
	}

	.reader--pair :global(.reader-frame) {
		max-width: none;
		padding: var(--s-5);
	}

	.explore-empty {
		margin: var(--s-6);
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
	}

	.resize-handle {
		height: 100%;
		width: 5px;
		cursor: col-resize;
		background: var(--rule);
		transition: background var(--dur-1) var(--ease);
		flex-shrink: 0;
		position: relative;
		z-index: 5;
	}

	.resize-handle:hover,
	.is-resizing .resize-handle {
		background: var(--spine-faint);
	}

	.mobile-tabs {
		display: none;
	}

	@media (max-width: 1100px) and (min-width: 769px) {
		.explore-read--with-nav {
			grid-template-columns: var(--nav-w) 5px minmax(0, 1fr) 5px var(--panel-w);
		}
		.explore-graph--with-reader {
			grid-template-columns: 280px 5px minmax(0, 1fr) 5px var(--panel-w);
		}
	}

	@media (max-width: 768px) {
		.explore-graph,
		.explore-graph--with-reader,
		.explore-read,
		.explore-read--with-nav {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}
		.mobile-tabs {
			display: flex;
			grid-column: 1;
			grid-row: 1;
			border-bottom: 1px solid var(--rule);
			background: var(--paper-2);
		}
		.mobile-tab {
			flex: 1;
			font-family: var(--font-sans);
			font-size: 11px;
			color: var(--ink-3);
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			padding: 8px 4px 9px;
			cursor: pointer;
			margin-bottom: -1px;
			letter-spacing: 0.04em;
			text-transform: uppercase;
		}
		.mobile-tab.active {
			color: var(--ink);
			border-bottom-color: var(--ink);
			font-weight: 500;
		}
		.col {
			grid-row: 2;
			grid-column: 1;
		}
		.col--panel {
			border-left: 0;
		}
		.resize-handle,
		.mobile-hidden {
			display: none;
		}
		.reader--pair {
			flex-direction: column;
		}
		.reader__beside {
			border-left: 0;
			border-top: 1px solid var(--rule);
		}
	}
</style>

<script lang="ts">
	// The explorer: one bron at a time, in one of three modes. Lezen shows the bron with
	// its verbindingen alongside; Netwerk shows the canvas and, once a bron is selected,
	// the same reader beside it; Bladeren lists bronnen. The URL holds the state:
	// ?mode, ?focus (the bron), ?naast (a toelichting opened beside an article),
	// ?overlay, ?kind (Bladeren), the bronfilter (?bronnen, ?lid, ?rechter, ?van, ?tot,
	// ?geldend, ?betrouwbaarheid, ?status, ?jaar, ?zoek), ?tabel, ?diepte, and the
	// position inside the text as the fragment.
	import { onDestroy, onMount } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { track } from '$lib/analytics';
	import { getInFlux, getHeat, getDossierInFlux, type NodeCounts } from '$lib/api/overlays';
	import { bronHref, refId } from '$lib/bron/href';
	import { createGraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import GraphView from '$lib/components/graph/GraphView.svelte';
	import KindReader from '$lib/components/explore/KindReader.svelte';
	import DocumentReader from '$lib/components/explore/readers/DocumentReader.svelte';
	import StatusBar from '$lib/components/explore/StatusBar.svelte';
	import LezenNav from '$lib/components/explore/LezenNav.svelte';
	import DocumentToc from '$lib/components/explore/DocumentToc.svelte';
	import JudgmentToc from '$lib/components/explore/JudgmentToc.svelte';
	import IndexView from '$lib/components/explore/IndexView.svelte';
	import Verbonden from '$lib/verbonden/Verbonden.svelte';
	import FilterSheet from '$lib/verbonden/FilterSheet.svelte';
	import VerbindingCard from '$lib/verbonden/VerbindingCard.svelte';
	import VerbondenTabel from '$lib/verbonden/VerbondenTabel.svelte';
	import { filterParams, parseFilter, type VerbondenFilter } from '$lib/verbonden/filter';
	import type { Row } from '$lib/verbonden/rows';
	import { createVerbondenSource, type VerbondenState } from '$lib/verbonden/source';
	import { verbindingOfEdge, verbindingOfRow, type Verbinding } from '$lib/verbonden/verbinding';
	import { allRows, filterGroups, lidCounts } from '$lib/verbonden/view';
	import { perfStart } from '$lib/util/perf';
	import { articleIdentity } from '$lib/util/law-id';
	import type { GraphEdge, GraphNode, GraphNodeKind } from '$lib/graph/types';
	import { containerKindOf, isContainerKind } from '$lib/graph/container-membership';
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
	// All verbindingen as a table, in Lezen.
	const tableMode = $derived(param('tabel') === '1');
	// Steps from the focus that the canvas shows. Unset, this defaults to 1 for a wet,
	// fractie, commissie or dossier: its own children are already plenty (a fractie's
	// members alone can be dozens), and each one's own further connections are a step
	// away via Diepte; every other bron still defaults to 2.
	const depthParam = $derived(param('diepte'));
	const explicitDepth = $derived(
		depthParam ? Math.min(3, Math.max(1, Number(depthParam) || 2)) : null
	);
	const depthFor = (kind: GraphNodeKind) => explicitDepth ?? (isContainerKind(kind) ? 1 : 2);
	const depth = $derived(depthFor(selectedNode?.kind ?? 'other'));

	// ── The bronfilter ───────────────────────────────────────────────────────
	// One filter object, parsed from the URL, for the panel, the margin of the reader,
	// the canvas, the legend and the table.
	const filter = $derived<VerbondenFilter>(parseFilter(page.url.searchParams));
	let filterOpen = $state(false);
	const applyFilter = (f: VerbondenFilter) => setUrl(filterParams(f));

	// ── The verbindingen of the selected bron, loaded once ───────────────────
	const source = createVerbondenSource(store);
	let verbonden = $state<VerbondenState>({ id: null, groups: [], loading: false, failed: false });
	source.subscribe((s) => (verbonden = s));
	$effect(() => source.load(mode === 'index' ? null : selectedNode));
	onDestroy(() => source.destroy());

	// The counts in the margin of the reader hold under every filter but the lid, so a
	// lid keeps its count when another lid is chosen.
	const lidCountsOfArticle = $derived(
		lidCounts(allRows(filterGroups(verbonden.groups, { ...filter, lid: null })))
	);
	const billCount = $derived(
		allRows(verbonden.groups).filter((r) => r.kind === 'wetsvoorstellen').length
	);

	// ── The card Verbinding ──────────────────────────────────────────────────
	let card = $state<{ verbinding: Verbinding; edgeId: string | null; row: Row | null } | null>(
		null
	);
	$effect(() => {
		void selectedNode?.id;
		card = null;
	});
	function openRowCard(row: Row) {
		if (!selectedNode) return;
		const v = verbindingOfRow(row, selectedNode);
		if (v) card = { verbinding: v, edgeId: null, row };
	}
	function openEdgeCard(edge: GraphEdge) {
		const from = store.getNodeById(edge.source);
		const to = store.getNodeById(edge.target);
		if (!from || !to) return;
		card = { verbinding: verbindingOfEdge(edge, from, to), edgeId: edge.id, row: null };
	}
	function showInNetwork(row: Row) {
		if (selectedNode && row.relation && row.direction)
			store.showRows(selectedNode.id, [row as CanvasRow]);
		if (mode !== 'graph') setMode('graph');
	}
	const besideHrefOf = (row: Row | null) => {
		if (!row) return null;
		const url = new URL(page.url);
		url.searchParams.set('naast', refId(row.ref));
		url.hash = row.at ?? '';
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}${url.hash}`;
	};

	// A wetsvoorstel row whose proposed text the reader shows beside the current one.
	let proposedRow = $state<Row | null>(null);
	$effect(() => {
		void selectedNode?.id;
		proposedRow = null;
	});

	const trackedModes = new Set<string>();
	$effect(() => {
		if (!trackedModes.has(mode)) {
			trackedModes.add(mode);
			track('mode_used', { mode });
		}
	});

	// Previous and next article in Lezen, and the place of the article in its law,
	// from the table of contents of the law.
	let navItems = $state<{ key: string; label: string; breadcrumb: string[] }[]>([]);
	const articleIndex = $derived(
		selectedNode ? navItems.findIndex((it) => it.key === selectedNode!.key) : -1
	);
	const articleHref = (i: number) =>
		i >= 0 && i < navItems.length
			? bronHref({ collection: 'articles', key: navItems[i].key })
			: undefined;
	const place = $derived(articleIndex >= 0 ? navItems[articleIndex].breadcrumb : []);

	// ── Expansion around a focus ─────────────────────────────────────────────
	// One neighbourhood request of `depthFor(node)` steps; the bronfilter decides what
	// is drawn.
	let focusEpoch = 0;

	async function expandAround(node: GraphNode, epoch: number) {
		if (node.id.startsWith('synth:')) return;
		await store.expandNeighborhood(node.collection, node.key, {
			depth: depthFor(node.kind),
			cap: 200
		});
		if (epoch !== focusEpoch) return;
		store.sweepOrphans();
	}

	// ── Focus ────────────────────────────────────────────────────────────────
	let loadedFocus = '';
	let deepenedId = '';
	let deepenedDepth = 0;

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
			// A wet, fractie, commissie or dossier is a hull, not a scattered handful of
			// dots: its own children are its point, so they are not capped like an
			// ordinary bron's neighbours are.
			const neighborLimit = containerKindOf(target.collection) ? Number.POSITIVE_INFINITY : 30;
			const node = await store.expandNode(target.collection, target.key, { neighborLimit });
			if (id !== loadedFocus) return;
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

	// Expand around `node` once per depth.
	async function deepen(node: GraphNode) {
		const d = depthFor(node.kind);
		if (deepenedId === node.id && deepenedDepth === d) return;
		deepenedId = node.id;
		deepenedDepth = d;
		graphView?.suppressFit();
		const epoch = ++focusEpoch;
		await expandAround(node, epoch);
		if (epoch !== focusEpoch) return;
		store.focusNode(node.id);
		graphView?.reseatAround(node.id);
		graphView?.fitWhenSettled();
	}

	function handleNodeClick(node: GraphNode) {
		const end = perfStart(`click ${node.id}`);
		if (!node.id.startsWith('synth:')) {
			track('network_expanded', { kind: node.kind });
			void goto(bronHref(node), { noScroll: true, keepFocus: true });
		}
		end();
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
		const search = url.search.replaceAll('%2F', '/').replaceAll('%2C', ',');
		void goto(url.pathname + search + url.hash, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	const setMode = (m: Mode) => setUrl({ mode: m, naast: null, tabel: null });
	// Always explicit: unlike before, an unset diepte no longer means "2" for every
	// bron, so removing the param on a plain "2" click would silently change meaning
	// for a container (default 1).
	const setDepth = (d: number) => setUrl({ diepte: String(d) });

	const tableHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.set('mode', 'read');
		url.searchParams.set('tabel', '1');
		url.searchParams.delete('naast');
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}`;
	});
	const readHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.delete('tabel');
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/').replaceAll('%2C', ',')}`;
	});

	// ── Overlay (open dossiers or citations per month, never both) ────────────
	const overlayParam = $derived(param('overlay'));
	const overlay = $derived<Overlay>(parseOverlay(overlayParam));

	let graphView = $state<GraphView | null>(null);
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
	let navW = $state(220);
	let panelW = $state(400);
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
		else panelW = Math.max(240, Math.min(520, drag.startW - delta));
	}

	function onResizeEnd() {
		if (!drag) return;
		drag = null;
		saveWidths();
	}

	// ── Keys ─────────────────────────────────────────────────────────────────
	// 1, 2, 3 switch mode; ignored while typing or with a modifier.
	function handleKeydown(e: KeyboardEvent) {
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const index = ['1', '2'].indexOf(e.key);
		if (index < 0) return;
		const el = document.activeElement as HTMLElement | null;
		if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
		e.preventDefault();
		const target = (['read', 'graph'] as const)[index];
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
			? articleIdentity(selectedNode.raw?.props ?? undefined, selectedNode.key)
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
					{place}
					lidCounts={lidCountsOfArticle}
					{billCount}
					{filter}
					{proposedRow}
					onCloseProposed={() => (proposedRow = null)}
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
					<DocumentReader node={beside} article={besideArticle} />
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet panel(network: boolean)}
	{#if selectedNode}
		<div class="panel">
			<Verbonden
				{verbonden}
				selection={selectedNode}
				{filter}
				{store}
				{network}
				onFilter={applyFilter}
				onOpenFilter={() => (filterOpen = true)}
				onVerbinding={openRowCard}
				onShowInNetwork={showInNetwork}
				onProposedText={(row) => (proposedRow = row)}
				{tableHref}
			/>
			{#if card && !network}
				<div class="panel__card">
					<VerbindingCard
						verbinding={card.verbinding}
						besideHref={card.verbinding.relation === 'EXPLAINS' ? besideHrefOf(card.row) : null}
						onClose={() => (card = null)}
						onShowInNetwork={card.row ? () => showInNetwork(card!.row!) : undefined}
					/>
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
		{tableMode}
		indexCategory={mode === 'index' ? indexKind : null}
		indexResultCount={mode === 'index' ? indexResultCount : null}
		{shareCopied}
		onShareView={handleShareView}
		onGoBack={() => history.back()}
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
						{filter}
						{verbonden}
						{depth}
						selectedEdgeId={card?.edgeId ?? null}
						{inFluxMap}
						{heatMap}
						{overlay}
						onNodeClick={(n) => {
							handleNodeClick(n);
							mobilePanel = 'reader';
						}}
						onEdgeClick={openEdgeCard}
						onClear={() => (card = null)}
						onGoBack={() => history.back()}
						onGoForward={() => history.forward()}
						onFilter={applyFilter}
						onOpenFilter={() => (filterOpen = true)}
						onDepth={setDepth}
						onToggleHeat={toggleHeat}
						onHeatPeriodChange={setHeatPeriod}
						onToggleMutatie={toggleMutatie}
						onResetGraph={handleResetGraph}
					/>
					{#if card}
						<VerbindingCard
							verbinding={card.verbinding}
							docked
							besideHref={card.verbinding.relation === 'EXPLAINS' ? besideHrefOf(card.row) : null}
							onClose={() => (card = null)}
						/>
					{/if}
				</div>
				{#if selectedNode}
					{@render handle('graph')}
					<div class="col col--reader" class:mobile-hidden={mobilePanel !== 'reader'}>
						{@render reader()}
					</div>
					{@render handle('panel')}
					<div class="col col--panel" class:mobile-hidden={mobilePanel !== 'verbonden'}>
						{@render panel(true)}
					</div>
				{/if}
			</div>
		{:else if selectedNode && tableMode}
			<div class="explore-table">
				<VerbondenTabel
					{verbonden}
					selection={selectedNode}
					{filter}
					onOpenFilter={() => (filterOpen = true)}
					onRow={openRowCard}
					backHref={readHref}
				/>
				{#if card}
					<div class="explore-table__card">
						<VerbindingCard
							verbinding={card.verbinding}
							besideHref={card.verbinding.relation === 'EXPLAINS' ? besideHrefOf(card.row) : null}
							onClose={() => (card = null)}
							onShowInNetwork={card.row ? () => showInNetwork(card!.row!) : undefined}
						/>
					</div>
				{/if}
			</div>
		{:else if selectedNode}
			{@const withNav =
				selectedNode.collection === 'articles' ||
				selectedNode.collection === 'instruments' ||
				selectedNode.collection === 'documents' ||
				selectedNode.collection === 'judgments'}
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
						{#if selectedNode.collection === 'documents'}
							<DocumentToc selection={selectedNode} />
						{:else if selectedNode.collection === 'judgments'}
							<JudgmentToc selection={selectedNode} />
						{:else}
							<LezenNav selection={selectedNode} onitems={(it) => (navItems = it)} />
						{/if}
					</div>
					{@render handle('nav')}
				{/if}
				<div class="col col--reader col--measure" class:mobile-hidden={mobilePanel === 'verbonden'}>
					{@render reader()}
				</div>
				{@render handle('panel')}
				<div class="col col--panel" class:mobile-hidden={mobilePanel !== 'verbonden'}>
					{@render panel(false)}
				</div>
			</div>
		{:else if focusError}
			<p class="explore-empty">{focusError}</p>
		{/if}
	</div>
</div>

{#if selectedNode}
	<FilterSheet
		open={filterOpen}
		{filter}
		groups={verbonden.groups}
		selection={selectedNode.collection}
		onApply={applyFilter}
		onClose={() => (filterOpen = false)}
	/>
{/if}

<style>
	.explore-shell {
		display: flex;
		flex-direction: column;
		height: calc(100vh - 60px);
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

	.explore-table {
		flex: 1;
		position: relative;
		overflow: hidden;
	}

	.explore-table__card {
		position: absolute;
		right: var(--s-5);
		bottom: var(--s-5);
		width: 420px;
		max-width: calc(100% - 2 * var(--s-5));
		z-index: var(--z-float);
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

	.panel {
		position: relative;
		height: 100%;
	}

	.panel__card {
		position: absolute;
		left: var(--s-3);
		right: var(--s-3);
		bottom: var(--s-3);
		z-index: var(--z-float);
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

	/* The toelichting reads alongside the article, not the other way around: below it,
	   full width, rather than squeezed into a narrow side column. */
	.reader--pair {
		flex-direction: column;
	}

	.reader__beside {
		position: relative;
		border-top: 1px solid var(--rule);
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
		color: var(--ink-3);
		text-decoration: none;
	}

	.reader__close:hover {
		color: var(--ink);
	}

	.col--reader :global(.reader-frame) {
		max-width: 760px;
		width: 100%;
	}

	.col--measure :global(.reader-frame) {
		max-width: 900px;
		padding: 40px 48px 40px 64px;
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
		background: var(--rule-strong);
	}

	.mobile-tabs {
		display: none;
	}

	@media (max-width: 1100px) and (min-width: 769px) {
		.explore-read--with-nav {
			grid-template-columns: var(--nav-w) 5px minmax(0, 1fr) 5px var(--panel-w);
		}
		/* Too narrow for graph, reader and Verbonden side by side; too wide to hide
		   two of the three behind tabs. The network keeps the full width up top,
		   Tekst and Verbonden split the row below it. */
		.explore-graph--with-reader {
			grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
			grid-template-rows: minmax(220px, 38vh) minmax(0, 1fr);
		}
		.explore-graph--with-reader .col--graph {
			grid-column: 1 / -1;
			grid-row: 1;
			border-bottom: 1px solid var(--rule);
		}
		.explore-graph--with-reader .col--reader {
			grid-column: 1;
			grid-row: 2;
		}
		.explore-graph--with-reader .col--panel {
			grid-column: 2;
			grid-row: 2;
		}
		.explore-graph--with-reader .resize-handle {
			display: none;
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
			font-size: 12.5px;
			color: var(--ink-3);
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			padding: 8px 4px 9px;
			cursor: pointer;
			margin-bottom: -1px;
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
	}
</style>

<script lang="ts">
	import { createCopier } from '$lib/components/ui/copy.svelte';
	// The explorer: one bron at a time, in one of three modes. Lezen shows the bron with
	// its verbindingen alongside; Netwerk shows the canvas and, once a bron is selected,
	// the same reader beside it; Bladeren lists bronnen. The URL holds the state:
	// ?mode, ?focus (the bron), ?naast (a toelichting opened beside an article),
	// ?overlay, ?kind (Bladeren), the bronfilter (?bronnen, ?lid, ?rechter, ?van, ?tot,
	// ?geldend, ?betrouwbaarheid, ?status, ?jaar, ?zoek), ?tabel, ?diepte, the netwerk of
	// chosen bronnen (?netwerk, ?uit, ?tussen), and the position inside the text as the
	// fragment.
	//
	// A click on the canvas selects a bron: the reader follows, the canvas stays. A double
	// click replaces the canvas with the bron's own neighbourhood.
	import { onDestroy, onMount, untrack } from 'svelte';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import { tabTitle } from '$lib/bron/tab-title';
	import { track } from '$lib/analytics';
	import { ApiError } from '$lib/api/client';
	import { getInFlux, getHeat, getDossierInFlux, type NodeCounts } from '$lib/api/overlays';
	import { bronHref, focusOf, isReadable, refId, refOf } from '$lib/bron/href';
	import { getDossier } from '$lib/components/parliamentary/data';
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
	import { isIndexCategory, type IndexCategory } from '$lib/components/explore/index/categories';
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
	import type { GraphEdge, GraphNode, GraphNodeKind } from '$lib/graph/types';
	import { containerKindOf, isContainerKind } from '$lib/graph/container-membership';
	import { parseOverlay, DEFAULT_HEAT_MONTHS, type Overlay } from '$lib/stores/overlay';
	import { parseNodeId, type Mode } from '$lib/vocabulary';
	import type { Schema } from '$lib/api/types';
	import { articleOf, nodeToGraphNode } from '$lib/graph/types';
	import NetwerkPanel from '$lib/netwerk/NetwerkPanel.svelte';
	import {
		EMPTY_NETWERK,
		isOn,
		netwerkParams,
		parseNetwerk,
		withAdded,
		withRemoved,
		withToggled,
		type Netwerk,
		type NetwerkEntry
	} from '$lib/netwerk/netwerk';

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
	/** The focus is a bron the dataset does not hold: the page says so instead of an empty canvas. */
	let focusMissing = $state(false);

	const param = (name: string) => page.url.searchParams.get(name);
	// The Verkenner is the network. A bron with a text of its own is read at full width
	// (?lezen=1, once ?mode=read); its verbindingen as a table are read so too. Bladeren
	// is ?mode=index.
	const readableFocus = $derived.by(() => {
		const target = parseNodeId(param('focus') ?? '');
		return target ? isReadable(target.collection) : false;
	});
	const mode = $derived.by<Mode>(() => {
		const m = param('mode');
		if (m === 'index') return 'index';
		if (!param('focus')) return 'graph';
		if (param('tabel') === '1') return 'read';
		const wantsRead = param('lezen') === '1' || m === 'read';
		return wantsRead && readableFocus ? 'read' : 'graph';
	});
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
	// The bron the canvas is drawn around; a click selects another without moving it.
	let anchorKind = $state<GraphNodeKind>('other');
	const depth = $derived(depthFor(anchorKind));

	// ── The netwerk of chosen bronnen ─────────────────────────────────────────
	// Parsed from its own three params only, so selecting a bron does not compose again.
	const netwerkQuery = $derived(
		['netwerk', 'uit', 'tussen']
			.map((k) => [k, param(k)])
			.filter(([, v]) => v !== null)
			.map(([k, v]) => `${k}=${encodeURIComponent(v!)}`)
			.join('&')
	);
	const netwerk = $derived<Netwerk>(parseNetwerk(new URLSearchParams(netwerkQuery)));
	const netwerkActive = $derived(netwerk.ids.length > 0);

	// ── The bronfilter ───────────────────────────────────────────────────────
	// One filter object, parsed from the URL, for the panel, the margin of the reader,
	// the canvas, the legend and the table. Keyed on its own params only: a change
	// elsewhere in the URL (?versies, ?naast) must not hand every consumer a new object
	// and redraw the canvas and the panel.
	const filterKey = $derived(JSON.stringify(filterParams(parseFilter(page.url.searchParams))));
	const filter = $derived<VerbondenFilter>(
		parseFilter(
			new URLSearchParams(
				Object.entries(JSON.parse(filterKey) as Record<string, string | null>).filter(
					(e): e is [string, string] => e[1] !== null
				)
			)
		)
	);
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
		if (mode !== 'graph') setReading(false);
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
		// A dossier's stukken change wetten two steps away (dossier, stuk, wet): the one
		// step of a container leaves those changes out, so they are asked for on their own.
		if (node.collection === 'dossiers') {
			await store.expandNeighborhood(node.collection, node.key, {
				depth: 2,
				cap: 200,
				relations: ['PART_OF', 'AMENDS', 'INTRODUCES', 'REPEALS'],
				nodeTypes: ['document', 'instrument', 'dossier']
			});
			if (epoch !== focusEpoch) return;
		}
		store.sweepOrphans();
	}

	// ── Focus ────────────────────────────────────────────────────────────────
	// A focus already on the canvas is selected; the canvas stays. One that is not, or
	// one double clicked (`replaceNext`), becomes the bron the canvas is drawn around.
	// With a netwerk the canvas is the netwerk's: a focus not on it is only added.
	let loadedFocus = '';
	let deepenedId = '';
	let deepenedDepth = 0;
	let replaceNext: string | null = null;

	$effect(() => {
		// Read here, not only inside `deepen`: that branch does not run on the first pass,
		// so a change of ?diepte would otherwise not rerun the effect until a reload.
		void explicitDepth;
		const withNetwerk = netwerkActive;
		if (!focus) {
			focusError = null;
			if (selectedNode) store.setSelection(null);
			return;
		}
		if (mode === 'index') return;
		if (focus !== loadedFocus || replaceNext === focus) {
			loadedFocus = focus;
			void loadFocus(focus);
		} else if (mode === 'graph' && !withNetwerk) {
			const anchor = (deepenedId && store.getNodeById(deepenedId)) || selectedNode;
			if (anchor) void deepen(anchor);
		}
	});

	/** The message for a bron the dataset does not hold. */
	function missing(key: string) {
		focusMissing = true;
		focusError = `'${key}' staat niet in de dataset.`;
	}

	async function loadFocus(id: string) {
		focusError = null;
		focusMissing = false;
		const replace = replaceNext === id;
		replaceNext = null;
		const target = parseNodeId(id);
		if (!target) {
			focusError = `Bron '${id}' niet gevonden.`;
			return;
		}
		try {
			// A link names a dossier by its number (`37020-XV`); the API gives its node key.
			if (target.collection === 'dossiers') target.key = (await getDossier(target.key)).key;
			if (id !== loadedFocus) return;
			const onCanvas =
				store.getNodeById(`${target.collection}/${target.key}`) ??
				store.getNodeById(`${target.collection}/${target.key.toLowerCase()}`);
			const inGraph = untrack(() => mode === 'graph');
			const withNetwerk = untrack(() => netwerkActive);
			if (!replace && onCanvas && (withNetwerk || deepenedId)) {
				store.focusNode(onCanvas.id);
				return;
			}
			if (!replace && withNetwerk && inGraph) {
				const node = await store.expandNode(target.collection, target.key, { neighborLimit: 0 });
				if (id !== loadedFocus) return;
				if (node) store.focusNode(node.id);
				else missing(target.key);
				return;
			}
			// A wet, fractie, commissie or dossier is a hull, not a scattered handful of
			// dots: its own children are its point, so they are not capped like an
			// ordinary bron's neighbours are.
			const neighborLimit = containerKindOf(target.collection) ? Number.POSITIVE_INFINITY : 30;
			const node = await store.expandNode(target.collection, target.key, { neighborLimit });
			if (id !== loadedFocus) return;
			if (!node) {
				missing(target.key);
				return;
			}
			store.focusNode(node.id);
			if (inGraph) await deepen(node, replace);
		} catch (err) {
			if (err instanceof ApiError && err.status === 404) {
				missing(target.key);
				return;
			}
			console.warn('[explore] focus load failed:', err);
			focusError = `'${target.key}' niet geladen.`;
		}
	}

	// Expand around `node` once per depth, or again when `force`d.
	async function deepen(node: GraphNode, force = false) {
		const d = depthFor(node.kind);
		if (!force && deepenedId === node.id && deepenedDepth === d) return;
		deepenedId = node.id;
		deepenedDepth = d;
		anchorKind = node.kind;
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
			void goto(bronHref(refOf(node.collection, node.key, node.raw?.props)), {
				noScroll: true,
				keepFocus: true
			});
		}
		end();
	}

	// A double click leaves the netwerk and draws the bron's own neighbourhood.
	function handleNodeReplace(node: GraphNode) {
		if (node.id.startsWith('synth:')) return;
		const ref = refOf(node.collection, node.key, node.raw?.props);
		const id = focusOf(ref);
		if (!id) return;
		if (netwerkActive) {
			store.releaseNetwerk();
			composedOnce = false;
		}
		replaceNext = id;
		if (id === focus && !netwerkActive) {
			replaceNext = null;
			void deepen(node, true);
			return;
		}
		void goto(bronHref(ref, { keepNetwerk: false }), { noScroll: true, keepFocus: true });
	}

	// ── Composing the netwerk ─────────────────────────────────────────────────
	let netwerkEntries = $state<NetwerkEntry[]>([]);
	let netwerkLoading = $state(false);
	let joiningCount = $state(0);
	let composeEpoch = 0;
	// Whether the canvas is a composed netwerk now; the first composition of one draws it
	// from scratch unless it grows out of the current canvas (`keepCanvas`).
	let composedOnce = false;
	let keepCanvas = false;

	const resolved = new Map<string, Promise<Schema<'NodeGraphResponse'>>>();
	function responseOf(id: string): Promise<Schema<'NodeGraphResponse'>> {
		let request = resolved.get(id);
		if (!request) {
			const target = parseNodeId(id);
			if (!target) return Promise.reject(new Error(`no bron ${id}`));
			request = (async () => {
				const key =
					target.collection === 'dossiers' ? (await getDossier(target.key)).key : target.key;
				return store.nodeResponse(target.collection, key);
			})();
			request.catch(() => resolved.delete(id));
			resolved.set(id, request);
		}
		return request;
	}

	$effect(() => {
		const n = netwerk;
		if (mode !== 'graph') return;
		untrack(() => {
			if (n.ids.length > 0) void compose(n);
			else if (composedOnce) {
				store.releaseNetwerk();
				composedOnce = false;
				netwerkEntries = [];
			}
		});
	});

	async function compose(n: Netwerk) {
		const epoch = ++composeEpoch;
		netwerkLoading = true;
		const results = await Promise.allSettled(n.ids.map(responseOf));
		if (epoch !== composeEpoch) return;
		const participants: { response: Schema<'NodeGraphResponse'> }[] = [];
		const found: { id: string; response: Schema<'NodeGraphResponse'> }[] = [];
		const missing: string[] = [];
		results.forEach((r, i) => {
			if (r.status !== 'fulfilled') {
				missing.push(n.ids[i]);
				return;
			}
			found.push({ id: n.ids[i], response: r.value });
			if (isOn(n, n.ids[i])) participants.push({ response: r.value });
		});
		const fresh = !composedOnce && !keepCanvas;
		keepCanvas = false;
		graphView?.suppressFit();
		const { alone, joining } = store.compose({ participants, withJoining: n.tussen, fresh });
		composedOnce = true;
		joiningCount = joining.length;
		netwerkEntries = found.map(({ id, response }) => {
			const node = nodeToGraphNode(response.node);
			return {
				id,
				label: node?.label ?? response.node.display_name ?? id,
				collection: response.node.collection as NetwerkEntry['collection'],
				on: isOn(n, id),
				alone:
					participants.length > 1 && alone.has(`${response.node.collection}/${response.node.key}`)
			};
		});
		// A chosen bron the API does not know (an old link, a removed record) stays listed,
		// so the netwerk does not shrink without a word.
		for (const id of missing) {
			const ref = parseNodeId(id);
			if (!ref) continue;
			netwerkEntries.push({
				id,
				label: id.slice(id.indexOf('/') + 1),
				collection: ref.collection as NetwerkEntry['collection'],
				on: false,
				alone: false,
				missing: true
			});
		}
		netwerkLoading = false;
		graphView?.fitWhenSettled();
	}

	function setNetwerk(n: Netwerk) {
		if (n.ids.length === 0) remember(null);
		// Clearing the netwerk or removing a bron is undone with Back.
		const shrinks = n.ids.length < netwerk.ids.length;
		setUrl(netwerkParams(n), { push: shrinks });
	}

	// The Verkenner opens on the last netwerk until it is cleared: a double click that
	// leaves it, or a bron opened elsewhere, does not forget it.
	const NETWERK_KEY = 'concordans:netwerk';
	function remember(query: string | null) {
		try {
			if (query) localStorage.setItem(NETWERK_KEY, query);
			else localStorage.removeItem(NETWERK_KEY);
		} catch {
			/* storage blocked */
		}
	}
	$effect(() => {
		if (netwerk.ids.length > 0) remember(netwerkQuery);
	});
	$effect(() => {
		if (focus || netwerkQuery || mode === 'index') return;
		let saved: string | null = null;
		try {
			saved = localStorage.getItem(NETWERK_KEY);
		} catch {
			/* storage blocked */
		}
		if (saved) untrack(() => setUrl(Object.fromEntries(new URLSearchParams(saved))));
	});
	const linkIdOf = (node: GraphNode) =>
		node.id.startsWith('synth:')
			? null
			: focusOf(refOf(node.collection, node.key, node.raw?.props));
	const selectedLinkId = $derived(selectedNode ? linkIdOf(selectedNode) : null);

	function addToNetwerk(node: GraphNode) {
		const id = linkIdOf(node);
		if (id) addIdToNetwerk(id);
	}

	function addIdToNetwerk(id: string) {
		// The first bron chosen grows out of the canvas as it is: what is there stays, as context.
		if (!netwerkActive) keepCanvas = true;
		setNetwerk(withAdded(netwerk, id));
	}

	function toggleChosen(node: GraphNode) {
		const id = linkIdOf(node);
		if (!id) return;
		if (netwerk.ids.includes(id)) setNetwerk(withRemoved(netwerk, id));
		else addToNetwerk(node);
	}

	function handleResetGraph() {
		store.reset();
		resolved.clear();
		loadedFocus = '';
		deepenedId = '';
		composedOnce = false;
		netwerkEntries = [];
		if (netwerkActive) setNetwerk(EMPTY_NETWERK);
	}

	// The tab names what is open, so that tabs, bookmarks and history tell bronnen apart.
	const pageTitle = $derived.by(() => {
		if (mode === 'index') return 'Bladeren · Concordans';
		const name = selectedNode ? tabTitle(selectedNode) : null;
		if (name) return `${name} · Concordans`;
		if (netwerkActive) return 'Netwerk · Concordans';
		return 'Verkenner · Concordans';
	});

	// The ← of the status bar goes back inside Concordans; a bron opened from a link
	// elsewhere (a new tab, a shared link) has no step to go back to, so it goes home.
	let steppedIn = $state(false);
	// A replaced entry (a filter) is no step; a link, Back itself, or a change of bron or
	// of reading mode is.
	afterNavigate((nav) => {
		const from = nav.from?.url.searchParams;
		const to = nav.to?.url.searchParams;
		const changed = (name: string) => (from?.get(name) ?? null) !== (to?.get(name) ?? null);
		if (nav.type === 'link' || nav.type === 'popstate' || changed('focus') || changed('lezen'))
			steppedIn = true;
	});
	const goBack = () => (steppedIn ? history.back() : goto('/'));

	/**
	 * A change of view that Back should undo (reading at full width, clearing the netwerk)
	 * takes a history entry; a filter or a toggle replaces the current one.
	 */
	function setUrl(params: Record<string, string | null>, { push = false } = {}) {
		const url = new URL(page.url);
		for (const [k, v] of Object.entries(params)) {
			if (v === null) url.searchParams.delete(k);
			else url.searchParams.set(k, v);
		}
		const search = url.search.replaceAll('%2F', '/').replaceAll('%2C', ',');
		void goto(url.pathname + search + url.hash, {
			replaceState: !push,
			noScroll: true,
			keepFocus: true
		});
	}

	// Reading at full width, or the network with the text beside it.
	const setReading = (on: boolean) =>
		setUrl({ lezen: on ? '1' : null, mode: null, naast: null, tabel: null }, { push: true });
	// Always explicit: unlike before, an unset diepte no longer means "2" for every
	// bron, so removing the param on a plain "2" click would silently change meaning
	// for a container (default 1).
	// With a netwerk a depth adds context around the selection; the netwerk stays.
	function setDepth(d: number) {
		if (!netwerkActive) {
			setUrl({ diepte: String(d) });
			return;
		}
		if (!selectedNode || selectedNode.id.startsWith('synth:')) return;
		graphView?.suppressFit();
		void store
			.expandNeighborhood(selectedNode.collection, selectedNode.key, {
				depth: d,
				cap: 200,
				additive: true
			})
			.then(() => graphView?.fitWhenSettled());
	}

	const tableHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.set('tabel', '1');
		url.searchParams.delete('mode');
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
	const shareCopier = createCopier();
	const handleShareView = () => shareCopier.copy(page.url.toString(), 'share');

	// Narrow viewports show one column at a time.
	let mobilePanel = $state<'reader' | 'graph' | 'verbonden'>('reader');
	// Below --nav-w's own breakpoint, Lezen's table of contents opens as a sheet
	// instead of taking a permanent column.
	let tocOpen = $state(false);
	$effect(() => {
		void selectedNode?.id;
		tocOpen = false;
	});
	// Picking a bron closes the sheet; opening or closing a Boek/Titel group (a
	// <summary>) must not, or the tree could never be opened inside it.
	function onTocBodyClick(e: MouseEvent) {
		if ((e.target as HTMLElement).closest('summary')) return;
		tocOpen = false;
	}

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
	// L reads the selected bron at full width, or goes back to the network; ignored
	// while typing or with a modifier.
	function handleKeydown(e: KeyboardEvent) {
		if (tocOpen && e.key === 'Escape') {
			tocOpen = false;
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		if (e.key.toLowerCase() !== 'l' || !readAction) return;
		const el = document.activeElement as HTMLElement | null;
		if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
		e.preventDefault();
		setReading(readAction === 'read');
	}

	/** What the button in the status bar does: read the bron, or go back to the network. */
	const readAction = $derived<'read' | 'network' | null>(
		// The table has its own way back to the text.
		tableMode
			? null
			: mode === 'read'
				? 'network'
				: mode === 'graph' && readableFocus && selectedNode
					? 'read'
					: null
	);

	// ── Bladeren ─────────────────────────────────────────────────────────────
	const indexKind = $derived<IndexCategory>(
		isIndexCategory(param('kind')) ? (param('kind') as IndexCategory) : 'dossiers'
	);

	// The count the list reported, kept with its category: shown only for the category on
	// screen, so a count of the previous one never stands beside the next.
	let reportedCount = $state<{ filtered: number; total: number; category: string } | null>(null);
	const indexResultCount = $derived(
		reportedCount?.category === indexKind
			? { filtered: reportedCount.filtered, total: reportedCount.total }
			: null
	);

	const besideArticle = $derived(
		selectedNode?.collection === 'articles' ? articleOf(selectedNode.raw?.props) : null
	);
	const closeBesideHref = $derived.by(() => {
		const url = new URL(page.url);
		url.searchParams.delete('naast');
		return url.pathname + url.search;
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	<title>{pageTitle}</title>
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

{#snippet toc()}
	{#if selectedNode}
		{#if selectedNode.collection === 'documents'}
			<DocumentToc selection={selectedNode} />
		{:else if selectedNode.collection === 'judgments'}
			<JudgmentToc selection={selectedNode} />
		{:else}
			<LezenNav selection={selectedNode} onitems={(it) => (navItems = it)} />
		{/if}
	{/if}
{/snippet}

{#snippet panel(network: boolean)}
	{#if selectedNode}
		<div class="panel">
			<Verbonden
				onRetry={() => source.reload()}
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
		shareLabel={shareCopier.label('share', 'Deel')}
		shareAnnouncement={shareCopier.announcement}
		onShareView={handleShareView}
		onGoBack={goBack}
		{readAction}
		onRead={setReading}
	/>

	<div class="explore-content">
		{#if mode === 'index'}
			<IndexView category={indexKind} onResultCountChange={(count) => (reportedCount = count)} />
		{:else if focusMissing && !selectedNode && !netwerkActive}
			<div class="explore-empty">
				<p>{focusError}</p>
				<p>
					Het netwerk bevat een selectie van bronnen. Zie
					<a href="/docs#dekking" class="link">bronnen en dekking</a>.
				</p>
			</div>
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
								aria-pressed={mobilePanel === id}
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
						onNodeDoubleClick={handleNodeReplace}
						onToggleChosen={toggleChosen}
						{netwerkActive}
						onEdgeClick={openEdgeCard}
						onClear={() => (card = null)}
						onGoBack={goBack}
						onGoForward={() => history.forward()}
						onFilter={applyFilter}
						onOpenFilter={() => (filterOpen = true)}
						onDepth={setDepth}
						onToggleHeat={toggleHeat}
						onHeatPeriodChange={setHeatPeriod}
						onToggleMutatie={toggleMutatie}
						onResetGraph={handleResetGraph}
					>
						{#snippet canvasOverlay()}
							<NetwerkPanel
								entries={netwerkActive ? netwerkEntries : []}
								loading={netwerkLoading}
								start={!focus && !netwerkActive}
								onPick={addIdToNetwerk}
								selection={selectedNode && selectedLinkId && !netwerk.ids.includes(selectedLinkId)
									? { label: selectedNode.label }
									: null}
								tussen={netwerk.tussen}
								{joiningCount}
								onToggle={(id) => setNetwerk(withToggled(netwerk, id))}
								onRemove={(id) => setNetwerk(withRemoved(netwerk, id))}
								onAdd={() => selectedNode && addToNetwerk(selectedNode)}
								onTussen={() => setNetwerk({ ...netwerk, tussen: !netwerk.tussen })}
								onClearContext={() => store.clearContext()}
								onClear={() => setNetwerk(EMPTY_NETWERK)}
							/>
						{/snippet}
					</GraphView>
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
					onRetry={() => source.reload()}
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
							aria-pressed={mobilePanel === id}
							onclick={() => (mobilePanel = id as typeof mobilePanel)}>{label}</button
						>
					{/each}
					{#if withNav}
						<button
							type="button"
							class="mobile-tab mobile-tab--toc"
							aria-haspopup="dialog"
							aria-expanded={tocOpen}
							onclick={() => (tocOpen = true)}>Inhoud</button
						>
					{/if}
				</nav>
				{#if withNav}
					<div class="col col--nav toc-column">
						{@render toc()}
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
			{#if withNav && tocOpen}
				<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
				<div
					class="toc-sheet-backdrop"
					onclick={(e) => e.target === e.currentTarget && (tocOpen = false)}
				>
					<div class="toc-sheet" role="dialog" aria-modal="true" aria-label="Inhoud" tabindex="-1">
						<div class="toc-sheet__head">
							<span class="toc-sheet__title">Inhoud</span>
							<button
								type="button"
								class="toc-sheet__close"
								aria-label="Sluiten"
								onclick={() => (tocOpen = false)}>×</button
							>
						</div>
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
						<div class="toc-sheet__body" onclick={onTocBodyClick}>
							{@render toc()}
						</div>
					</div>
				</div>
			{/if}
		{:else if focusError}
			<p class="explore-empty">{focusError}</p>
		{:else if focus}
			<!-- The bron is on its way: said, not left as an empty page. -->
			<p class="explore-empty" role="status">Laden…</p>
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

	/* The network gives way before the text does: the reader keeps 640px, enough for a
	   measure of some 60 characters, and the canvas takes what is left up to its width. */
	.explore-graph--with-reader {
		grid-template-columns:
			max(200px, min(var(--graph-w), calc(100vw - var(--panel-w) - 650px)))
			5px minmax(0, 1fr) 5px var(--panel-w);
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

	/* Reader is the page; nav and panel are its margins — a shade darker, the way a
	   margin note sits apart from the text without a hard rule doing all the work. */
	.col--nav,
	.col--panel {
		background: var(--paper-2);
	}

	.col--panel {
		box-shadow: inset 1px 0 0 var(--rule);
	}

	.col--nav {
		box-shadow: inset -1px 0 0 var(--rule);
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
		font-size: var(--t-body);
		line-height: 1;
		color: var(--ink-3);
		text-decoration: none;
	}

	.reader__close:hover {
		color: var(--ink);
	}

	/* The measure of every reader, set by the column it stands in (ReaderFrame reads
	   it). A toelichting opened under the text inherits the same measure, so opening
	   it moves nothing. Lezen leaves room at the left for the numbers of the leden. */
	.col--reader {
		--reader-max: 700px;
	}
	.col--measure {
		--reader-pad-top: 40px;
		--reader-pad-left: 64px;
		--reader-pad-right: 48px;
		--reader-max: 790px;
	}

	.explore-empty {
		margin: var(--s-6);
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
	}

	/* A hairline until touched, not a constant grey bar: the 5px track is the hit
	   area, drawn as a thin centred line that only widens under the pointer. */
	.resize-handle {
		height: 100%;
		width: 5px;
		cursor: col-resize;
		background: transparent;
		flex-shrink: 0;
		position: relative;
		z-index: 5;
	}

	.resize-handle::before {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		left: 2px;
		width: 1px;
		background: var(--rule);
		transition:
			left var(--dur-1) var(--ease),
			width var(--dur-1) var(--ease),
			background var(--dur-1) var(--ease);
	}

	.resize-handle:hover::before,
	.is-resizing .resize-handle::before {
		left: 1px;
		width: 3px;
		background: var(--rule-strong);
	}

	.mobile-tabs {
		display: none;
	}

	.mobile-tab--toc {
		flex: none;
		margin-left: auto;
		color: var(--ink-2);
	}

	/* The nav column (LezenNav/DocumentToc/JudgmentToc) is a permanent column above
	   1100px; below it, Inhoud opens the same content as a sheet instead — three
	   columns plus a panel do not fit a narrower reader the way two do. */
	.toc-sheet-backdrop {
		display: none;
	}

	@media (max-width: 1100px) {
		.explore-read,
		.explore-read--with-nav {
			grid-template-columns: 1fr;
			grid-template-rows: auto 1fr;
		}
		.explore-read .mobile-tabs {
			display: flex;
			grid-column: 1;
			grid-row: 1;
			border-bottom: 1px solid var(--rule);
			background: var(--paper-2);
		}
		.explore-read .mobile-tab {
			flex: 1;
			font-family: var(--font-sans);
			font-size: var(--t-micro);
			color: var(--ink-3);
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			padding: var(--s-2) var(--s-1) 9px;
			cursor: pointer;
			margin-bottom: -1px;
		}
		.explore-read .mobile-tab.active {
			color: var(--ink);
			border-bottom-color: var(--ink);
			font-weight: 500;
		}
		.explore-read .col {
			grid-row: 2;
			grid-column: 1;
		}
		.explore-read .col--panel {
			border-left: 0;
		}
		.explore-read .toc-column,
		.explore-read .resize-handle,
		.explore-read .mobile-hidden {
			display: none;
		}
		.toc-sheet-backdrop {
			display: flex;
			position: fixed;
			inset: 0;
			z-index: var(--z-modal);
			align-items: flex-end;
			justify-content: center;
			background: rgba(28, 27, 25, 0.32);
		}
		.toc-sheet {
			display: flex;
			flex-direction: column;
			width: 100%;
			max-width: 480px;
			max-height: 75vh;
			background: var(--paper);
			border-radius: var(--r-2) var(--r-2) 0 0;
			box-shadow: var(--shadow-modal);
			overflow: hidden;
		}
		.toc-sheet__head {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 14px 18px;
			border-bottom: 1px solid var(--rule);
			flex-shrink: 0;
		}
		.toc-sheet__title {
			font-family: var(--font-serif);
			font-size: var(--t-body-2);
			font-weight: 500;
			color: var(--ink);
		}
		.toc-sheet__close {
			padding: 0 var(--s-1);
			border: 0;
			background: none;
			font-size: var(--t-h3);
			line-height: 1;
			color: var(--ink-3);
			cursor: pointer;
		}
		.toc-sheet__close:hover {
			color: var(--ink);
		}
		.toc-sheet__body {
			flex: 1;
			min-height: 0;
			overflow-y: auto;
		}
	}

	@media (max-width: 1100px) and (min-width: 769px) {
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
			font-size: var(--t-micro);
			color: var(--ink-3);
			background: none;
			border: 0;
			border-bottom: 2px solid transparent;
			padding: var(--s-2) var(--s-1) 9px;
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

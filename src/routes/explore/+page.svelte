<script lang="ts">
	// The explorer: one bron at a time, in one of three modes. Lezen shows the bron with
	// its verbindingen alongside; Netwerk shows the canvas and, once a bron is selected,
	// the same reader beside it; Bladeren lists bronnen. The URL holds the state
	// (./explore-url.ts names every param).
	//
	// A click on the canvas selects a bron: the reader follows, the canvas stays. A double
	// click replaces the canvas with the bron's own neighbourhood.
	import { onDestroy, onMount, setContext, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import type { Collection } from '$lib/vocabulary';
	import { sprongDoel } from '$lib/stores/sprong';
	import { BESIDE, PHONE, READ_BESIDE } from '$lib/util/breakpoints';
	import { laadWetsnetwerk } from '$lib/components/actueel/wetsnetwerk';
	import { vandaag } from '$lib/text/datum';
	import { meldNetwerk } from '$lib/stores/netwerk-melding';
	import {
		DEFAULT_FILTERS,
		NEIGHBORHOOD_CAP,
		NEIGHBORHOOD_CAP_PHONE,
		type NeighborhoodReach
	} from '$lib/graph/store/types';
	import { lawArticles, lawNav, type LawNavItem } from '$lib/bron/law-articles';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { pageName } from '$lib/bron/tab-title';
	import { titelVan } from '$lib/bron/titels.svelte';
	import { ignore, isAborted, isNotFound, report } from '$lib/api/errors';
	import { reloadForNewVersion } from '$lib/util/reload';
	import { readStored, writeStored } from '$lib/util/storage';
	import PanelBoundary from '$lib/components/ui/PanelBoundary.svelte';
	import LoadState, { failureText } from '$lib/components/ui/LoadState.svelte';
	import { Lazy } from '$lib/util/lazy.svelte';
	import { getNodeCanvas, getNodeHull } from '$lib/api/records';
	import { kopNode } from '$lib/bron/first-node';
	import { bronHref, exploreMode, focusOf, hasReadableFocus, refId, refOf } from '$lib/bron/href';
	import { getDossierKey } from '$lib/api/dossiers';
	import { getMemberVotes } from '$lib/api/members';
	import { createGraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type GraphView from '$lib/components/graph/GraphView.svelte';
	import KindReader from '$lib/components/explore/KindReader.svelte';
	import {
		collectionOfPad,
		documentReader,
		judgmentReader,
		preloadReader
	} from '$lib/components/explore/readers';
	import ReaderFrame from '$lib/components/explore/readers/ReaderFrame.svelte';
	import NietGevonden from '$lib/components/ui/NietGevonden.svelte';
	import { LADEN_TITEL, serverKop, siteTitle } from '$lib/seo/server-head.svelte';
	import { routeKop } from '$lib/seo/routes';
	import { WEERGAVE_KEY, type Weergave } from '$lib/components/explore/weergave';
	import LezenNav from '$lib/components/explore/LezenNav.svelte';
	import DocumentToc from '$lib/components/explore/DocumentToc.svelte';
	import JudgmentToc from '$lib/components/explore/JudgmentToc.svelte';
	import type IndexView from '$lib/components/explore/IndexView.svelte';
	import IndexOverzicht from '$lib/components/explore/index/IndexOverzicht.svelte';
	import Verbonden from '$lib/verbonden/Verbonden.svelte';
	import VerbindingCard from '$lib/verbonden/VerbindingCard.svelte';
	import { filterParams, parseFilter, type VerbondenFilter } from '$lib/verbonden/filter';
	import type { Row } from '$lib/verbonden/rows';
	import { createVerbondenSource, type VerbondenState } from '$lib/verbonden/data-source';
	import { edgeKey } from '$lib/verbonden/edge-meta';
	import {
		edgeLids,
		kaartVanEdge,
		rowOfEdge,
		verbindingOfEdge,
		verbindingOfRow,
		withRow,
		type Verbinding
	} from '$lib/verbonden/verbinding';
	import { allRows, filterGroups, lidCounts, lidTellingenOnder } from '$lib/verbonden/view';
	import { perfStart } from '$lib/dev/perf';
	import type { GraphEdge, GraphNode, DrawClass } from '$lib/graph/types';
	import { containerKindOf, type ContainerKind } from '$lib/graph/container-membership';
	import {
		parseOverlay,
		overlayParam,
		DEFAULT_HEAT_MONTHS,
		type Overlay
	} from '$lib/selection/overlay';
	import { AMENDING_RELATIONS, parseNodeId } from '$lib/vocabulary';
	import { articleOf, kort, lawIdOf } from '$lib/graph/types';
	import { bronNaam } from '$lib/bron/naam';
	import { lookUp } from '$lib/bron/leesbaar';
	import {
		padOfFocus,
		parsePad,
		remember as rememberPad,
		exploreHref,
		exploreUrl
	} from '$lib/bron/address';
	import { instrumentMetaStore, lawName } from '$lib/api/instrument-cache';
	import NetwerkPanel from '$lib/selection/NetwerkPanel.svelte';
	import { focusStap } from '$lib/graph/focus-stap';
	import {
		EXAMPLE_NETWERK,
		netwerkParams,
		parseNetwerk,
		withAdded,
		withRemoved,
		withToggled,
		type Netwerk,
		type NetwerkEntry
	} from '$lib/selection/netwerk';
	import { navigate, patchParams, queryHref, withParams, type ParamPatch } from '$lib/util/address';
	import {
		besideJudgment,
		depthFor as depthOfClass,
		explicitDepth as explicitDepthOf,
		filterQuery,
		indexCategory,
		nameOfPad,
		netwerkQuery as netwerkQueryOf
	} from './explore-url';
	import { PANELS, panelOfKey, verbondenInView, type Panel } from './panels';
	import { citedByName, pathByName } from '$lib/bron/law-name';
	import { followServerMove, isEnactedLawPath } from '$lib/bron/moved-law';
	import { ColumnWidths, type Column } from './column-widths.svelte';
	import { NetwerkComposer } from './netwerk-compose.svelte';
	import { OverlayCounts } from './overlay-counts.svelte';
	import TocSheet from './TocSheet.svelte';
	import ExampleLine from './ExampleLine.svelte';

	// One store for the lifetime of this page, so it survives mode switches.
	const store = createGraphStore();

	let selectedNode = $state<GraphNode | null>(null);
	/**
	 * A focus on its way while another bron is still selected: the reader shows its loading
	 * state instead of the old text until the new bron's head is in (UX 8 Oct: a dossier opened
	 * from search kept the article's text for 8 s).
	 */
	let wachtOp = $state<string | null>(null);
	/** How far the canvas's neighbourhood reached, for the legend's Diepte. */
	let reach = $state<NeighborhoodReach | null>(null);
	store.neighborhood.subscribe((r) => (reach = r));
	store.selection.subscribe((n) => {
		selectedNode = n;
	});

	/** The bronnen on the canvas, for the heat overlay, which counts only those. */
	let canvasIds = $state<string[]>([]);
	store.nodes.subscribe((ns) => {
		canvasIds = ns.map((n) => n.id).filter((id) => !id.startsWith('synth:'));
	});

	let focusError = $state<string | null>(null);
	/** The focus is a bron the dataset does not hold: the page says so instead of an empty canvas. */
	let focusMissing = $state(false);

	// The URL as the Verkenner reads it: a readable address (/uitspraken/ECLI:…) has its
	// focus in the path, and reads as /explore?focus=… (see $lib/bron/address.ts).
	const logisch = $derived(exploreUrl(page.url));
	const params = $derived(logisch.searchParams);

	// ── A readable address the API has to look up ────────────────────────────
	// An article or a Kamerstuk is looked up once; a judgment or a dossier needs no request.
	// What the data lacks is said, not opened as a neighbour (a dossier for its stuk).
	const pad = $derived(parsePad(page.url.pathname));
	let padMissing = $state<string | null>(null);
	/** The address names a bron the data lacks: a 404, as the server gives it. */
	let padOnbekend = $state(false);
	$effect(() => {
		const p = pad;
		padMissing = null;
		padOnbekend = false;
		if (!p || untrack(() => params.get('focus'))) return;
		const ac = new AbortController();
		// Untracked: lookUp reads what is remembered (focusOfPad), and a list that comes in
		// remembers hundreds of addresses; that is no reason to ask again (Sv 143 was asked
		// twice, 10 Oct).
		// A law by its abbreviation (/wetten/wft/artikel/1:1): on to its own address, without
		// asking the data for a law id it has not.
		const byName = citedByName(p)
			? pathByName(p, ac.signal).then(
					(named) => {
						if (named && !ac.signal.aborted)
							location.replace(named + location.search + location.hash);
						return named ? 'elders' : null;
					},
					() => null
				)
			: untrack(() => lookUp(p, ac.signal));
		byName
			.then((found) => {
				if (found || ac.signal.aborted) return;
				// A law of the Staatsblad the BWB now holds: the server sends it on.
				if (followServerMove(page.url.pathname)) return;
				padMissing = `${nameOfPad(p)} staat niet in de gegevens.`;
				padOnbekend = true;
			})
			.catch((e) => {
				if (ac.signal.aborted || isAborted(e)) return;
				report('Verkenner adres', e);
				padMissing = failureText(nameOfPad(p), e);
			});
		return () => ac.abort();
	});

	// A bron opened at /explore?focus=… gets its readable address once it is known, in
	// place: no step in the history. A shared old link opens the same bron.
	$effect(() => {
		const node = selectedNode;
		const f = focus;
		if (!node || !f || mode === 'index' || page.url.pathname !== '/explore') return;
		const given = node.id === f ? (node.raw?.path ?? null) : null;
		const path = padOfFocus(f, given);
		if (!path) return;
		rememberPad(path, f);
		navigate(exploreHref(logisch.searchParams, page.url.hash, given));
	});
	const readableFocus = $derived(hasReadableFocus(params));
	const mode = $derived(exploreMode(params));
	const focus = $derived(params.get('focus') ?? '');
	// A toelichting or a citing judgment opened beside the article: the article stays the
	// selected bron.
	const besideId = $derived(params.get('naast'));
	const beside = $derived(parseNodeId(besideId ?? ''));
	const besideJudgmentNode = $derived(besideJudgment(beside));
	// All verbindingen as a table, in Lezen.
	const tableMode = $derived(params.get('tabel') === '1');
	const explicitDepth = $derived(explicitDepthOf(params));
	// All the focus's direct neighbours (?alles=1, Thijs 10 Oct: "maak het mogelijk om alles te
	// laden, misschien zonder het tweede en derde niveau"): one step, up to ALLES_GRENS.
	const alles = $derived(params.get('alles') === '1');
	// The API's most at one step (2.000 from 0.79.45, #545).
	const ALLES_GRENS = 2000;
	// The per-kind step: all of one kind of the focus's direct neighbours, page by page (500,
	// /api/nodes props=canvas), up to SOORT_GRENS; the Legenda's row says how many came.
	const SOORT_GRENS = 5000;
	let laadtSoort = $state(new Set<string>());
	async function laadSoort(soort: Collection) {
		const target = parseNodeId(reach?.focal ?? '');
		if (!target || laadtSoort.has(soort)) return;
		laadtSoort = new Set([...laadtSoort, soort]);
		try {
			await store.laadSoort(target.collection, target.key, soort, { grens: SOORT_GRENS });
		} catch (e) {
			// The row keeps its count; Alle laden stays.
			report('Verkenner soort', e);
		} finally {
			laadtSoort = new Set([...laadtSoort].filter((c) => c !== soort));
		}
	}
	const depthFor = (drawClass: DrawClass) =>
		depthOfClass(drawClass, { explicit: explicitDepth, all: alles });
	// The bron the canvas is drawn around; a click selects another without moving it.
	let anchorClass = $state<DrawClass>('other');
	const depth = $derived(depthFor(anchorClass));

	// ── The netwerk of chosen bronnen ─────────────────────────────────────────
	// Parsed from its own three params only, so selecting a bron does not compose again.
	const netwerkQuery = $derived(netwerkQueryOf(params));
	const telefoon = typeof window !== 'undefined' && window.matchMedia(PHONE).matches;
	// "Bronnen ertussen" is on by default, on a phone too (Thijs, 9 Oct, from an iPhone): the
	// clusters, the faint bronnen between and the cap of 100 keep it light there.
	// ── The example, where nothing is chosen ─────────────────────────────────
	// The Verkenner without a focus, a netwerk or one remembered opens on the home page's
	// own example (Thijs, 10 Oct: "kies dan het voorbeeld dat van de homepage komt"): the
	// network of the newest passed bill, as laadWetsnetwerk gives it there. Shown, not
	// written: the address stays /explore. A line above says it is an example.
	let voorbeeld = $state<{ query: string; naam: string } | null>(null);
	const zonderKeuze = $derived(!focus && !pad && !netwerkQuery && mode !== 'index');
	$effect(() => {
		if (!zonderKeuze || voorbeeld || readStored(NETWERK_KEY)) return;
		const ac = new AbortController();
		laadWetsnetwerk([], vandaag(), ac.signal)
			.then((schets) => {
				if (!schets || ac.signal.aborted) return;
				const query = new URL(schets.exploreHref, location.origin).searchParams.toString();
				voorbeeld = { query, naam: schets.kandidaat.naam };
			})
			.catch((e) => report('Verkenner voorbeeld', e));
		return () => ac.abort();
	});
	const voorbeeldAan = $derived(zonderKeuze && !!voorbeeld);
	const netwerk = $derived<Netwerk>(
		parseNetwerk(new URLSearchParams(netwerkQuery || (voorbeeldAan ? voorbeeld!.query : '')))
	);
	const netwerkActive = $derived(netwerk.ids.length > 0);

	// ── The bronfilter ───────────────────────────────────────────────────────
	// One filter object, parsed from the URL, for the panel, the margin of the reader,
	// the canvas, the legend and the table. Derived from its own params only (filterQuery):
	// a change elsewhere in the URL (?versies, ?naast) must not hand every consumer a new
	// object and redraw the canvas and the panel.
	const filterKey = $derived(filterQuery(params));
	const filter = $derived<VerbondenFilter>(parseFilter(new URLSearchParams(filterKey)));
	let filterOpen = $state(false);
	const applyFilter = (f: VerbondenFilter) => setUrl(filterParams(f));

	// ── The verbindingen of the selected bron, loaded once ───────────────────
	const source = createVerbondenSource(store);
	let verbonden = $state<VerbondenState>(get(source));
	source.subscribe((s) => (verbonden = s));
	// Verbonden loads when it is in view (verbondenInView).
	$effect(() => {
		const node = mode === 'index' ? null : selectedNode;
		const view = { phone: telefoon, table: tableMode, panel: mobilePanel };
		if (node && !verbondenInView(node.collection, view)) return;
		source.load(node);
	});
	onDestroy(() => source.destroy());
	// A filter on the rows or the table needs every row, not the first few per group.
	$effect(() => {
		const f = filter;
		const opRijen =
			f.lid ||
			f.rechter ||
			f.van ||
			f.tot ||
			f.geldendOp ||
			f.betrouwbaarheid ||
			f.status ||
			f.jaar ||
			f.zoek ||
			// An article's counts per lid under a bronfilter that splits what one of its
			// buckets holds (toelichtingen without wetsvoorstellen) are counted from its rows.
			(f.bronnen &&
				selectedNode?.collection === 'articles' &&
				!(verbonden.lidPerBak && lidTellingenOnder(verbonden.lidPerBak, f.bronnen)));
		// Asked again for each bron Verbonden starts on: a readable address names it later.
		void verbonden.id;
		if (tableMode || opRijen) source.volledig().catch((e) => report('Verbonden volledig', e));
	});

	// The counts in the margin of the reader hold under every filter but the lid, so a
	// lid keeps its count when another lid is chosen.
	// Only Verbonden of this bron counts: a phone may still hold the previous one's.
	const verbondenHier = $derived(
		!!selectedNode && verbonden.id === selectedNode.id && verbonden.groups.length > 0
	);
	// The API's counts per lid (`lid_counts`), under the bronfilter its buckets', as long as
	// no other filter narrows them: the rows of a much cited article are a sample (3:4 Awb on
	// prod: 874 judgments at lid 1, 46 in the first 1,000 passages).
	const apiTellingen = $derived(
		!!selectedNode &&
			verbonden.id === selectedNode.id &&
			!!verbonden.lidPerBak &&
			!filter.rechter &&
			!filter.van &&
			!filter.tot &&
			!filter.geldendOp &&
			!filter.status &&
			!filter.betrouwbaarheid &&
			!filter.jaar
			? lidTellingenOnder(verbonden.lidPerBak, filter.bronnen)
			: null
	);
	// Else counted from the rows, once they are all in or where the API counts no lid.
	const geteld = $derived(
		!apiTellingen && verbondenHier && (!!verbonden.volledig || !verbonden.lidTellingen)
	);
	const lidCountsOfArticle = $derived(
		apiTellingen ??
			(geteld
				? lidCounts(allRows(filterGroups(verbonden.groups, { ...filter, lid: null })))
				: new Map<string, number>())
	);
	const billCount = $derived(
		allRows(verbonden.groups).filter((r) => r.filterGroup === 'wetsvoorstellen').length
	);

	// ── The card Verbinding ──────────────────────────────────────────────────
	let card = $state<{ verbinding: Verbinding; edgeId: string | null; row: Row | null } | null>(
		null
	);
	/** The edge whose card is on its way: a later click or another card wins. */
	let cardAsked: string | null = null;
	$effect(() => {
		void selectedNode?.id;
		card = null;
		cardAsked = null;
	});
	function openRowCard(row: Row) {
		cardAsked = null;
		if (!selectedNode) return;
		const v = verbindingOfRow(row, selectedNode);
		if (v) card = { verbinding: v, edgeId: null, row };
	}
	function openEdgeCard(edge: GraphEdge) {
		const from = store.getNodeById(edge.source);
		const to = store.getNodeById(edge.target);
		if (!from || !to) return;
		// What the row of the selected bron says of this edge, where the panel has it: the card
		// names the lid and the place the row names.
		const row = selectedNode ? rowOfEdge(allRows(verbonden.groups), selectedNode.id, edge) : null;
		if (row && selectedNode) {
			cardAsked = null;
			card = {
				verbinding: withRow(verbindingOfEdge(edge, from, to), row, selectedNode),
				edgeId: edge.id,
				row: null
			};
			return;
		}
		// The passage, which the canvas does not load: the card opens with it, once.
		const asked = (cardAsked = edge.id);
		const node = selectedNode;
		kaartVanEdge(edge, from, to)
			.then((verbinding) => {
				if (cardAsked === asked && selectedNode === node)
					card = { verbinding, edgeId: edge.id, row: null };
			})
			.catch((e) => report('Verbinding', e));
	}
	// The lid each line names, as its row or its card names it: the canvas has the edge's light
	// meta only, which names no lid where the judgment cites several places (UX-toets #49).
	const lineLids = $derived.by(() => {
		const lids = selectedNode
			? edgeLids(allRows(verbonden.groups), selectedNode.id)
			: new Map<string, string>();
		const edge = card?.edgeId ? store.getEdgeById(card.edgeId) : null;
		if (edge && card?.verbinding.lid)
			lids.set(edgeKey(edge.source, edge.target, edge.relation), card.verbinding.lid);
		return lids;
	});
	function showInNetwork(row: Row) {
		if (selectedNode && row.relation && row.direction) {
			if (!store.showRows(selectedNode.id, [row as CanvasRow])) {
				meldNetwerk('Het netwerk laadt nog; niets getekend.', null);
				return;
			}
			const id = refId(row.ref);
			meldNetwerk(`${row.title} getekend in het netwerk.`, () => store.hideRows([id]));
		}
		if (mode !== 'graph') setReading(false);
		mobilePanel = 'graph';
	}
	const besideHrefOf = (row: Row | null) =>
		row && withParams(page.url, { naast: refId(row.ref) }, { hash: row.at ?? '' });

	// What opens beside the article from the card Verbinding: its toelichting, or a judgment
	// that cites it, at the r.o. (as its row in Verbonden opens it).
	const naastHrefOf = (c: { verbinding: Verbinding; row: Row | null }) =>
		c.row &&
		(c.verbinding.relation === 'EXPLAINS' ||
			(c.row.ref.collection === 'judgments' && selectedNode?.collection === 'articles'))
			? besideHrefOf({ ...c.row, at: c.verbinding.at ?? c.row.at })
			: null;

	// A wetsvoorstel row whose proposed text the reader shows beside the current one.
	let proposedRow = $state<Row | null>(null);
	$effect(() => {
		void selectedNode?.id;
		proposedRow = null;
	});

	// Previous and next article, and the place of the article in its law, from the list of
	// the law's articles: in Netwerk as in Tekst, one request per law, shared with the table
	// of contents ($lib/api/law-articles).
	let navItems = $state<LawNavItem[]>([]);
	const navLaw = $derived(
		selectedNode?.collection === 'articles' ? lawIdOf(selectedNode.raw?.props) : null
	);
	$effect(() => {
		const bwb = navLaw;
		if (!bwb) {
			navItems = [];
			return;
		}
		const name = lawName($instrumentMetaStore.get(bwb), bwb);
		let current = true;
		lawArticles(bwb)
			.then((list) => {
				if (current) navItems = lawNav(list, name);
			})
			.catch((e) => {
				report('Verkenner artikelen van de wet', e);
				if (current) navItems = [];
			});
		return () => {
			current = false;
		};
	});
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
	// The most bronnen a neighbourhood brings: fewer on a phone.
	const omgevingGrens = telefoon ? NEIGHBORHOOD_CAP_PHONE : NEIGHBORHOOD_CAP;

	async function expandAround(node: GraphNode, epoch: number) {
		if (node.id.startsWith('synth:')) return;
		await store.expandNeighborhood(node.collection, node.key, {
			depth: depthFor(node.drawClass),
			cap: alles ? ALLES_GRENS : omgevingGrens
		});
		if (epoch !== focusEpoch) return;
		// A dossier's stukken change wetten two steps away (dossier, stuk, wet): the one
		// step of a container leaves those changes out, so they are asked for on their own.
		if (node.collection === 'dossiers') {
			await store.expandNeighborhood(node.collection, node.key, {
				depth: 2,
				cap: omgevingGrens,
				relations: ['PART_OF', ...AMENDING_RELATIONS],
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
	let deepenedAlles = false;
	let replaceNext: string | null = null;
	// A focus loaded without the canvas (reading, or a phone's text tab): its light node only;
	// the full node and its neighbourhood wait until the canvas is shown.
	// State: the light node coming in while the canvas opened (a phone's Netwerk tab on a
	// link to another bron, ?paneel=netwerk) loads the focus again, with its neighbourhood.
	let lichtGeladen = $state<string | null>(null);

	$effect(() => {
		// Read here, not only inside `deepen`: that branch does not run on the first pass,
		// so a change of ?diepte would otherwise not rerun the effect until a reload.
		void explicitDepth;
		void alles;
		const withNetwerk = netwerkActive;
		if (!focus) {
			focusError = null;
			// The selection goes, so the focus does too: Back to it loads it again (#135).
			loadedFocus = '';
			if (selectedNode) store.setSelection(null);
			return;
		}
		if (mode === 'index') return;
		const verdiept = deepenedId ? store.getNodeById(deepenedId) : undefined;
		const stap = focusStap({
			focus,
			loadedFocus,
			replaceNext,
			zichtbaar: canvasZichtbaar,
			lichtGeladen,
			withNetwerk,
			verdiept: verdiept?.id ?? null,
			geselecteerd: () =>
				selectedNode ? { id: selectedNode.id, linkId: linkIdOf(selectedNode) } : null
		});
		if (stap?.soort === 'laden') {
			loadedFocus = focus;
			loadFocus(focus).catch((e) => showFocusError(e, focus));
		} else if (stap?.soort === 'verdiepen') {
			const anchor = verdiept ?? selectedNode;
			if (anchor) deepen(anchor).catch((e) => showFocusError(e, anchor.key));
		}
	});

	/** The message for a bron the dataset does not hold. */
	function missing(key: string) {
		if (followServerMove(page.url.pathname)) return;
		wachtOp = null;
		focusMissing = true;
		// A law of the Staatsblad the server served itself is not in the data: by its publication.
		const name = pad && isEnactedLawPath(page.url.pathname) ? nameOfPad(pad) : `'${key}'`;
		focusError = `${name} staat niet in de gegevens.`;
	}

	async function loadFocus(id: string) {
		focusError = null;
		focusMissing = false;
		const replace = replaceNext === id;
		replaceNext = null;
		// A light node is in the store but was never drawn: it is not on the canvas.
		const licht = untrack(() => lichtGeladen) === id;
		lichtGeladen = null;
		const target = parseNodeId(id);
		if (!target) {
			focusError = `Bron '${id}' niet gevonden.`;
			return;
		}
		// A bron already on the canvas (a click on it) needs no wait: it is there.
		const huidig = untrack(() => selectedNode);
		wachtOp =
			huidig && huidig.id !== id && linkIdOf(huidig) !== id && !store.getNodeById(id) ? id : null;
		try {
			// The reader stands on the bron's head ($lib/bron/first-node): a person's record, a judgment's
			// text, a law's or a dossier's detail; the node, once in, takes its place.
			kopNode(target.collection, target.key)
				?.then((node) => {
					if (id === loadedFocus && (!selectedNode || wachtOp === id)) {
						selectedNode = node;
						wachtOp = null;
					}
				})
				// The node takes the head's place when it comes.
				.catch((e) => report('Verkenner kop', e));
			if (target.collection === 'members')
				getMemberVotes(target.key).catch(ignore('Verkenner stemmen'));
			// A link names a dossier by its number (`37020-XV`); the API gives its node key.
			if (target.collection === 'dossiers') target.key = await getDossierKey(target.key);
			if (id !== loadedFocus) return;
			const onCanvas = licht
				? undefined
				: (store.getNodeById(`${target.collection}/${target.key}`) ??
					store.getNodeById(`${target.collection}/${target.key.toLowerCase()}`));
			const inGraph = untrack(() => canvasZichtbaar);
			const withNetwerk = untrack(() => netwerkActive);
			// Without the canvas, the light node is all the reader and the page need.
			if (!inGraph && !onCanvas && !withNetwerk) {
				const first = await store.peekNode(target.collection, target.key);
				if (id !== loadedFocus) return;
				if (!first) {
					missing(target.key);
					return;
				}
				store.focusNode(first.id);
				lichtGeladen = id;
				return;
			}
			if (!replace && onCanvas && (withNetwerk || deepenedId)) {
				store.focusNode(onCanvas.id);
				if (withNetwerk) graphView?.inBeeld();
				return;
			}
			if (!replace && withNetwerk && inGraph) {
				const node = await store.expandNode(target.collection, target.key, { neighborLimit: 0 });
				if (id !== loadedFocus) return;
				if (node) {
					store.focusNode(node.id);
					graphView?.inBeeld();
				} else missing(target.key);
				return;
			}
			// A wet, fractie, commissie or dossier is a hull, not a scattered handful of
			// dots: its own children are its point, so they are not capped like an
			// ordinary bron's neighbours are.
			const neighborLimit = containerKindOf(target.collection)
				? Number.POSITIVE_INFINITY
				: DEFAULT_FILTERS.neighborLimit;
			// The bron itself first, from its light node: the reader and the panels start while
			// the node the canvas draws is on its way, asked at the same time: a container's
			// hull (`getNodeHull`: a wet's articles, a dossier's whole node), an ordinary bron's
			// first per bucket (`getNodeCanvas`, CANVAS_BUCKET).
			const canvasNode = Number.isFinite(neighborLimit)
				? getNodeCanvas(target.collection, target.key)
				: getNodeHull(target.collection, target.key);
			canvasNode.catch(ignore('Verkenner canvas'));
			// The light node only makes the start quicker: expandNode asks the whole one.
			const first = await store
				.peekNode(target.collection, target.key)
				.catch(ignore('Verkenner licht'));
			if (id !== loadedFocus) return;
			if (first) store.focusNode(first.id);
			const node = await store.expandNode(target.collection, target.key, {
				neighborLimit,
				hull: !Number.isFinite(neighborLimit)
			});
			if (id !== loadedFocus) return;
			if (!node) {
				missing(target.key);
				return;
			}
			store.focusNode(node.id);
			if (inGraph) await deepen(node, replace);
		} catch (err) {
			if (isNotFound(err)) missing(target.key);
			else showFocusError(err, target.key);
		}
	}

	/**
	 * A focus or its neighbourhood that did not come: a newer focus (an abort) says nothing.
	 * Over a bron already shown the canvas and the reader stay, and the network says it.
	 */
	function showFocusError(err: unknown, key: string) {
		if (isAborted(err)) return;
		wachtOp = null;
		report('Verkenner focus', err);
		focusError = failureText(`'${key}'`, err);
		if (untrack(() => selectedNode)) meldNetwerk(focusError, null);
	}

	// Expand around `node` once per depth, or again when `force`d.
	async function deepen(node: GraphNode, force = false) {
		const d = depthFor(node.drawClass);
		if (!force && deepenedId === node.id && deepenedDepth === d && deepenedAlles === alles) return;
		deepenedId = node.id;
		deepenedDepth = d;
		deepenedAlles = alles;
		anchorClass = node.drawClass;
		graphView?.suppressFit();
		// The focus it was asked for: a link followed while the neighbourhood comes in moves
		// the focus on, and the reader stays on the new bron (#48).
		const voor = loadedFocus;
		const epoch = ++focusEpoch;
		await expandAround(node, epoch);
		if (epoch !== focusEpoch) return;
		if (loadedFocus === voor) store.focusNode(node.id);
		graphView?.reseatAround(node.id);
		graphView?.fitWhenSettled();
	}

	function handleNodeClick(node: GraphNode) {
		const end = perfStart(`click ${node.id}`);
		if (!node.id.startsWith('synth:')) {
			// A bron chosen in the example: the example's network comes along into the address,
			// the canvas stays as it is.
			const exampleParams = voorbeeldAan
				? Object.fromEntries(new URLSearchParams(voorbeeld!.query))
				: undefined;
			const href = bronHref(refOf(node.collection, node.key, node.raw?.props), {
				params: exampleParams
			});
			navigate(href, { step: true });
		}
		end();
	}

	// A double click leaves the netwerk and draws the bron's own neighbourhood.
	function handleNodeReplace(node: GraphNode) {
		if (node.id.startsWith('synth:')) return;
		const ref = refOf(node.collection, node.key, node.raw?.props);
		const id = focusOf(ref);
		if (!id) return;
		if (netwerkActive) composer.release();
		replaceNext = id;
		if (id === focus && !netwerkActive) {
			replaceNext = null;
			deepen(node, true).catch((e) => showFocusError(e, node.key));
			return;
		}
		navigate(bronHref(ref, { keepNetwerk: false }), { step: true });
	}

	// ── Composing the netwerk ─────────────────────────────────────────────────
	const composer = new NetwerkComposer(store, () => graphView);
	/** The bronnen a grouping switched off hides, by canvas id: their chips grey. */
	let metGroep = $state<ReadonlyMap<string, ContainerKind>>(new Map());

	$effect(() => {
		const n = netwerk;
		if (mode !== 'graph') return;
		untrack(() => {
			if (n.ids.length > 0) composer.compose(n);
			else if (composer.composed) composer.release();
		});
	});

	/**
	 * A chip's name: a fractie by its abbreviation (VVD), its full name in the title, so a
	 * suffix ("via 200 van 846 leden") fits on a phone (Thijs, 9 Oct); the rest by bronNaam.
	 */
	function chipNaam(e: NetwerkEntry, node: GraphNode): NetwerkEntry {
		const naam = bronNaam(node, $instrumentMetaStore);
		const afkorting = node.raw?.props?.abbreviation;
		return node.collection === 'factions' && typeof afkorting === 'string' && afkorting
			? { ...e, label: afkorting, titel: naam }
			: { ...e, label: naam };
	}

	function setNetwerk(n: Netwerk) {
		if (n.ids.length === 0) writeStored(NETWERK_KEY, null);
		// Clearing the netwerk or removing a bron is undone with Back.
		const shrinks = n.ids.length < netwerk.ids.length;
		setUrl(netwerkParams(n), { push: shrinks });
	}

	// The Verkenner opens on the last netwerk until it is cleared: a double click that
	// leaves it, or a bron opened elsewhere, does not forget it.
	const NETWERK_KEY = 'concordans:netwerk';
	$effect(() => {
		if (netwerkQuery && netwerk.ids.length > 0) writeStored(NETWERK_KEY, netwerkQuery);
	});
	$effect(() => {
		// A readable address names its bron, also while it is looked up (a Kamerstuk, an
		// article): the remembered netwerk does not take its place.
		if (focus || pad || netwerkQuery || mode === 'index') return;
		const saved = readStored(NETWERK_KEY);
		if (!saved) return;
		// The bronnen between start shown, whatever the last netwerk had (Thijs, 9 Oct:
		// "standaard aan"); only a link that says ?tussen=0 keeps them off.
		untrack(() => setUrl({ ...Object.fromEntries(new URLSearchParams(saved)), tussen: null }));
	});
	const linkIdOf = (node: GraphNode) =>
		node.id.startsWith('synth:')
			? null
			: focusOf(refOf(node.collection, node.key, node.raw?.props));
	const selectedLinkId = $derived(selectedNode ? linkIdOf(selectedNode) : null);
	// The new bron has reached the reader (its light node or its node): the wait is over.
	$effect(() => {
		if (wachtOp && selectedNode && (selectedNode.id === wachtOp || selectedLinkId === wachtOp))
			wachtOp = null;
	});

	function addToNetwerk(node: GraphNode) {
		const id = linkIdOf(node);
		if (id) addIdToNetwerk(id, kort(bronNaam(node, $instrumentMetaStore)));
	}

	function addIdToNetwerk(id: string, naam?: string) {
		// The first bron chosen grows out of the canvas as it is: what is there stays, as context.
		if (!netwerkActive) composer.keepCanvas();
		setNetwerk(withAdded(netwerk, id));
		// On a phone the Netwerk tab shows it was added, with the way back (Thijs, 9 Oct).
		mobilePanel = 'graph';
		meldNetwerk(`${naam ?? 'De bron'} toegevoegd aan het netwerk.`, () =>
			setNetwerk(withRemoved(netwerk, id))
		);
	}

	function toggleChosen(node: GraphNode) {
		const id = linkIdOf(node);
		if (!id) return;
		if (netwerk.ids.includes(id)) setNetwerk(withRemoved(netwerk, id));
		else addToNetwerk(node);
	}

	function showExample() {
		composer.keepCanvas();
		setNetwerk(withAdded(netwerk, ...EXAMPLE_NETWERK));
	}

	// Wissen leaves nothing: no chosen bronnen, no focus, no canvas, nothing remembered for
	// the next visit. One step, so Back brings it all back.
	function wisAlles() {
		store.reset();
		composer.forget();
		loadedFocus = '';
		deepenedId = '';
		writeStored(NETWERK_KEY, null);
		setUrl(
			{ netwerk: null, uit: null, tussen: null, focus: null, lezen: null, open: null, mode: null },
			{ push: true }
		);
	}

	// The tab names what is open, so that tabs, bookmarks and history tell bronnen apart.
	/** A bron the data lacks, and nothing else to show: the 404 page. */
	const nietGevonden = $derived(
		mode !== 'index' && (focusMissing || padOnbekend) && !selectedNode && !netwerkActive
	);

	const pageTitle = $derived.by(() => {
		if (mode === 'index') return siteTitle('Bronnen');
		if (nietGevonden) return siteTitle('Niet gevonden');
		// While the next bron is on its way the reader still holds the previous one: its name
		// would be the new page's (a screen reader announces the title after each step).
		if (wachtOp || (pad && !focus && !padMissing)) return LADEN_TITEL;
		const name = selectedNode ? pageName(selectedNode, titelVan(selectedNode.id)) : null;
		if (name) return siteTitle(name);
		if (netwerkActive) return siteTitle('Netwerk');
		return routeKop('/explore').title;
	});

	// The ← of the network goes back inside Concordans; a bron opened from a link
	// elsewhere (a new tab, a shared link) has no step to go back to, so it goes home.
	let steppedIn = $state(false);
	// A replaced entry (a filter) is no step; a link, Back itself, or a change of bron or
	// of reading mode is.
	// On the first page `from` can be there without a url: reading it threw, the first
	// navigation never ended and SvelteKit never took over the links (every click a full
	// load, 10 Oct 2026).
	afterNavigate((nav) => {
		const van = nav.from?.url;
		const naar = nav.to?.url;
		const from = van ? exploreUrl(van).searchParams : null;
		const to = naar ? exploreUrl(naar).searchParams : null;
		const changed = (name: string) => (from?.get(name) ?? null) !== (to?.get(name) ?? null);
		if (nav.type === 'link' || nav.type === 'popstate' || changed('focus') || changed('lezen'))
			steppedIn = true;
	});
	const goBack = () => (steppedIn ? history.back() : goto('/'));

	/**
	 * A change of view that Back should undo (reading at full width, clearing the netwerk)
	 * takes a history entry; a filter or a toggle replaces the current one.
	 */
	function setUrl(patch: ParamPatch, { push = false } = {}) {
		const next = patchParams(logisch.searchParams, patch);
		// The readable address of the focus where it has one: /dossiers/36799?lezen=1. An
		// address still looked up has no focus yet: it keeps its path, or a step (?paneel
		// dropped) would land on the empty /explore or the remembered netwerk.
		const f = next.get('focus');
		const given = selectedNode && selectedNode.id === f ? selectedNode.raw?.path : null;
		const href =
			!f && pad
				? queryHref(page.url.pathname, next) + page.url.hash
				: exploreHref(next, page.url.hash, given);
		navigate(href, { step: push });
	}

	// Reading at full width, or the network with the text beside it.
	const setReading = (on: boolean) =>
		setUrl({ lezen: on ? '1' : null, mode: null, naast: null, tabel: null }, { push: true });
	// Always explicit: an unset diepte means 1 for a container and 2 for every other bron,
	// so a plain "2" click does not remove the param.
	// With a netwerk a depth adds context around the selection; the netwerk stays.
	function setDepth(d: number) {
		if (!netwerkActive) {
			setUrl({ diepte: String(d) });
			return;
		}
		const node = selectedNode;
		if (!node || node.id.startsWith('synth:')) return;
		graphView?.suppressFit();
		store
			.expandNeighborhood(node.collection, node.key, {
				depth: d,
				cap: omgevingGrens,
				additive: true
			})
			.then(() => graphView?.fitWhenSettled())
			.catch((e) => showFocusError(e, node.key));
	}

	const tableHref = $derived(withParams(page.url, { tabel: '1', mode: null, naast: null }));
	const readHref = $derived(withParams(page.url, { tabel: null }));

	// ── Overlay (open dossiers or citations per month, never both) ────────────
	const overlay = $derived<Overlay>(parseOverlay(params.get('overlay')));
	const overlayCounts = new OverlayCounts(
		() => overlay,
		() => canvasIds
	);

	let graphView = $state<GraphView | null>(null);
	// The canvas and the lists of Bronnen are chunks of their own, asked at once beside the
	// bron's first requests: the Verkenner's own chunk was 213 kB gz with them, and every
	// request waited for it (first visit after a deploy, 10 Oct: the first request at 2.6 s).
	let GraphViewC = $state<typeof GraphView | null>(null);
	let IndexViewC = $state<typeof IndexView | null>(null);
	/** A chunk that did not come (a deploy removed it): said in its place, the page loaded
	 *  again once from the new release ($lib/util/reload.ts). */
	let chunkError = $state<unknown>(null);
	function chunkFailed(e: unknown) {
		report('Verkenner onderdeel', e);
		chunkError = e;
		reloadForNewVersion();
	}
	$effect(() => {
		import('$lib/components/graph/GraphView.svelte')
			.then((m) => (GraphViewC = m.default))
			.catch(chunkFailed);
	});
	$effect(() => {
		if (mode === 'index' && !IndexViewC)
			import('$lib/components/explore/IndexView.svelte')
				.then((m) => (IndexViewC = m.default))
				.catch(chunkFailed);
	});

	// The table of all verbindingen, the filter sheet and a reader beside the article come
	// when first asked for; the reader of the focus as soon as its collection is known, beside
	// the bron's first request (lezers in chunks of their own, $lib/components/explore/readers).
	const connectionsTable = new Lazy(
		() => import('$lib/verbonden/VerbondenTabel.svelte'),
		'Verkenner onderdeel'
	);
	const filterSheet = new Lazy(
		() => import('$lib/verbonden/FilterSheet.svelte'),
		'Verkenner onderdeel'
	);
	$effect(() => {
		if (tableMode) connectionsTable.load();
	});
	$effect(() => {
		if (filterOpen) filterSheet.load();
	});
	$effect(() => {
		if (besideJudgmentNode) judgmentReader.load();
		else if (beside) documentReader.load();
	});
	$effect(() => {
		const target = parseNodeId(focus);
		const collection = target?.collection ?? (pad ? collectionOfPad(pad) : null);
		if (collection && mode !== 'index') preloadReader(collection);
	});

	const setOverlay = (o: Overlay) => setUrl({ overlay: overlayParam(o) });
	const toggleHeat = () =>
		setOverlay(
			overlay.kind === 'heat' ? { kind: 'none' } : { kind: 'heat', months: DEFAULT_HEAT_MONTHS }
		);
	const setHeatPeriod = (months: number) => setOverlay({ kind: 'heat', months });
	const toggleMutatie = () =>
		setOverlay(overlay.kind === 'open' ? { kind: 'none' } : { kind: 'open' });

	// ── Share ────────────────────────────────────────────────────────────────
	const shareCopier = createCopier();
	const handleShareView = () => shareCopier.copy(page.url.toString(), 'share');

	// Narrow viewports show one column at a time.
	// Arriving with a netwerk (a link from the start page), the network is what was asked for.
	let mobilePanel = $state<Panel>(untrack(() => netwerkActive) ? 'graph' : 'reader');
	// A link to the network (In het netwerk from Actueel, a network link in Bladeren) opens
	// the Netwerk tab on a phone, a link that opens a text (a Kamerstuk, openHref) the Tekst
	// tab, also from Verbonden; the hint is read once and dropped from the address.
	$effect(() => {
		const paneel = page.url.searchParams.get('paneel');
		if (paneel !== 'netwerk' && paneel !== 'tekst') return;
		untrack(() => {
			mobilePanel = paneel === 'netwerk' ? 'graph' : 'reader';
			setUrl({ paneel: null });
		});
	});
	// What opens beside the article (a toelichting, a citing judgment) is read in the Tekst
	// tab on a phone: a row of Verbonden that opens it brings that tab forward.
	$effect(() => {
		if (!besideId) return;
		untrack(() => (mobilePanel = 'reader'));
	});
	/** The canvas is on the screen: the network, and on a phone its tab. */
	const canvasZichtbaar = $derived(mode === 'graph' && !(telefoon && mobilePanel !== 'graph'));
	// Below --nav-w's own breakpoint, Lezen's table of contents opens as a sheet
	// instead of taking a permanent column.
	let tocOpen = $state(false);
	$effect(() => {
		void selectedNode?.id;
		tocOpen = false;
	});
	/** The bronnen with contents beside their text: a column, or the sheet Inhoud (toc). */
	const WITH_CONTENTS: ReadonlySet<Collection> = new Set([
		'articles',
		'instruments',
		'documents',
		'judgments'
	]);

	// ── Resizable columns ────────────────────────────────────────────────────
	const widths = new ColumnWidths();
	onMount(() => widths.load());

	// ── Keys ─────────────────────────────────────────────────────────────────
	// L reads the selected bron at full width, or goes back to the network; ignored
	// while typing or with a modifier.
	function handleKeydown(e: KeyboardEvent) {
		if (tocOpen && e.key === 'Escape') {
			tocOpen = false;
			return;
		}
		if (e.metaKey || e.ctrlKey || e.altKey) return;
		const el = document.activeElement as HTMLElement | null;
		if (el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA' || el?.isContentEditable) return;
		// 1, 2 and 3: the layers of a bron, Tekst, Netwerk and Verbonden (Thijs, 10 Oct), as the
		// tabs on a phone; 3 puts the focus on Verbonden's first row, for J and K.
		const panel = panelOfKey(e.key);
		if (panel && selectedNode && mode !== 'index') {
			e.preventDefault();
			kiesPaneel(panel);
			if (panel === 'verbonden')
				requestAnimationFrame(() =>
					document.querySelector<HTMLElement>('.verbonden a.row__title')?.focus()
				);
			return;
		}
		// O: only the surroundings of the selected bron, in place of the network, as a double
		// click on it does (Thijs, 10 Oct: the row's Alleen de omgeving moved here).
		if (e.key.toLowerCase() === 'o' && selectedNode && mode !== 'index') {
			e.preventDefault();
			kiesPaneel('graph');
			handleNodeReplace(selectedNode);
			return;
		}
		if (e.key.toLowerCase() !== 'l' || !readAction) return;
		e.preventDefault();
		setReading(readAction === 'read');
	}

	/**
	 * A tab on a phone, where the tabs are the one control: Tekst reads the bron, as the
	 * switch Netwerk / Tekst does on a wide screen, and Netwerk goes back to the network.
	 */
	function kiesPaneel(id: Panel) {
		if (id === 'reader' && readAction === 'read') setReading(true);
		else if (id === 'graph' && readAction === 'network') setReading(false);
		mobilePanel = id;
	}

	/** What the switch Netwerk / Tekst does: read the bron, or go back to the network. */
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

	// The switch stands in the reader's frame, beside the band (ReaderFrame). A bron without
	// a text of its own shows it with Tekst out of reach.
	const weergave = $derived<Weergave | null>(
		readAction
			? {
					stand: readAction === 'read' ? 'netwerk' : 'tekst',
					onKies: (k) => setReading(k === 'tekst'),
					tekstMogelijk: true
				}
			: mode === 'graph' && selectedNode && !tableMode
				? { stand: 'netwerk', onKies: () => {}, tekstMogelijk: false }
				: null
	);
	setContext(WEERGAVE_KEY, () => weergave);

	// ── Bladeren ─────────────────────────────────────────────────────────────
	const indexKind = $derived(indexCategory(params));

	const besideArticle = $derived(
		selectedNode?.collection === 'articles' ? articleOf(selectedNode.raw?.props) : null
	);
	const closeBesideHref = $derived(withParams(page.url, { naast: null }));
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	{#if !serverKop.actief}<title>{pageTitle}</title>{/if}
	{#if nietGevonden}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<!-- A part whose chunk did not come (a deploy removed it): said in its place. -->
{#snippet chunkMissing(error: unknown)}
	<LoadState state={{ status: 'error', error }} what="Dit onderdeel" form="block" />
{/snippet}

{#snippet reader()}
	{#if wachtOp}
		<ReaderFrame state={{ status: 'loading' }} />
	{:else if selectedNode}
		<PanelBoundary what="De tekst" resetOn={selectedNode.id}>
			<div class="reader" class:reader--pair={!!beside}>
				<div class="reader__main">
					<KindReader
						selection={selectedNode}
						prevHref={articleHref(articleIndex - 1)}
						nextHref={articleIndex >= 0 ? articleHref(articleIndex + 1) : undefined}
						{place}
						lidCounts={lidCountsOfArticle}
						lidTellend={!geteld && !apiTellingen}
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
						{#if besideJudgmentNode}
							{#if judgmentReader.component}
								{@const JudgmentReader = judgmentReader.component}
								<JudgmentReader node={besideJudgmentNode} />
							{:else if judgmentReader.error}{@render chunkMissing(judgmentReader.error)}{/if}
						{:else if documentReader.component}
							{@const DocumentReader = documentReader.component}
							<DocumentReader node={beside} article={besideArticle} />
						{:else if documentReader.error}{@render chunkMissing(documentReader.error)}{/if}
					</div>
				{/if}
			</div>
		</PanelBoundary>
	{/if}
{/snippet}

{#snippet toc()}
	{#if selectedNode?.collection === 'documents'}
		<DocumentToc selection={selectedNode} />
	{:else if selectedNode?.collection === 'judgments'}
		<JudgmentToc selection={selectedNode} />
	{:else if selectedNode}
		<LezenNav selection={selectedNode} />
	{/if}
{/snippet}

{#snippet panel(network: boolean)}
	{#if selectedNode}
		<div class="panel">
			<PanelBoundary what="Verbonden" resetOn={selectedNode.id}>
				<Verbonden
					onRetry={() => source.reload()}
					onReloadGroup={(id, options) => source.reloadGroup(id, options)}
					onMeer={(id) => source.groep(id)}
					onAlles={() => source.volledig()}
					{verbonden}
					selection={selectedNode}
					{filter}
					{store}
					{network}
					onFilter={applyFilter}
					onOpenFilter={() => (filterOpen = true)}
					onNaarNetwerk={() => (mobilePanel = 'graph')}
					onAddToNetwerk={(row) => {
						const id = focusOf(row.ref);
						if (id) addIdToNetwerk(id, row.title);
					}}
					inNetwerk={(row) => netwerk.ids.includes(focusOf(row.ref) ?? '')}
					onProposedText={(row) => (proposedRow = row)}
					{tableHref}
				/>
			</PanelBoundary>
			{#if card && !network}
				<div class="panel__card">
					<VerbindingCard
						verbinding={card.verbinding}
						besideHref={naastHrefOf(card)}
						onClose={() => (card = null)}
						onShowInNetwork={card.row ? () => showInNetwork(card!.row!) : undefined}
					/>
				</div>
			{/if}
		</div>
	{/if}
{/snippet}

{#snippet handle(which: Column)}
	<div
		class="resize-handle resize-handle--{which}"
		onpointerdown={(e) => widths.start(e, which)}
		onpointermove={widths.move}
		onpointerup={widths.end}
		aria-hidden="true"
	></div>
{/snippet}

{#snippet tabs(read: boolean)}
	{#each PANELS as { id, label } (id)}
		<button
			type="button"
			class="mobile-tab"
			class:mobile-tab--phone={read && id === 'graph'}
			class:is-active={mobilePanel === id}
			aria-pressed={mobilePanel === id}
			onclick={() => kiesPaneel(id)}>{label}</button
		>
	{/each}
{/snippet}

<div class="explore-shell">
	<div class="explore-content">
		{#if mode === 'index'}
			{#if params.get('kind') === null}
				<!-- The overview scrolls in its own field: the shell does not scroll. -->
				<div class="index-rol"><IndexOverzicht /></div>
			{:else if IndexViewC}<IndexViewC category={indexKind} />{:else if chunkError}<LoadState
					state={{ status: 'error', error: chunkError }}
					what="De lijst"
					form="block"
				/>{:else}<p class="explore-empty stil" role="status">Laden…</p>{/if}
		{:else if nietGevonden}
			<NietGevonden title="Bron niet gevonden" kop={false}>
				<p>{padMissing ?? focusError}</p>
				<p><a href="/bronnen#dekking">Bronnen en dekking</a></p>
			</NietGevonden>
		{:else if padMissing && !selectedNode && !netwerkActive}
			<p class="explore-empty stil">{padMissing}</p>
		{:else if mode === 'graph' && (focus || pad) && !selectedNode && !netwerkActive && !focusError}
			<!-- A bron on its way: its place, not the empty network with its start card (UX test
			     10 Oct, #24). -->
			<p class="explore-empty stil">Laden…</p>
		{:else if mode === 'graph'}
			{#if voorbeeldAan}<ExampleLine name={voorbeeld!.naam} />{/if}
			<div
				class="explore-graph"
				class:explore-graph--with-reader={!!selectedNode}
				class:is-resizing={!!widths.drag}
				style:--graph-w={widths.css('graph')}
				style:--panel-w={widths.css('panel')}
			>
				{#if selectedNode}
					<nav class="mobile-tabs" aria-label="Panelen">{@render tabs(false)}</nav>
				{/if}
				<!-- The text and Verbonden come before the network in the page, so a screen reader
				     reads the bron before the list of the network; the grid places them. -->
				{#if selectedNode}
					<div class="col col--reader" class:mobile-hidden={mobilePanel !== 'reader'}>
						{@render reader()}
					</div>
					{@render handle('panel')}
					<div
						class="col col--panel"
						class:mobile-hidden={mobilePanel !== 'verbonden'}
						use:sprongDoel={{
							id: 'verbonden',
							label: 'Naar Verbonden',
							naast: BESIDE
						}}
					>
						{@render panel(true)}
					</div>
					{@render handle('graph')}
				{/if}
				<div
					class="col col--graph"
					class:mobile-hidden={selectedNode && mobilePanel !== 'graph'}
					use:sprongDoel={{
						id: 'netwerk',
						label: 'Naar het netwerk',
						aan: !!selectedNode,
						naast: BESIDE
					}}
				>
					{#if GraphViewC}
						<PanelBoundary what="Het netwerk" resetOn={focus}>
							<GraphViewC
								bind:this={graphView}
								{store}
								compact={!!selectedNode}
								{filter}
								{verbonden}
								{depth}
								{reach}
								selectedEdgeId={card?.edgeId ?? null}
								{lineLids}
								inFluxMap={overlayCounts.inFlux}
								heatMap={overlayCounts.heat}
								{overlay}
								onNodeClick={(n) => {
									handleNodeClick(n);
									mobilePanel = 'reader';
								}}
								onNodeDoubleClick={handleNodeReplace}
								onMetGroep={(m) => (metGroep = m)}
								onToggleChosen={toggleChosen}
								{netwerkActive}
								onEdgeClick={openEdgeCard}
								onClear={() => (card = null)}
								onBack={goBack}
								onGoForward={() => history.forward()}
								onFilter={applyFilter}
								onOpenFilter={() => (filterOpen = true)}
								onDepth={setDepth}
								onLaadSoort={netwerkActive ? undefined : laadSoort}
								{laadtSoort}
								allesGrens={{ grens: ALLES_GRENS, geladen: alles }}
								onAllesLaden={alles
									? undefined
									: () => setUrl({ alles: '1', diepte: null }, { push: true })}
								onToggleHeat={toggleHeat}
								onHeatPeriodChange={setHeatPeriod}
								onToggleMutatie={toggleMutatie}
							>
								{#snippet canvasOverlay()}
									<NetwerkPanel
										entries={netwerkActive
											? composer.entries.map((e) =>
													e.node
														? { ...chipNaam(e, e.node), verborgenMet: metGroep.get(e.node.id) }
														: e
												)
											: []}
										loading={composer.loading}
										start={!focus && !netwerkActive}
										{telefoon}
										onSelect={addIdToNetwerk}
										omgeving={selectedNode && !selectedNode.stub
											? bronNaam(selectedNode, $instrumentMetaStore)
											: null}
										onOmgeving={() => selectedNode && handleNodeReplace(selectedNode)}
										onVoorbeeld={showExample}
										selection={selectedNode &&
										selectedLinkId &&
										!netwerk.ids.includes(selectedLinkId)
											? { label: bronNaam(selectedNode, $instrumentMetaStore) }
											: null}
										tussen={netwerk.tussen}
										onGroepAan={(kind) => {
											const uit = new Set(get(store.filters).hiddenGroups);
											uit.delete(kind);
											store.setFilters({ hiddenGroups: uit });
										}}
										joiningCount={composer.joiningCount}
										deels={composer.partial}
										onToggle={(id) => setNetwerk(withToggled(netwerk, id))}
										onRemove={(id) => setNetwerk(withRemoved(netwerk, id))}
										onAdd={() => selectedNode && addToNetwerk(selectedNode)}
										onTussen={() => setNetwerk({ ...netwerk, tussen: !netwerk.tussen })}
										onClearContext={() => store.clearContext()}
										onClear={wisAlles}
										deelLabel={shareCopier.label('share', 'Deel')}
										deelMelding={shareCopier.announcement}
										onDeel={handleShareView}
									/>
								{/snippet}
							</GraphViewC>
						</PanelBoundary>
					{:else if chunkError}
						<LoadState
							state={{ status: 'error', error: chunkError }}
							what="Het netwerk"
							form="block"
						/>
					{/if}
					{#if card}
						<VerbindingCard
							verbinding={card.verbinding}
							docked
							besideHref={naastHrefOf(card)}
							onClose={() => (card = null)}
						/>
					{/if}
				</div>
			</div>
		{:else if selectedNode && tableMode}
			<div class="explore-table">
				{#if connectionsTable.component}
					{@const VerbondenTabel = connectionsTable.component}
					<VerbondenTabel
						onRetry={() => source.reload()}
						{verbonden}
						selection={selectedNode}
						{filter}
						onOpenFilter={() => (filterOpen = true)}
						onRow={openRowCard}
						backHref={readHref}
					/>
				{:else if connectionsTable.error}{@render chunkMissing(connectionsTable.error)}{:else}<p
						class="explore-empty stil"
						role="status"
					>
						Laden…
					</p>{/if}
				{#if card}
					<div class="explore-table__card">
						<VerbindingCard
							verbinding={card.verbinding}
							besideHref={naastHrefOf(card)}
							onClose={() => (card = null)}
							onShowInNetwork={card.row ? () => showInNetwork(card!.row!) : undefined}
						/>
					</div>
				{/if}
			</div>
		{:else if selectedNode}
			{@const withContents = WITH_CONTENTS.has(selectedNode.collection)}
			<div
				class="explore-read"
				class:explore-read--with-nav={withContents}
				class:is-resizing={!!widths.drag}
				style:--nav-w={widths.css('nav')}
				style:--panel-w={widths.css('panel')}
			>
				<nav class="mobile-tabs" aria-label="Panelen">
					{@render tabs(true)}
					{#if withContents}
						<button
							type="button"
							class="mobile-tab mobile-tab--toc"
							aria-haspopup="dialog"
							aria-expanded={tocOpen}
							onclick={() => (tocOpen = true)}>Inhoud</button
						>
					{/if}
				</nav>
				{#if withContents}
					<div class="col col--nav toc-column">
						{@render toc()}
					</div>
					{@render handle('nav')}
				{/if}
				<div class="col col--reader col--measure" class:mobile-hidden={mobilePanel === 'verbonden'}>
					{@render reader()}
				</div>
				{@render handle('panel')}
				<div
					class="col col--panel"
					class:mobile-hidden={mobilePanel !== 'verbonden'}
					use:sprongDoel={{
						id: 'verbonden',
						label: 'Naar Verbonden',
						naast: READ_BESIDE
					}}
				>
					{@render panel(false)}
				</div>
			</div>
			{#if withContents && tocOpen}
				<TocSheet onClose={() => (tocOpen = false)}>{@render toc()}</TocSheet>
			{/if}
		{:else if focusError}
			<p class="explore-empty stil">{focusError}</p>
		{:else if focus || pad}
			<!-- The bron is on its way: said, not left as an empty page. -->
			<p class="explore-empty stil" role="status">Laden…</p>
		{/if}
	</div>
</div>

{#if selectedNode && filterSheet.component}
	{@const FilterSheet = filterSheet.component}
	<FilterSheet
		open={filterOpen}
		{filter}
		groups={verbonden.groups}
		lidTellingen={verbonden.lidTellingen ?? null}
		selection={selectedNode.collection}
		onApply={applyFilter}
		onClose={() => (filterOpen = false)}
	/>
{/if}

<style>
	/* The visible height: on iOS Safari 100vh is the height without its toolbar, taller than
	   the screen, so the page under the top bar shifted and Bladeren's end was out of reach
	   (Thijs, iPhone, 10 Oct). dvh where the browser has it, vh before it. */
	.explore-shell {
		display: flex;
		flex-direction: column;
		height: calc(100vh - var(--topbar-h));
		height: calc(100dvh - var(--topbar-h));
		overflow: hidden;
	}

	.explore-content {
		flex: 1;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}
	.index-rol {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		-webkit-overflow-scrolling: touch;
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

	/* The network gives way before the text does: the reader keeps 610px, enough for a
	   measure of some 60 characters, and the canvas takes what is left up to its width.
	   At 1280px: network 252, reader 610, Verbonden 408. */
	.explore-graph--with-reader {
		grid-template-columns:
			max(200px, min(var(--graph-w, var(--graph-w-auto)), calc(100vw - var(--panel) - 620px)))
			5px minmax(0, 1fr) 5px var(--panel);
	}

	/* The widths that follow the screen, until a column is dragged. Verbonden is as wide as
	   a group's heading with its count and its box on one line ("Uitspraken die dit artikel
	   aanhalen 127", Thijs 10 Oct: "het kader zelf sowieso iets breder altijd"); the room
	   comes from the network, never from the reader. Below 1440 Verbonden grows with the
	   screen to 408, so the network keeps 252 at 1280 and the reader 610 down to 1172. At
	   1440 Verbonden 432 and the network 328, so the reader keeps 670 and its lid numbers
	   in the margin (ArticleText's container query at 600). From 1600 the room goes to the
	   network (at least 328): the reader keeps some 850px (a measure of 700 in the middle),
	   Verbonden grows a little, from 432 to at most 480 at 2080 (Thijs: "niet te veel").
	   At 1920: network 606, reader 840, Verbonden 464; at 2560: 1220, 850, 480. */
	.explore-graph,
	.explore-read {
		--nav-w-auto: 220px;
		--graph-w-auto: 360px;
		--panel-w-auto: clamp(340px, calc(100vw - 872px), 408px);
		--panel: var(--panel-w, var(--panel-w-auto));
	}
	/* Beside the reader's contents (220) Verbonden leaves the reader 670 at 1280. */
	@media (max-width: 1439px) {
		.explore-read--with-nav {
			--panel-w-auto: clamp(340px, calc(100vw - 900px), 408px);
		}
	}
	@media (min-width: 1440px) {
		.explore-graph,
		.explore-read {
			--graph-w-auto: 328px;
			--panel-w-auto: 432px;
		}
		/* One title column for every reader (Thijs, 10 Oct, "Voor Thijs" 4): the contents
		   take the network's width less the difference in the reader's left margin (64 for
		   the hanging numbers of the leden, 32 beside the network), so a title starts where
		   it does beside the network (365 at 1440) and the article keeps 590 px. */
		.explore-read {
			--nav-w-auto: calc(var(--graph-w-auto) + var(--s-6) - 64px);
		}
	}
	@media (min-width: 1600px) {
		.explore-graph,
		.explore-read {
			--panel-w-auto: clamp(432px, calc(432px + (100vw - 1600px) / 10), 480px);
			--graph-w-auto: max(328px, calc(100vw - var(--panel) - 850px));
		}
	}

	/* In the page the text comes first (see the markup); on a wide screen the network
	   stands left of it. */
	@media (min-width: 1101px) {
		.explore-graph--with-reader > * {
			grid-row: 1;
		}
		.explore-graph--with-reader .col--graph {
			grid-column: 1;
		}
		.explore-graph--with-reader .resize-handle--graph {
			grid-column: 2;
		}
		.explore-graph--with-reader .col--reader {
			grid-column: 3;
		}
		.explore-graph--with-reader .resize-handle--panel {
			grid-column: 4;
		}
		.explore-graph--with-reader .col--panel {
			grid-column: 5;
		}
	}

	.explore-read {
		grid-template-columns: minmax(0, 1fr) 5px var(--panel);
	}

	.explore-read--with-nav {
		grid-template-columns: var(--nav-w, var(--nav-w-auto)) 5px minmax(0, 1fr) 5px var(--panel);
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
		top: var(--s-2);
		right: var(--s-3);
		z-index: var(--z-raised);
		font-family: var(--font-serif);
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
	/* In the middle between the two side columns (Thijs, 11 Oct: "gecentreerd tussen de twee
	   zijpanelen"): wider than the measure, the room falls to both sides alike, beside the
	   network as beside the contents. Narrower, the text fills the column as before. */
	.col--reader {
		--reader-max: 700px;
		--reader-col-left: auto;
	}
	.col--measure {
		--reader-pad-top: 40px;
		--reader-pad-left: 64px;
		--reader-pad-right: 48px;
		--reader-max: 790px;
	}
	/* One title column for every reader (round 2 of the consistency pass, 10 Oct): a reader
	   without contents (a dossier, a lid, a stemming) starts where one with contents does,
	   past the width the contents would take, not in the middle of its wider column. */
	@media (min-width: 769px) {
		.explore-read:not(.explore-read--with-nav) .col--measure {
			--reader-col-left: calc(var(--nav-w, var(--nav-w-auto)) + 5px);
		}
	}

	.explore-empty {
		margin: var(--s-6);
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
		z-index: var(--z-raised);
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

	/* The tabs of a phone and of the narrow read view: shown by the media rules below. */
	/* A height in whole pixels: the tabs' own grew 32 → 32.5 px when the UI font came, and
	   moved the text under them half a pixel (FE2, 10 Oct: 0 px after the first paint). */
	.mobile-tabs {
		display: none;
		height: var(--veld-h);
		box-sizing: border-box;
		border-bottom: 1px solid var(--rule);
		background: var(--paper-2);
	}
	.mobile-tabs .mobile-tab {
		flex: 1;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-3);
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		padding: var(--s-2) var(--s-1) var(--s-2);
		cursor: pointer;
		margin-bottom: -1px;
	}
	.mobile-tabs .mobile-tab.is-active {
		color: var(--ink);
		border-bottom-color: var(--ink);
		font-weight: 500;
	}

	/* Netwerk in the tabs of Tekst: on a phone the tabs replace the switch in the bar. */
	.mobile-tab--phone {
		display: none;
	}
	@media (max-width: 768px) {
		.explore-read .mobile-tab--phone {
			display: block;
		}
	}

	.mobile-tab--toc {
		flex: none;
		margin-left: auto;
		color: var(--ink-2);
	}

	/* The nav column (LezenNav/DocumentToc/JudgmentToc) is a permanent column above
	   1100px; below it, Inhoud opens the same content as a sheet (TocSheet). */
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
		}
		.explore-read .col {
			grid-row: 2;
			grid-column: 1;
		}
		.explore-read .toc-column,
		.explore-read .resize-handle,
		.explore-read .mobile-hidden {
			display: none;
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
		}
		.col {
			grid-row: 2;
			grid-column: 1;
		}
		.resize-handle,
		.mobile-hidden {
			display: none;
		}
	}
</style>

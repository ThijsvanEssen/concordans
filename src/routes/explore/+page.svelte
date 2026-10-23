<script lang="ts">
	// The explorer: one bron at a time, in one of three modes. Lezen shows the bron with
	// its verbindingen alongside; Netwerk is a werkplek of its own, the canvas without a reader
	// (besluit 39); Bladeren lists bronnen. The URL holds the state (./explore-url.ts names
	// every param).
	//
	// A click on the canvas marks a bron (?marked) and opens its card; Lees on it reads the bron,
	// a step of its own: Back brings the werkplek back from its address.
	import { NOT_IN_DATA, noneHeld, notHeld } from '$lib/text/coverage';
	import { articleRef } from '$lib/text/bw';
	import { categoryLabel } from '$lib/components/explore/index/categories';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { afterNavigate, goto } from '$app/navigation';
	import type { Collection, Relation } from '$lib/vocabulary';
	import { sprongDoel } from '$lib/stores/sprong';
	import { inView } from '$lib/actions/in-view';
	import { PHONE, READ_BESIDE } from '$lib/util/breakpoints';
	import { laadWetsnetwerk } from '$lib/components/actueel/wetsnetwerk';
	import { vandaag, yearFraction } from '$lib/text/datum';
	import { meldNetwerk, showNetworkFailure } from '$lib/stores/netwerk-melding';
	import {
		DEFAULT_FILTERS,
		NEIGHBORHOOD_CAP,
		NEIGHBORHOOD_CAP_PHONE,
		type NeighborhoodReach
	} from '$lib/graph/store/types';
	import { lawArticles, lawNav, type LawNavItem } from '$lib/bron/law-articles';
	import { getArticleDetail } from '$lib/api/articles';
	import type { Step } from '$lib/bron/step.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { pageName } from '$lib/bron/tab-title';
	import { titelVan } from '$lib/bron/titels.svelte';
	import { ignore, isAborted, isNotFound, report } from '$lib/api/errors';
	import { bewaardNetwerk, bewaarNetwerk, leesBewaard } from '$lib/selection/bewaard.svelte';
	import PanelBoundary from '$lib/components/ui/PanelBoundary.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { LoadFailure } from '$lib/util/load.svelte';
	import { Lazy } from '$lib/util/lazy.svelte';
	import { getNodeCanvas, getNodeHull } from '$lib/api/records';
	import { kopNode } from '$lib/bron/first-node';
	import {
		bronHref,
		exploreMode,
		focusOf,
		modeOf,
		openHref,
		refId,
		refOf,
		type BronRef
	} from '$lib/bron/href';
	import { getDossierKey } from '$lib/api/dossiers';
	import { getMemberVotes } from '$lib/api/members';
	import { createGraphStore } from '$lib/graph/graph-store';
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
	import LezenNav from '$lib/components/explore/LezenNav.svelte';
	import DocumentToc from '$lib/components/explore/DocumentToc.svelte';
	import JudgmentToc from '$lib/components/explore/JudgmentToc.svelte';
	import type IndexView from '$lib/components/explore/IndexView.svelte';
	import IndexOverzicht from '$lib/components/explore/index/IndexOverzicht.svelte';
	import Verbonden from '$lib/verbonden/Verbonden.svelte';
	import VerbindingCard from '$lib/verbonden/VerbindingCard.svelte';
	import {
		FILTER_GROUPS,
		filterGroupOf,
		filterParams,
		parseFilter,
		type FilterGroup,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { CanvasCounts } from '$lib/components/graph/canvas-count';
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
	import { articleOf, kort, lawIdOf, nodeToGraphNode, syntheticNode } from '$lib/graph/types';
	import { bronNaam } from '$lib/bron/naam';
	import { lookUp } from '$lib/bron/leesbaar';
	import {
		keyEcli,
		padOfFocus,
		parsePad,
		remember as rememberPad,
		exploreHref,
		exploreUrl
	} from '$lib/bron/address';
	import { ensureInstrumentName, instrumentMetaStore, lawName } from '$lib/api/instrument-cache';
	import NetwerkPanel from '$lib/selection/NetwerkPanel.svelte';
	import NetworkOptions from '$lib/selection/NetworkOptions.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import ChainView from '$lib/network/ChainView.svelte';
	import SharedView from '$lib/network/SharedView.svelte';
	import { chain, isRegulation, type ChainNode } from '$lib/network/chain';
	import { sharedFromNetwork, sharedModel } from '$lib/network/shared';
	import { getLawBasis, getLawDelegated } from '$lib/api/articles';
	import { getShared } from '$lib/api/nodes';
	import { getEuLinks } from '$lib/api/verbonden';
	import { formatCount } from '$lib/text/getal';
	import { capitalize, joinAnd, textOf } from '$lib/text/words';
	import { focusStap } from '$lib/graph/focus-stap';
	import {
		onlyAround,
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
	import { panelOfKey, verbondenInView, type Panel } from './panels';
	import { citedByName, pathByName } from '$lib/bron/law-name';
	import { followServerMove } from '$lib/bron/moved-law';
	import { ColumnWidths, type Column } from './column-widths.svelte';
	import { NetwerkComposer } from './netwerk-compose.svelte';
	import { OverlayCounts } from './overlay-counts.svelte';
	import TocSheet from './TocSheet.svelte';
	import BronFailure from '$lib/components/explore/BronFailure.svelte';
	import { contentsEmpty } from '$lib/components/explore/contents-state.svelte';
	import ExampleLine from './ExampleLine.svelte';

	// One store for the lifetime of this page, so it survives mode switches.
	const store = createGraphStore();
	// The netwerk of chosen bronnen, put on the canvas (netwerk-compose.svelte.ts).
	const composer = new NetwerkComposer(store, () => graphView);

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

	/** The focus names a bron the data does not hold: said in words, no failure. */
	let focusNotHeld = $state<string | null>(null);
	/**
	 * The bron asked could not be loaded (the address looked up, or the bron itself): said in
	 * its place with LoadState, Opnieuw asking again; the bron shown before does not stay.
	 */
	let loadFailure = $state.raw<LoadFailure | null>(null);
	/** Opnieuw on an address that could not be looked up: it is looked up again. */
	let padRetries = $state(0);
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
	/** A law by its name where it is known, for what the page says of an address. */
	const lawNameOf = (bwb: string) => lawName($instrumentMetaStore.get(bwb), null);
	/** The address names a bron the data does not hold: said in words, no failure. */
	let padNotHeld = $state<string | null>(null);
	/** The address names a bron the data lacks: a 404, as the server gives it. */
	let padOnbekend = $state(false);
	$effect(() => {
		const p = pad;
		void padRetries;
		padNotHeld = null;
		padOnbekend = false;
		loadFailure = null;
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
				padNotHeld = `${notHeld(nameOfPad(p, lawNameOf))}.`;
				padOnbekend = true;
			})
			.catch((e) => {
				if (ac.signal.aborted || isAborted(e)) return;
				report('Verkenner adres', e);
				loadFailure = { what: nameOfPad(p, lawNameOf), error: e, retry: () => padRetries++ };
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
	const focus = $derived(params.get('focus') ?? '');
	// Every bron opens in Tekst, its reader with Verbonden beside it; the canvas is Samenhang
	// (besluit 32). Netwerk tonen draws the network in Verbonden (?toon=netwerk).
	const mode = $derived(exploreMode(params, !!pad));
	const SHOW = 'toon';
	const showNetwork = $derived(params.get(SHOW) === 'netwerk');
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
	//
	// Arriving in the werkplek from a bron (the button Netwerk, In het netwerk, a link with
	// ?mode=netwerk), the netwerk kept in this browser opens with the bron as a proposal beside
	// it (+ bron in the panel Netwerk), never replaced without a word; without one the bron is
	// the beginning, its surroundings drawn around it (besluit 39). Only on arrival, never on
	// Back: a netwerk emptied in the werkplek stays empty, an address comes back as it was.
	leesBewaard();
	let beginNodig = $state(false);
	const beginQuery = $derived(
		beginNodig && focus && mode === 'graph' && !netwerkQueryOf(params) ? bewaardNetwerk() : null
	);
	const netwerkQuery = $derived(beginQuery ?? netwerkQueryOf(params));
	$effect(() => {
		const q = beginQuery;
		if (q) untrack(() => setUrl(Object.fromEntries(new URLSearchParams(q))));
	});
	$effect(() => {
		if (beginNodig && (mode !== 'graph' || netwerkQueryOf(params) || (focus && !bewaardNetwerk())))
			beginNodig = false;
	});
	const telefoon = typeof window !== 'undefined' && window.matchMedia(PHONE).matches;
	// "Bronnen ertussen" is on by default, on a phone too (Thijs, 9 Oct, from an iPhone): the
	// clusters, the faint bronnen between and the cap of 100 keep it light there.
	// ── The example, where nothing is chosen ─────────────────────────────────
	// The Verkenner without a focus, a netwerk or one remembered opens on the home page's
	// own example (Thijs, 10 Oct: "marked dan het voorbeeld dat van de homepage komt"): the
	// network of the newest passed bill, as laadWetsnetwerk gives it there. Shown, not
	// written: the address stays /explore. A line above says it is an example.
	let voorbeeld = $state<{ query: string; naam: string } | null>(null);
	const zonderKeuze = $derived(!focus && !pad && !netwerkQuery && mode !== 'index');
	$effect(() => {
		if (!zonderKeuze || voorbeeld || bewaardNetwerk()) return;
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
	// "Alleen verbonden bronnen" is a filter on the netwerk, not a replacement: ?omgeving names
	// the bron whose surroundings alone are drawn; the chosen bronnen stay in the address, greyed,
	// and come back when the filter goes off.
	const AROUND = 'omgeving';
	const aroundId = $derived(parseNodeId(params.get(AROUND) ?? '') ? params.get(AROUND) : null);
	const shownNetwork = $derived(aroundId ? onlyAround(netwerk, aroundId) : netwerk);
	const netwerkActive = $derived(shownNetwork.ids.length > 0);
	/** Outside the werkplek, the netwerk kept in this browser: a bron read is added to it. */
	const bewaard = $derived(parseNetwerk(new URLSearchParams(bewaardNetwerk() ?? '')));
	/** The netwerk a bron is added to: the werkplek's, or the kept one while reading. */
	const kiesNetwerk = $derived(mode === 'graph' ? netwerk : bewaard);
	/** The bron marked in the werkplek, its card open (?marked): Back after Lees finds it again. */
	const MARK_PARAM = 'kies';
	const marked = $derived(params.get(MARK_PARAM));

	// ── The weergaven of the werkplek (besluit 39) ───────────────────────────
	// Omgeving is the canvas; Verband what the chosen bronnen share (/api/nodes/shared); Keten
	// a law, its articles and the regulations under them (/delegated, /basis). ?weergave.
	const VIEW_PARAM = 'weergave';
	const VIEWS = [
		{ waarde: 'omgeving', label: 'Omgeving' },
		{ waarde: 'verband', label: 'Verband' },
		{ waarde: 'keten', label: 'Keten' }
	] as const;
	type ViewId = (typeof VIEWS)[number]['waarde'];
	const view = $derived<ViewId>(
		VIEWS.find((w) => w.waarde === params.get(VIEW_PARAM))?.waarde ?? 'omgeving'
	);
	const chooseView = (w: ViewId) =>
		setUrl({ [VIEW_PARAM]: w === 'omgeving' ? null : w, [MARK_PARAM]: null });

	/**
	 * Where the keten starts: the bron of the page, else the first chosen bron of the netwerk
	 * that is a law or an article (R3-N B3: /explore?netwerk=instruments/… said "alleen bij een
	 * wet" for a law).
	 */
	const chainStart = $derived.by(() => {
		if (mode !== 'graph' || view !== 'keten') return null;
		const wetgeving = (n: GraphNode | null | undefined) =>
			n?.collection === 'instruments' || n?.collection === 'articles';
		if (wetgeving(selectedNode)) return selectedNode;
		return (
			composer.entries.find(
				(e) => e.on && e.node && (e.collection === 'instruments' || e.collection === 'articles')
			)?.node ?? null
		);
	});
	/**
	 * Whether Keten means something here: a law, a regulation or an article as the bron or among
	 * the chosen ones; elsewhere it is offered greyed (R3-K F9, R3-I F1).
	 */
	const ketenKan = $derived(
		mode === 'graph' &&
			[selectedNode, ...composer.entries.filter((e) => e.on).map((e) => e.node)].some(
				(n) => n?.collection === 'instruments' || n?.collection === 'articles'
			)
	);
	/** The law of the keten: the bron itself, or an article's law. */
	const chainLaw = $derived.by(() => {
		const n = chainStart;
		if (!n) return null;
		if (n.collection === 'articles') return lawIdOf(n.raw?.props) ?? null;
		if (n.collection !== 'instruments') return null;
		return lawIdOf(n.raw?.props) ?? n.key.toUpperCase();
	});
	/** An article as the start: the keten of the regulations issued under it (R3-K F5). */
	const chainArticle = $derived(
		chainStart?.collection === 'articles'
			? (articleOf(chainStart.raw?.props)?.articleNumber ?? null)
			: null
	);
	/** The start's kind (`AMvB`, `beleidsregel`, `publicatie`, `richtlijn`): its layer's heading. */
	const chainKind = $derived(
		chainStart?.collection === 'instruments' ? textOf(chainStart.raw?.props?.kind) : null
	);
	let chainData = $state.raw<{
		bwb: string;
		delegated: Awaited<ReturnType<typeof getLawDelegated>>;
		basis: Awaited<ReturnType<typeof getLawBasis>> | null;
		eu: Awaited<ReturnType<typeof getEuLinks>> | null;
	} | null>(null);
	let chainError = $state.raw<{ bwb: string; error: unknown } | null>(null);
	let chainTries = $state(0);
	const chainFailure = $derived(
		chainError && chainError.bwb === chainLaw
			? { what: 'De keten', error: chainError.error, retry: () => chainTries++ }
			: null
	);
	$effect(() => {
		const bwb = chainLaw;
		void chainTries;
		if (!bwb) return;
		let current = true;
		chainError = null;
		// The keten stands without the laws above it and without its EU acts: its own
		// regulations are what it shows.
		const basis = getLawBasis(bwb).catch((e) => {
			report('Keten grondslag', e);
			return null;
		});
		const eu = getEuLinks(bwb).catch((e) => {
			if (!isNotFound(e)) report('Keten EU', e);
			return null;
		});
		Promise.all([getLawDelegated(bwb), basis, eu])
			.then(([delegated, basis, eu]) => {
				if (current) chainData = { bwb, delegated, basis, eu };
			})
			.catch((e) => {
				report('Keten', e);
				if (current) chainError = { bwb, error: e };
			});
		return () => {
			current = false;
		};
	});
	/** The keten is on its way: the drawing says so, and Soort counts nothing yet (R3-K F6). */
	const chainLoading = $derived(!!chainLaw && chainData?.bwb !== chainLaw && !chainFailure);
	// An article's law by its name, not its id, on the keten's head.
	$effect(() => {
		if (chainArticle) ensureInstrumentName(chainLaw);
	});
	const chainModel = $derived.by(() => {
		const bwb = chainLaw;
		if (!bwb || chainData?.bwb !== bwb) return null;
		const id = `instruments/${bwb.toLowerCase()}`;
		const start = chainStart;
		// A publication by its name (Stb. 2018, 101), never its key (R3-K F11).
		const name =
			start?.collection === 'instruments'
				? bronNaam(start, $instrumentMetaStore)
				: lawName($instrumentMetaStore.get(bwb), bwb);
		const eu = chainData.eu;
		return chain({ id, name }, chainData.delegated, chainData.basis, {
			max: 4,
			keep: marked,
			kind: chainKind,
			article: chainArticle,
			eu: eu
				? {
						implements: eu.implements.map((l) => l.instrument),
						implementedBy: eu.implemented_by.map((l) => l.instrument)
					}
				: null
		});
	});
	/** The article the keten starts from, as the drawing names it: marked until another is. */
	const chainArticleId = $derived(
		chainArticle ? (chainModel?.layers.find((l) => l.id === 'article')?.nodes[0]?.id ?? null) : null
	);
	const chainGap = $derived.by(() => {
		if (view !== 'keten' || chainLoading) return null;
		if (!chainLaw) return 'Keten: alleen bij een wet, een regeling of een artikel';
		const m = chainModel;
		if (!m) return null;
		if (m.missing.length)
			return `${joinAnd(m.missing.slice(0, 2), { n: m.missing.length - 2, one: 'andere', many: 'andere' })}: grondslag ${NOT_IN_DATA}`;
		// A regulation whose grondslag the data lacks says so, as the law above it does (F3).
		const zonderGrondslag = isRegulation(chainKind) && !m.layers.some((l) => l.id === 'basis');
		const geen =
			m.total === 0 && !m.layers.some((l) => l.id === 'implementation')
				? noneHeld(
						chainArticle
							? `uitvoeringsregelingen op grond van ${articleRef(null, chainArticle)}`
							: 'uitvoeringsregelingen'
					)
				: null;
		const gaten = [zonderGrondslag ? `grondslag ${NOT_IN_DATA}` : null, geen].filter(Boolean);
		return gaten.length ? capitalize(gaten.join(', ')) : null;
	});
	/** A node of the keten as the card reads a bron. */
	function chainNodeOf(k: ChainNode): GraphNode {
		const [collection, key] = k.id.split('/') as ['instruments' | 'articles', string];
		const i = k.instrument;
		return {
			id: k.id,
			collection,
			key,
			drawClass: collection === 'articles' ? 'article' : 'instrument',
			label: k.name,
			raw: {
				id: k.id,
				key,
				collection,
				type: collection === 'articles' ? 'article' : 'instrument',
				display_name: k.name,
				labels: [],
				path: i?.path ?? null,
				props: {
					bwb_id: i?.bwb_id ?? null,
					title: i?.title ?? null,
					citation_title: i?.citation_title ?? null,
					kind: k.kind,
					date: k.since
				}
			}
		} as GraphNode;
	}
	const chainCard = $derived.by(() => {
		const k = [
			...(chainModel?.layers.flatMap((l) => l.nodes) ?? []),
			...Object.values(chainModel?.more ?? {}).flat()
		].find((x) => x.id === marked);
		if (!k) return null;
		const aangehaald = k.instrument?.inbound_citation_count;
		return {
			node: chainNodeOf(k),
			facts: [
				...(k.grondslag ? [{ term: 'Grondslag', value: k.grondslag }] : []),
				...(k.mentions ? [{ term: 'Noemt', value: k.mentions }] : []),
				...(aangehaald ? [{ term: 'Aangehaald', value: `${formatCount(aangehaald)} keer` }] : [])
			],
			tiesHeading: 'Verder in de keten',
			ties: (k.further.length
				? k.further
				: k.collection === 'instruments' && k.id !== `instruments/${chainLaw?.toLowerCase()}`
					? [capitalize(noneHeld('uitvoeringsregelingen'))]
					: []
			).map((text) => ({ text, collection: 'instruments' as const }))
		};
	});
	const chainDots = $derived(
		(chainModel?.layers ?? [])
			.flatMap((l) => l.nodes)
			.filter((k) => k.since)
			.map((k) => ({ jaar: yearFraction(k.since!), collection: 'instruments' as const }))
	);

	/** The chosen bronnen of the netwerk that are on, as the API names them: Verband's ends. */
	const sharedEnds = $derived(
		mode === 'graph' && view === 'verband'
			? composer.entries
					.filter((e) => e.on && e.node)
					.slice(0, 5)
					.map((e) => ({
						id: e.node!.id,
						name: bronNaam(e.node!, $instrumentMetaStore),
						collection: e.collection,
						connections: e.connections ?? null
					}))
			: []
	);
	const sharedKey = $derived(sharedEnds.map((e) => e.id).join(','));
	let sharedData = $state.raw<{
		key: string;
		data: Awaited<ReturnType<typeof getShared>> | null;
		failure: 'niet' | 'mis' | null;
		error?: unknown;
	} | null>(null);
	let sharedTries = $state(0);
	const sharedFailure = $derived(
		sharedData?.key === sharedKey && sharedData.failure === 'mis'
			? {
					what: 'De gedeelde bronnen',
					error: sharedData.error,
					retry: () => sharedTries++,
					plural: true
				}
			: null
	);
	$effect(() => {
		const key = sharedKey;
		void sharedTries;
		if (key.split(',').length < 2) return;
		const ac = new AbortController();
		getShared({ ids: key, limit: 8 }, ac.signal)
			.then((data) => (sharedData = { key, data, failure: data ? null : 'niet' }))
			.catch((e) => {
				if (ac.signal.aborted || isAborted(e)) return;
				if (!isNotFound(e)) report('Verband', e);
				sharedData = { key, data: null, failure: isNotFound(e) ? 'niet' : 'mis', error: e };
			});
		return () => ac.abort();
	});
	// Where the API has no shared bronnen yet (A200 not live), the canvas's own: the bronnen
	// between the chosen ones, marked as such.
	let coreIds = $state.raw<ReadonlySet<string> | null>(null);
	store.core.subscribe((c) => (coreIds = c));
	let canvasEdges = $state.raw<GraphEdge[]>([]);
	store.edges.subscribe((e) => (canvasEdges = e));
	const sharedState = $derived.by(() => {
		const here = sharedData?.key === sharedKey ? sharedData : null;
		const d =
			here?.data ??
			(here?.failure === 'niet' && coreIds
				? sharedFromNetwork(
						sharedEnds.map((e) => e.id),
						coreIds,
						(id) => {
							const n = store.getNodeById(id);
							return n && { ...n, label: bronNaam(n, $instrumentMetaStore) };
						},
						canvasEdges
					)
				: null);
		if (!d) return null;
		const byId = new Map(sharedEnds.map((e) => [e.id, e]));
		const model = sharedModel(d, (id) => ({
			name: byId.get(id)?.name ?? id,
			collection: byId.get(id)?.collection ?? null
		}));
		// From the netwerk itself, the judgments both cite are not known: "?", as the gap says.
		return here?.data ? model : { ...model, judgments: null };
	});
	const sharedGap = $derived(
		sharedData?.key === sharedKey && sharedData.failure === 'niet'
			? 'onvolledig: alleen de bronnen ertussen'
			: null
	);
	// Soort and Relatie of a weergave of its own count what it draws, and its filter hides it.
	let hiddenRelations = $state.raw<ReadonlySet<Relation>>(new Set());
	store.filters.subscribe((f) => (hiddenRelations = f.hiddenRelations));
	const hiddenKinds = $derived<ReadonlySet<FilterGroup>>(
		new Set(FILTER_GROUPS.filter((k) => filter.bronnen && !filter.bronnen.has(k)))
	);
	const chainCounts = $derived.by(() => {
		// On its way, Soort counts nothing: not the canvas's numbers that the keten's replace (F6).
		if (!chainModel) return { kinds: {}, relations: {} };
		const nodes = chainModel.layers.flatMap((l) => l.nodes);
		const lines = nodes.flatMap((n) => n.parents);
		const articles = nodes.filter((n) => n.collection === 'articles').length;
		return {
			kinds: { wetten: nodes.length - articles, artikelen: articles },
			relations: {
				BASED_ON: lines.filter((l) => l.way === 'delegates').length,
				REFERS_TO: lines.filter((l) => l.way === 'mentioned').length
			}
		} satisfies Pick<CanvasCounts, 'kinds' | 'relations'>;
	});
	const sharedCounts = $derived.by(() => {
		if (!sharedState) return null;
		const kinds: Partial<Record<FilterGroup, number>> = {};
		for (const r of sharedState.rows) {
			const k = filterGroupOf(r.collection, r.node.key, r.node.props);
			if (k) kinds[k] = (kinds[k] ?? 0) + 1;
		}
		if (sharedState.judgments) kinds.uitspraken = (kinds.uitspraken ?? 0) + sharedState.judgments;
		const relations: Partial<Record<Relation, number>> = {};
		for (const r of sharedState.rows)
			for (const rel of r.relations) relations[rel] = (relations[rel] ?? 0) + 1;
		return { kinds, relations } satisfies Pick<CanvasCounts, 'kinds' | 'relations'>;
	});
	/** The tijdstrook of Verband: the shared bronnen with a date. */
	const sharedDots = $derived(
		(sharedState?.rows ?? []).flatMap((r) => {
			const datum = textOf(r.node.props?.date);
			return datum ? [{ jaar: yearFraction(datum), collection: r.collection }] : [];
		})
	);
	const sharedCard = $derived.by(() => {
		const r = sharedState?.rows.find((x) => x.id === marked);
		const node = r ? (store.getNodeById(r.id) ?? nodeToGraphNode(r.node)) : null;
		return r && node ? { node, ties: r.how } : null;
	});

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
	/** Verbonden came in view, under the text on a narrow screen: it loads (laad lui). */
	let panelSeen = $state(false);
	// Verbonden loads when it is in view (verbondenInView).
	$effect(() => {
		const node = mode === 'index' ? null : selectedNode;
		// In Tekst on a phone Verbonden stands under the text: it loads once it comes in view.
		const panel = mode === 'read' && panelSeen ? 'verbonden' : mobilePanel;
		const view = { phone: telefoon, table: tableMode, panel };
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
	// The first lading is the nodes' sample (5 of 21 on UHW 3): while the wijzigingen are on their
	// way the count says "meer dan", so it does not spring to another number on the same page.
	const billMore = $derived(
		!!verbonden.wachtend?.includes('changes') ||
			verbonden.groups.some(
				(g) => g.capped && g.rows.some((r) => r.filterGroup === 'wetsvoorstellen')
			)
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
	/** Zet in het netwerk from the card Verbinding: the row's bron joins the netwerk. */
	function showInNetwork(row: Row) {
		const id = focusOf(row.ref);
		if (id) addIdToNetwerk(id, row.title);
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
	/** Vorig or Volgend: the article's text asked before its address (Steps). */
	const articleStep = (i: number): Step | undefined => {
		const item = i >= 0 ? navItems[i] : undefined;
		const bwb = navLaw;
		return item && bwb
			? {
					href: bronHref({ collection: 'articles', key: item.key }),
					name: item.label,
					load: () => getArticleDetail(bwb, item.articleNumber)
				}
			: undefined;
	};
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
			focusNotHeld = null;
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
	function missing(id: string) {
		if (followServerMove(page.url.pathname)) return;
		wachtOp = null;
		focusMissing = true;
		focusNotHeld = `${notHeld(nameOfAddress(id))}.`;
	}

	/** A bron as its address names it (an ECLI, a law's id, a law by its name), never by the key of the data. */
	function nameOfAddress(id: string | null): string {
		const named = pad ?? parsePad(padOfFocus(id ?? '') ?? '');
		return named ? nameOfPad(named, lawNameOf) : 'Deze bron';
	}

	async function loadFocus(id: string) {
		focusNotHeld = null;
		loadFailure = null;
		focusMissing = false;
		const replace = replaceNext === id;
		replaceNext = null;
		// A light node is in the store but was never drawn: it is not on the canvas.
		const licht = untrack(() => lichtGeladen) === id;
		lichtGeladen = null;
		const target = parseNodeId(id);
		if (!target) {
			focusNotHeld = `${notHeld('Deze bron')}.`;
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
					missing(id);
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
				} else missing(id);
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
				missing(id);
				return;
			}
			store.focusNode(node.id);
			if (inGraph) await deepen(node, replace);
		} catch (err) {
			if (isNotFound(err)) missing(id);
			else showFocusError(err, target.key);
		}
	}

	/**
	 * A focus or its neighbourhood that did not come: a newer focus (an abort) says nothing.
	 * The focus itself shown, only its neighbourhood failed: the canvas and the reader stay,
	 * and the network says it. Another bron shown (the one before): it goes, and the failure
	 * stands in the new one's place, with Opnieuw (UX-toets A32 #2).
	 */
	function showFocusError(err: unknown, key: string) {
		if (isAborted(err)) return;
		wachtOp = null;
		report('Verkenner focus', err);
		const huidig = untrack(() => selectedNode);
		const asked = loadedFocus;
		const name = nameOfAddress(asked);
		if (huidig && (huidig.id === asked || linkIdOf(huidig) === asked || huidig.key === key)) {
			showNetworkFailure({ what: 'Het netwerk', error: err, retry: () => retryFocus(asked) });
			return;
		}
		// A judgment is named by its ECLI: its reader stands on that and says in its own column
		// what failed, with Verbonden beside it, as every other kind does.
		const target = parseNodeId(asked);
		const ecli = target?.collection === 'judgments' ? keyEcli(target.key) : null;
		if (ecli && !huidig) {
			selectedNode = syntheticNode('judgments', target!.key, ecli, { ecli });
			return;
		}
		if (huidig) {
			store.setSelection(null);
			selectedNode = null;
		}
		loadFailure = { what: name, error: err, retry: () => retryFocus(asked) };
	}

	/** Opnieuw on a bron that could not be loaded: the same focus asked again. */
	function retryFocus(id: string) {
		if (!id || id !== focus) return;
		loadedFocus = id;
		loadFocus(id).catch((e) => showFocusError(e, id));
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

	/**
	 * Lees on the card of a marked bron: the bron in Tekst, a step of its own. The werkplek's
	 * address (its netwerk, its filters, the bron marked) stays in the history: Back brings it.
	 */
	function lees(node: GraphNode) {
		if (node.id.startsWith('synth:')) return;
		const end = perfStart(`lees ${node.id}`);
		navigate(openHref(refOf(node.collection, node.key, node.raw?.props)), { step: true });
		end();
	}

	// ── Composing the netwerk ─────────────────────────────────────────────────
	/** The bronnen a grouping switched off hides, by canvas id: their chips grey. */
	let metGroep = $state<ReadonlyMap<string, ContainerKind>>(new Map());

	$effect(() => {
		const n = shownNetwork;
		const omgeving = view === 'omgeving';
		if (mode !== 'graph') return;
		untrack(() => {
			composer.surroundings = omgeving;
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
		if (n.ids.length === 0) bewaarNetwerk(null);
		// Clearing the netwerk or removing a bron is undone with Back.
		const shrinks = n.ids.length < netwerk.ids.length;
		setUrl(netwerkParams(n), { push: shrinks });
	}

	// The werkplek opens on the last netwerk until it is cleared: a bron read does not forget it.
	$effect(() => {
		if (mode === 'graph' && netwerkQuery && netwerk.ids.length > 0) bewaarNetwerk(netwerkQuery);
	});
	$effect(() => {
		// A readable address names its bron, also while it is looked up (a Kamerstuk, an
		// article): the remembered netwerk does not take its place.
		if (focus || pad || netwerkQuery || mode === 'index') return;
		const saved = bewaardNetwerk();
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

	function toggleAround() {
		if (aroundId) return setUrl({ [AROUND]: null });
		const id = selectedLinkId;
		if (!id) return;
		// The first bron of an empty canvas grows out of it, as a bron added does.
		if (!netwerkActive) composer.keepCanvas();
		setUrl({ [AROUND]: id });
	}

	function addToNetwerk(node: GraphNode) {
		const id = linkIdOf(node);
		if (id) addIdToNetwerk(id, kort(bronNaam(node, $instrumentMetaStore)));
	}

	function addIdToNetwerk(id: string, naam?: string) {
		// While reading, the bron joins the netwerk kept for the werkplek; the button Netwerk of
		// the top bar counts it.
		if (mode !== 'graph') {
			bewaarNetwerk(
				new URLSearchParams(netwerkClean(netwerkParams(withAdded(bewaard, id)))).toString()
			);
			return;
		}
		// The first bron chosen grows out of the canvas as it is: what is there stays, as context.
		if (!netwerkActive) composer.keepCanvas();
		setNetwerk(withAdded(netwerk, id));
		meldNetwerk(`${naam ?? 'De bron'} toegevoegd aan het netwerk.`, () =>
			setNetwerk(withRemoved(netwerk, id))
		);
	}
	/** The params of a netwerk that hold a value. */
	const netwerkClean = (p: Record<string, string | null>) =>
		Object.fromEntries(Object.entries(p).filter((e): e is [string, string] => e[1] !== null));

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
		bewaarNetwerk(null);
		setUrl(
			{
				netwerk: null,
				uit: null,
				tussen: null,
				[AROUND]: null,
				focus: null,
				[SHOW]: null,
				[MARK_PARAM]: null,
				open: null,
				mode: null
			},
			{ push: true }
		);
	}

	// The tab names what is open, so that tabs, bookmarks and history tell bronnen apart.
	/** A bron the data lacks, and nothing else to show: the 404 page. */
	const nietGevonden = $derived(
		mode !== 'index' && (focusMissing || padOnbekend) && !selectedNode && !netwerkActive
	);

	const pageTitle = $derived.by(() => {
		if (mode === 'index') return siteTitle(categoryLabel(indexKind));
		if (nietGevonden) return siteTitle('Niet gevonden');
		// While the next bron is on its way the reader still holds the previous one: its name
		// would be the new page's (a screen reader announces the title after each step).
		if (loadFailure && !selectedNode) return siteTitle('Er ging iets mis');
		if (wachtOp || (pad && !focus && !padNotHeld)) return LADEN_TITEL;
		const name = selectedNode ? pageName(selectedNode, titelVan(selectedNode.id)) : null;
		if (name && beside && besideTitle) return siteTitle(`${besideTitle} naast ${name}`);
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
		if (nav.type === 'link' || nav.type === 'popstate' || changed('focus') || changed('mode'))
			steppedIn = true;
		// Into the werkplek with a bron and no netwerk in the address: it begins (beginQuery).
		if (
			nav.type !== 'popstate' &&
			naar &&
			to &&
			modeOf(naar) === 'graph' &&
			(!van || modeOf(van) !== 'graph') &&
			!netwerkQueryOf(to) &&
			(to.get('focus') || naar.pathname !== '/explore')
		)
			beginNodig = true;
	});
	const goBack = () => (steppedIn ? history.back() : goto('/'));

	/**
	 * A change of view that Back should undo (reading at full width, clearing the netwerk)
	 * takes a history entry; a filter or a toggle replaces the current one.
	 */
	function setUrl(patch: ParamPatch, { push = false } = {}) {
		const next = patchParams(logisch.searchParams, patch);
		// The readable address of the focus where it has one: /dossiers/36799?mode=netwerk. An
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

	// Tekst, or the werkplek with the bron: each a step of its own, the netwerk staying in the
	// werkplek's address.
	function setReading(on: boolean) {
		const node = selectedNode;
		if (!node || node.id.startsWith('synth:')) return;
		const ref = refOf(node.collection, node.key, node.raw?.props);
		const at = decodeURIComponent(page.url.hash.slice(1)) || null;
		navigate(on ? openHref(ref, { at }) : werkplekHref(ref, at), { step: true });
	}
	/** The werkplek with the bron: as the button Netwerk of the top bar opens it. */
	const werkplekHref = (ref: BronRef, at: string | null = null) =>
		bronHref(ref, { keepMode: false, mode: 'graph', at });
	// Netwerk tonen and Netwerk verbergen in Verbonden: one step each, so Back undoes it.
	const setShowNetwork = (on: boolean) => setUrl({ [SHOW]: on ? 'netwerk' : null }, { push: true });
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
	const graphChunk = new Lazy<typeof GraphView>(
		() => import('$lib/components/graph/GraphView.svelte'),
		'Verkenner onderdeel'
	);
	const indexChunk = new Lazy<typeof IndexView>(
		() => import('$lib/components/explore/IndexView.svelte'),
		'Verkenner onderdeel'
	);
	$effect(() => graphChunk.load());
	$effect(() => {
		if (mode === 'index') indexChunk.load();
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

	// On a phone Verbonden stands under the text; the key 3 brings it forward.
	let mobilePanel = $state<Panel>('reader');
	// The hint of a phone's tab of before (?paneel) is dropped from the address: the werkplek
	// has no tabs, the text and Verbonden stand under each other.
	$effect(() => {
		if (page.url.searchParams.get('paneel') === null) return;
		untrack(() => setUrl({ paneel: null }));
	});
	/** The canvas is on the screen: the werkplek. */
	const canvasZichtbaar = $derived(mode === 'graph');
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
		'annexes',
		'documents',
		'judgments'
	]);

	/** Whether the bron on screen has contents to go by: a text with one entry or none has no
	 *  column, no tab Inhoud and no button (the tables of contents tell, contents-state). */
	const hasContents = $derived(
		!!selectedNode &&
			WITH_CONTENTS.has(selectedNode.collection) &&
			contentsEmpty.id !== selectedNode.id
	);

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
		if (e.key === 'Escape' && beside && !e.defaultPrevented) {
			e.preventDefault();
			goto(closeBesideHref, { noScroll: true, keepFocus: true }).catch((err) =>
				report('Sluiten', err)
			);
			return;
		}
		// 1 and 3: the layers of a bron, Tekst and Verbonden (Thijs, 10 Oct); 3 puts the focus on
		// Verbonden's first row, for J and K.
		const panel = panelOfKey(e.key);
		if (panel && selectedNode && mode === 'read') {
			e.preventDefault();
			kiesPaneel(panel);
			if (panel === 'verbonden')
				requestAnimationFrame(() =>
					document.querySelector<HTMLElement>('.verbonden a.row__title')?.focus()
				);
			return;
		}
		// O: the filter Alleen verbonden bronnen on or off for the selected bron.
		if (e.key.toLowerCase() === 'o' && mode === 'graph' && (aroundId || selectedNode)) {
			e.preventDefault();
			toggleAround();
			return;
		}
		if (e.key.toLowerCase() !== 'l' || !readAction) return;
		e.preventDefault();
		setReading(readAction === 'read');
	}

	const kiesPaneel = (id: Panel) => (mobilePanel = id);

	/** What the key L does: read the bron, or open the werkplek with it. */
	const readAction = $derived<'read' | 'network' | null>(
		// The table has its own way back to the text.
		tableMode
			? null
			: mode === 'read'
				? 'network'
				: mode === 'graph' && selectedNode
					? 'read'
					: null
	);

	// ── Bladeren ─────────────────────────────────────────────────────────────
	const indexKind = $derived(indexCategory(params));

	const besideArticle = $derived(
		selectedNode?.collection === 'articles' ? articleOf(selectedNode.raw?.props) : null
	);
	const closeBesideHref = $derived(withParams(page.url, { naast: null }));

	// What opens beside the article is announced as opened (B32): the focus goes to its
	// heading once it is there, the tab names it, Escape closes it, and the focus goes back to
	// the row that opened it.
	let besideEl = $state<HTMLElement | null>(null);
	let besideTitle = $state('');
	let besideOpener: HTMLElement | null = null;
	let besideWasOpen = false;
	$effect(() => {
		const el = besideEl;
		void besideId;
		if (!el) return;
		untrack(() => {
			besideTitle = '';
			besideWasOpen = true;
			const opener = document.activeElement;
			if (opener instanceof HTMLElement && opener !== document.body && !el.contains(opener))
				besideOpener = opener;
		});
		const heading = () => el.querySelector<HTMLElement>('h1');
		const take = (h: HTMLElement) => {
			besideTitle = h.textContent?.replace(/\s+/g, ' ').trim() ?? '';
			if (serverKop.actief) serverKop.clear();
			h.setAttribute('tabindex', '-1');
			h.focus({ preventScroll: true });
		};
		const now = heading();
		if (now) {
			take(now);
			return;
		}
		const watch = new MutationObserver(() => {
			const h = heading();
			if (!h) return;
			watch.disconnect();
			take(h);
		});
		watch.observe(el, { childList: true, subtree: true });
		return () => watch.disconnect();
	});
	$effect(() => {
		if (besideId || !besideWasOpen) return;
		untrack(() => {
			besideWasOpen = false;
			besideTitle = '';
			const opener = besideOpener;
			besideOpener = null;
			if (opener?.isConnected) {
				opener.focus({ preventScroll: true });
				return;
			}
			// Opened from a link elsewhere: back to the article's heading.
			const own = document.querySelector<HTMLElement>('.reader__main h1');
			own?.setAttribute('tabindex', '-1');
			own?.focus({ preventScroll: true });
		});
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<svelte:head>
	{#if !serverKop.actief}<title>{pageTitle}</title>{/if}
	{#if nietGevonden}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<!-- A part whose chunk did not come (a deploy removed it): said in its place, Opnieuw asks
     the chunk again. -->
{#snippet chunkMissing(part: { error: unknown; retry: () => void }, what = 'Dit onderdeel')}
	<LoadState
		state={{ status: 'error', error: part.error }}
		{what}
		retry={part.retry}
		form="block"
	/>
{/snippet}

<!-- A bron on its way: the frame of its text, a skeleton where the head and the text will
     stand, so the page does not jump from empty to full (E3 T1). -->
{#snippet bronPending()}
	<div class="explore-read explore-laden">
		<div class="col col--reader col--measure">
			<p class="sr-only" role="status">Laden…</p>
			<ReaderFrame state={{ status: 'loading' }} />
		</div>
	</div>
{/snippet}

<!-- A bron that did not come: in the column of its text, under a heading as a bron has, not
     loose in a corner of the page (E8). -->
{#snippet bronFout(f: LoadFailure)}
	<div class="explore-read">
		<div class="col col--reader col--measure"><BronFailure failure={f} /></div>
	</div>
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
						prev={articleStep(articleIndex - 1)}
						next={articleIndex >= 0 ? articleStep(articleIndex + 1) : undefined}
						{place}
						lidCounts={lidCountsOfArticle}
						lidCounting={!geteld && !apiTellingen}
						{billCount}
						{billMore}
						{filter}
						{proposedRow}
						onCloseProposed={() => (proposedRow = null)}
					/>
				</div>
				{#if beside}
					<div class="reader__beside" bind:this={besideEl}>
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
							{:else if judgmentReader.error}{@render chunkMissing(judgmentReader)}{/if}
						{:else if documentReader.component}
							{@const DocumentReader = documentReader.component}
							<DocumentReader node={beside} article={besideArticle} />
						{:else if documentReader.error}{@render chunkMissing(documentReader)}{/if}
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

{#snippet panel()}
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
					onFilter={applyFilter}
					onOpenFilter={() => (filterOpen = true)}
					onAddToNetwerk={(row) => {
						const id = focusOf(row.ref);
						if (id) addIdToNetwerk(id, row.title);
					}}
					inNetwerk={(row) => kiesNetwerk.ids.includes(focusOf(row.ref) ?? '')}
					onProposedText={(row) => (proposedRow = row)}
					{tableHref}
					{showNetwork}
					onShowNetwork={setShowNetwork}
					networkName={bronNaam(selectedNode, $instrumentMetaStore)}
					networkHref={werkplekHref(
						refOf(selectedNode.collection, selectedNode.key, selectedNode.raw?.props)
					)}
				/>
			</PanelBoundary>
			{#if card}
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

{#snippet viewMiddle(scale: number)}
	{#if view === 'keten'}
		<ChainView
			{scale}
			layers={chainModel?.layers ?? []}
			rest={chainModel?.rest}
			more={chainModel?.more}
			loading={chainLoading}
			chosen={marked ?? chainArticleId}
			gap={chainGap}
			{hiddenKinds}
			{hiddenRelations}
			amending={chainModel?.amending.length ?? 0}
			failure={chainFailure}
			onChoose={(k) => setUrl({ [MARK_PARAM]: k.id })}
		/>
	{:else if view === 'verband'}
		<SharedView
			{scale}
			ends={sharedEnds}
			model={sharedState}
			chosen={marked}
			gap={sharedGap}
			{hiddenKinds}
			{hiddenRelations}
			failure={sharedFailure}
			loading={sharedEnds.length > 1 && sharedData?.key !== sharedKey}
			onChoose={(r) => setUrl({ [MARK_PARAM]: r.id })}
		/>
	{/if}
{/snippet}

<div class="explore-shell">
	<div class="explore-content">
		{#if mode === 'index'}
			{#if params.get('kind') === null}
				<!-- The overview scrolls in its own field: the shell does not scroll. -->
				<div class="index-rol"><IndexOverzicht /></div>
			{:else if indexChunk.component}{@const IndexViewC = indexChunk.component}<IndexViewC
					category={indexKind}
				/>{:else if indexChunk.error}{@render chunkMissing(indexChunk, 'De lijst')}{:else}<p
					class="explore-empty stil"
					role="status"
				>
					Laden…
				</p>{/if}
		{:else if nietGevonden}
			<NietGevonden title="Bron niet gevonden" kop={false}>
				<p>{padNotHeld ?? focusNotHeld}</p>
				<p><a href="/bronnen#dekking">Bronnen en dekking</a></p>
			</NietGevonden>
		{:else if loadFailure && !selectedNode && !netwerkActive}
			{@render bronFout(loadFailure)}
		{:else if padNotHeld && !selectedNode && !netwerkActive}
			<p class="explore-empty stil">{padNotHeld}</p>
		{:else if mode === 'graph'}
			<!-- The werkplek: the canvas without a reader (besluit 39). Its heading for a screen
			     reader, as the title names it. -->
			<h1 class="blad__titel sr-only">Netwerk</h1>
			{#if voorbeeldAan}<ExampleLine name={voorbeeld!.naam} />{/if}
			<div class="werkplek" data-testid="werkplek">
				<div class="col col--graph">
					{#if graphChunk.component}
						{@const GraphViewC = graphChunk.component}
						<PanelBoundary what="Het netwerk" resetOn={focus}>
							<GraphViewC
								bind:this={graphView}
								{store}
								{filter}
								{verbonden}
								{depth}
								{reach}
								selectedEdgeId={card?.edgeId ?? null}
								{lineLids}
								inFluxMap={overlayCounts.inFlux}
								heatMap={overlayCounts.heat}
								{overlay}
								{marked}
								onMark={(id) => setUrl({ [MARK_PARAM]: id })}
								onNodeClick={lees}
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
								midden={view === 'omgeving' ? undefined : viewMiddle}
								surroundings={view === 'omgeving'}
								externCounts={view === 'keten'
									? chainCounts
									: view === 'verband'
										? sharedCounts
										: null}
								extern={view === 'keten' ? chainCard : view === 'verband' ? sharedCard : null}
								externStippen={view === 'keten'
									? chainDots
									: view === 'verband'
										? sharedDots
										: null}
							>
								{#snippet viewChoice()}
									<div class="view-choice">
										<h3 class="weergave__kop">Weergave</h3>
										<Keuze
											label="Weergave"
											waarde={view}
											opties={VIEWS.map((w) => ({
												waarde: w.waarde,
												label: w.label,
												...(w.waarde === 'keten' && !ketenKan && view !== 'keten'
													? { uit: true, titel: 'Alleen bij een wet, een regeling of een artikel' }
													: {})
											}))}
											onSelect={chooseView}
										/>
									</div>
								{/snippet}
								{#snippet links()}
									<!-- The way back to the bron the werkplek began with: read, a step of its own. -->
									{#if selectedNode && !selectedNode.id.startsWith('synth:')}
										<p class="terug">
											<a
												href={openHref(
													refOf(selectedNode.collection, selectedNode.key, selectedNode.raw?.props)
												)}>← {bronNaam(selectedNode, $instrumentMetaStore)}</a
											>
										</p>
									{/if}
								{/snippet}
								{#snippet balk()}
									<button type="button" class="btn raakvlak-knop" onclick={handleShareView}
										>{shareCopier.label('share', 'Deel')}</button
									>
								{/snippet}
								{#snippet meer()}
									<NetworkOptions
										around={selectedNode && !selectedNode.stub
											? bronNaam(selectedNode, $instrumentMetaStore)
											: null}
										aroundOn={!!aroundId}
										onAround={toggleAround}
										chosen={netwerk.ids.length}
										between={netwerk.tussen}
										betweenCount={composer.joiningCount}
										partial={composer.partial}
										onBetween={() => setNetwerk({ ...netwerk, tussen: !netwerk.tussen })}
									/>
								{/snippet}
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
										onVoorbeeld={showExample}
										selection={selectedNode &&
										selectedLinkId &&
										!netwerk.ids.includes(selectedLinkId)
											? { label: bronNaam(selectedNode, $instrumentMetaStore) }
											: null}
										onGroepAan={(kind) => {
											const uit = new Set(get(store.filters).hiddenGroups);
											uit.delete(kind);
											store.setFilters({ hiddenGroups: uit });
										}}
										onToggle={(id) => {
											if (aroundId) setUrl({ [AROUND]: null });
											setNetwerk(withToggled(netwerk, id));
										}}
										onRemove={(id) => {
											if (id === aroundId) setUrl({ [AROUND]: null });
											setNetwerk(withRemoved(netwerk, id));
										}}
										onAdd={() => selectedNode && addToNetwerk(selectedNode)}
										onClearContext={() => store.clearContext()}
										onClear={wisAlles}
									/>
								{/snippet}
							</GraphViewC>
						</PanelBoundary>
					{:else if graphChunk.error}
						{@render chunkMissing(graphChunk, 'Het netwerk')}
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
				{:else if connectionsTable.error}{@render chunkMissing(connectionsTable)}{:else}<p
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
			{@const withContents = hasContents}
			<div
				class="explore-read"
				class:explore-read--with-nav={withContents}
				class:is-resizing={!!widths.drag}
				style:--panel-w={widths.css('panel')}
			>
				<!-- Narrow, the text and Verbonden stand under each other in one scroll (V1-a-375);
				     only the contents open as a sheet. -->
				{#if withContents}
					<nav class="mobile-tabs" aria-label="Panelen">
						<button
							type="button"
							class="mobile-tab mobile-tab--toc"
							aria-haspopup="dialog"
							aria-expanded={tocOpen}
							onclick={() => (tocOpen = true)}>Inhoud</button
						>
					</nav>
				{/if}
				<!-- Kept in the page while it holds nothing, hidden: the table of contents tells again
				     when its rows come (contents-state). -->
				{#if WITH_CONTENTS.has(selectedNode.collection)}
					<div class="col col--nav toc-column" hidden={!withContents}>
						{@render toc()}
					</div>
				{/if}
				<div class="col col--reader col--measure">
					{@render reader()}
				</div>
				{@render handle('panel')}
				<div
					class="col col--panel"
					use:inView={() => (panelSeen = true)}
					use:sprongDoel={{
						id: 'verbonden',
						label: 'Naar Verbonden',
						naast: READ_BESIDE
					}}
				>
					{@render panel()}
				</div>
			</div>
			{#if withContents && tocOpen}
				<TocSheet onClose={() => (tocOpen = false)}>{@render toc()}</TocSheet>
			{/if}
		{:else if loadFailure}
			{@render bronFout(loadFailure)}
		{:else if focusNotHeld}
			<p class="explore-empty stil">{focusNotHeld}</p>
		{:else if focus || pad}
			<!-- The bron is on its way: its frame, not an empty page. -->
			{@render bronPending()}
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
		height: calc(100vh - var(--topbar-h) - var(--tabbar-h));
		height: calc(100dvh - var(--topbar-h) - var(--tabbar-h));
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

	/* The werkplek: the canvas over the full width, without a reader (besluit 39). */
	.werkplek {
		flex: 1;
		min-height: 0;
		display: flex;
		overflow: hidden;
	}
	.werkplek .col--graph {
		flex: 1;
	}
	.terug {
		margin: 0 0 var(--s-4);
	}
	/* Weergave, a block of the strip at the left (mockup A197-b). */
	.view-choice {
		padding: var(--s-4) 0;
		border-top: 1px solid var(--rule);
	}
	.weergave__kop {
		margin: 0 0 var(--s-3);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	@media (max-width: 768px) {
		.view-choice {
			padding: 0;
			border-top: 0;
		}
		.weergave__kop {
			display: none;
		}
		/* The three over the row's width, as the mockup's 390. */
		.view-choice :global(.keuze) {
			display: flex;
		}
		.view-choice :global(.keuze > *) {
			flex: 1;
			justify-content: center;
		}
	}
	@media (pointer: coarse), (max-width: 768px) {
		.view-choice :global(.keuze > *) {
			min-height: var(--veld-h-raak);
		}
	}
	@media (max-width: 768px) {
		.terug {
			margin: var(--s-1) 0;
		}
		.terug a {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
	.terug {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: 20px;
	}
	.terug a {
		color: var(--ink-2);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: var(--underline-offset-tight);
	}

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
	.explore-read {
		--nav-w-auto: 200px;
		--graph-w-auto: 360px;
		--panel-w-auto: clamp(340px, calc(100vw - 872px), 408px);
		--panel: var(--panel-w, var(--panel-w-auto));
	}
	/* Beside the reader's contents (200) Verbonden leaves the reader its room below 1280. */
	@media (max-width: 1279px) {
		.explore-read--with-nav {
			--panel-w-auto: clamp(340px, calc(100vw - 900px), 408px);
		}
	}
	@media (min-width: 1440px) {
		.explore-read {
			--graph-w-auto: 328px;
			--panel-w-auto: 432px;
		}
	}
	@media (min-width: 1600px) {
		.explore-read {
			--panel-w-auto: clamp(432px, calc(432px + (100vw - 1600px) / 10), 480px);
			--graph-w-auto: max(328px, calc(100vw - var(--panel) - 850px));
		}
	}
	/* Reading, Verbonden is 400 from 1280, as mockup V1: room for the text and its contents
	   beside it (A190, Thijs 23 Oct); below, the width above. */
	@media (min-width: 1280px) {
		.explore-read {
			--panel-w-auto: 400px;
		}
	}

	.explore-read {
		grid-template-columns: minmax(0, 1fr) 5px var(--panel);
	}
	/* A reader without contents (a kabinet, a lid, a fractie) and Verbonden stand together in
	   the middle of the screen: the room is the same at both outer edges, none kept for
	   contents (A190, UX-toets T9: 123 at the left, 32 at the right). The text column is the
	   measure with its margins. */
	@media (min-width: 1101px) {
		.explore-read:not(.explore-read--with-nav) {
			grid-template-columns:
				minmax(0, calc(790px + var(--s-6) + var(--s-8)))
				5px var(--panel);
			justify-content: center;
		}
		/* No numbers hang at its left: the step to the edge is Verbonden's at the right. */
		.explore-read:not(.explore-read--with-nav) .col--measure {
			--reader-pad-left: var(--s-6);
		}
	}

	.explore-read--with-nav {
		grid-template-columns: calc(var(--nav-w, var(--nav-w-auto)) + 5px) minmax(0, 1fr) 5px var(
				--panel
			);
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

	/* Reader is the page; the contents float at its left on the same paper, no column of
	   their own (A173). The panel (Verbonden) stays on paper with a rule (A154). */
	.col--panel {
		box-shadow: inset 1px 0 0 var(--rule);
	}
	/* In Tekst the column of Verbonden scrolls as a page column: no rule of its own, its rule is
	   Verbonden's, as long as its content (mockups V1: 32 px above, 32 px at the right). The
	   handle between them keeps its drag and shows its line only under the pointer. */
	.explore-read .col--panel {
		box-shadow: none;
		overflow-y: auto;
		padding: var(--s-6) var(--s-6) var(--s-8) 0;
	}
	.explore-read .panel {
		height: auto;
	}
	.explore-read .resize-handle--panel::before {
		background: transparent;
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

	/* A finger's target: 24 px on a desktop, 44 px below 768 (a phone, 200% zoom). */
	.reader__close {
		position: absolute;
		top: var(--s-1);
		right: var(--s-2);
		z-index: var(--z-raised);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: var(--tik-h);
		min-height: var(--tik-h);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: 1;
		color: var(--ink-3);
		text-decoration: none;
	}

	.reader__close:hover {
		color: var(--ink);
	}
	@media (max-width: 768px) {
		.reader__close {
			min-width: var(--veld-h-raak);
			min-height: var(--veld-h-raak);
			top: 0;
			right: 0;
		}
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
		/* 32 px above the text and 64 px to the rule of Verbonden, as the mockups V1. */
		--reader-pad-top: var(--s-6);
		--reader-pad-left: 64px;
		--reader-pad-right: var(--s-8);
		--reader-max: 790px;
	}
	/* Below 1440, 32 px to the rule of Verbonden: the text keeps some 575 px at 1280 beside the
	   contents (200) and Verbonden (400); from 1440 some 700 (A190, V1: 720). */
	@media (max-width: 1439px) {
		.col--measure {
			--reader-pad-right: var(--s-6);
		}
	}
	/* A reader without contents (a kabinet, a lid, a stemming) stands in the middle of its
	   column, as one with contents does between them and Verbonden: no room is kept empty at
	   its left for contents it has not (Thijs, 23 Oct, A190). */

	.explore-empty {
		margin: var(--s-6);
	}
	/* On a phone the page's own margin, as the reader's and the logo's (A53 #7). */
	@media (max-width: 768px) {
		.explore-empty {
			margin: var(--s-5) var(--s-4);
		}
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
	/* A finger's 44 px on a touch screen and below 768: the tabs' own height, between the bar and the text. */
	@media (pointer: coarse), (max-width: 768px) {
		.mobile-tabs {
			height: var(--veld-h-raak);
		}
	}
	.mobile-tabs .mobile-tab {
		flex: 1;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-3);
		background: none;
		border: 0;
		border-bottom: 2px solid transparent;
		padding: var(--s-2) var(--s-1) var(--s-2);
		cursor: pointer;
		margin-bottom: -1px;
	}

	.mobile-tab--toc {
		flex: none;
		margin-left: auto;
		color: var(--ink-2);
	}

	/* The nav column (LezenNav/DocumentToc/JudgmentToc) is a permanent column above
	   1100px; below it, Inhoud opens the same content as a sheet (TocSheet). The text and
	   Verbonden stand under each other in one scroll, Verbonden after the text (V1-a-375). */
	@media (max-width: 1100px) {
		.explore-read,
		.explore-read--with-nav {
			display: block;
			overflow-y: auto;
			-webkit-overflow-scrolling: touch;
		}
		.explore-read .mobile-tabs {
			display: flex;
		}
		.explore-read .col {
			height: auto;
			overflow: visible;
		}
		.explore-read .col--panel {
			background: none;
			box-shadow: none;
		}
		.explore-read :global(.reader),
		.explore-read :global(.reader__main),
		.explore-read :global(.reader-frame),
		.explore-read .panel,
		.explore-read :global(.verbonden),
		.explore-read :global(.verbonden .body) {
			height: auto;
			overflow: visible;
		}
		.explore-read .col--panel {
			border-top: 1px solid var(--rule);
			padding: var(--s-5) var(--s-4) var(--s-7);
		}
		/* Under the text, Verbonden comes once the text is there (ReaderFrame data-klaar): before
		   it, it stood where the text comes and was pushed down by it (CLS 0.81 at 375). */
		.explore-read:not(:has(.col--reader :global(.reader-frame[data-klaar]))) .col--panel {
			display: none;
		}
		.explore-read .toc-column,
		.explore-read .resize-handle {
			display: none;
		}
	}

	@media (max-width: 768px) {
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
		.resize-handle {
			display: none;
		}
	}
</style>

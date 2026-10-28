<script lang="ts">
	// The explorer: one bron at a time, in one of three modes. Lezen shows the bron with
	// its verbindingen alongside; Netwerk is a werkplek of its own, the canvas without a reader
	// (besluit 39); Bladeren lists bronnen. The URL holds the state (./explore-url.ts names
	// every param).
	//
	// A click on the canvas marks a bron (?marked) and opens its card; Lees on it reads the bron,
	// a step of its own: Back brings the werkplek back from its address.
	import { bronRol } from '$lib/nav/bron-rol';
	import { NOT_IN_DATA, noneHeld, notHeld } from '$lib/text/coverage';
	import { articleRef } from '$lib/text/bw';
	import { categoryLabel } from '$lib/components/explore/index/categories';
	import { onDestroy, untrack } from 'svelte';
	import { get } from 'svelte/store';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import type { Collection, Relation } from '$lib/vocabulary';
	import type { NeighborhoodAnswer } from '$lib/graph/store/types';
	import { sprongDoel } from '$lib/stores/sprong';
	import { inView } from '$lib/actions/in-view';
	import { PHONE, READ_BESIDE } from '$lib/util/breakpoints';
	import { yearFraction } from '$lib/text/datum';
	import { meldNetwerk, showNetworkFailure } from '$lib/stores/netwerk-melding';
	import {
		DEFAULT_FILTERS,
		NEIGHBORHOOD_CAP,
		type NeighborhoodReach
	} from '$lib/graph/store/types';
	import { lawArticles, lawNav, type LawNavItem } from '$lib/bron/law-articles';
	import { getArticleDetail } from '$lib/api/articles';
	import type { Step } from '$lib/bron/step.svelte';
	import { createCopier } from '$lib/components/ui/copy.svelte';
	import { pageName } from '$lib/bron/tab-title';
	import { titelVan } from '$lib/bron/titels.svelte';
	import { ignore, isAborted, isNotFound, report } from '$lib/api/errors';
	import { keptNetwerk, bewaarNetwerk, leesBewaard } from '$lib/selection/bewaard.svelte';
	import { offOf, offValue, sameSet } from '$lib/selection/off';
	import PanelBoundary from '$lib/components/ui/PanelBoundary.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import type { LoadFailure } from '$lib/util/load.svelte';
	import { Lazy } from '$lib/util/lazy.svelte';
	import { getNodeCanvas, getNodeHull } from '$lib/api/records';
	import { inPool } from '$lib/api/pool';
	import { kopNode } from '$lib/bron/first-node';
	import { NETWORK_MODE, bronHref, exploreMode, focusOf, openHref, refId } from '$lib/bron/href';
	import { refOf, type BronRef } from '$lib/bron/ref';
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
	import { allRows, filterGroups, lidCounts, memberCountsUnder } from '$lib/verbonden/view';
	import { perfStart } from '$lib/dev/perf';
	import type { GraphEdge, GraphNode, DrawClass } from '$lib/graph/types';
	import { lineKindOf, type LineKind } from '$lib/graph/line-kind';
	import { containerKindOf, type ContainerKind } from '$lib/graph/container-membership';
	import { AMENDING_RELATIONS, NODE_TYPES, parseNodeId } from '$lib/vocabulary';
	import {
		articleOf,
		drawClassOf,
		kort,
		lawIdOf,
		nodeToGraphNode,
		syntheticNode
	} from '$lib/graph/types';
	import { bronNaam, bronFullName } from '$lib/bron/naam';
	import { lookUp } from '$lib/bron/leesbaar';
	import {
		padOfFocus,
		parsePad,
		remember as rememberPad,
		exploreHref,
		exploreUrl
	} from '$lib/bron/address';
	import { ensureInstrumentName, instrumentMetaStore } from '$lib/api/instrument-cache';
	import { lawName } from '$lib/text/instrument-meta';
	import { keyEcli } from '$lib/text/ecli';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import type { Option } from '$lib/components/ui/option';
	import { chain, isRegulation, type ChainLayer, type ChainNode } from '$lib/network/chain';
	import { LINEAGE, lineage } from '$lib/network/lineage';
	import { chainTally } from '$lib/network/chain';
	import { verbandModel, type DirectLink } from '$lib/network/shared';
	import { pairOf, resolveChoice } from '$lib/network/pairs';
	import {
		chainsModel,
		MAX_ROWS,
		MAX_STEPS,
		type ChainsResponse,
		type ChainsState
	} from '$lib/network/linkchains';
	import { getLawBasis, getLawDelegatedSummary } from '$lib/api/articles';
	import { getChains, getNodeGraph, getShared, getSurroundings } from '$lib/api/nodes';
	import { SURROUNDED, surroundingRows } from '$lib/graph/surroundings';
	import { getEuLinks } from '$lib/api/verbonden';
	import { formatCount } from '$lib/text/getal';
	import { capitalize, joinAnd, textOf } from '$lib/text/words';
	import { focusStap } from '$lib/graph/focus-stap';
	import {
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
		lawOfPad,
		nameOfPad,
		netwerkQuery as netwerkQueryOf
	} from './explore-url';
	import { panelOfKey, verbondenInView, type Panel } from './panels';
	import { citedByName, pathByName } from '$lib/bron/law-name';
	import { followServerMove } from '$lib/bron/moved-law';
	import { NetwerkComposer } from './netwerk-compose.svelte';
	import { InFlux } from './in-flux.svelte';
	import { Proposals } from './proposals.svelte';
	import TocSheet from './TocSheet.svelte';
	import BronFailure from '$lib/components/explore/BronFailure.svelte';
	import { contentsTold, contentsEmpty } from '$lib/components/explore/contents-state.svelte';

	// One store for the lifetime of this page, so it survives mode switches.
	const store = createGraphStore();
	// The netwerk of chosen bronnen, put on the canvas (netwerk-compose.svelte.ts).
	const composer = new NetwerkComposer(store, () => graphView);

	let selectedNode = $state<GraphNode | null>(null);
	// The Topbalk marks a person by their current role, from the node as it is loaded.
	$effect(() => {
		bronRol.set(selectedNode?.collection === 'members' ? (selectedNode.raw?.props ?? null) : null);
		return () => bronRol.set(null);
	});
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
	/** The law of an article or a bijlage the data lacks, named and linked on the 404 (R3-I F19). */
	const padLaw = $derived(padOnbekend && pad ? lawOfPad(pad) : null);
	$effect(() => {
		if (padLaw) ensureInstrumentName(padLaw);
	});
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
	// A bron alone has no 0 steps: Alleen gekozen is a netwerk's.
	const depthFor = (drawClass: DrawClass) =>
		Math.max(1, depthOfClass(drawClass, { explicit: explicitDepth, all: alles }));
	// The bron the canvas is drawn around; a click selects another without moving it.
	let anchorClass = $state<DrawClass>('other');
	// ── The netwerk of chosen bronnen ─────────────────────────────────────────
	// Parsed from its own three params only, so selecting a bron does not compose again.
	//
	// The address is the state: a link with ?mode=netwerk draws the same in every browser. The
	// netwerk kept in this browser (bewaard) is what the reader last chose; it is offered only
	// where the address names no bron at all (the button Netwerk on a page without one), never
	// laid over a bron that is named.
	leesBewaard();
	const netwerkQuery = $derived(netwerkQueryOf(params));
	const telefoon = typeof window !== 'undefined' && window.matchMedia(PHONE).matches;
	// Nothing chosen, the canvas is empty: the field Bron toevoegen is all (Thijs, 23 Oct).
	const netwerk = $derived<Netwerk>(parseNetwerk(new URLSearchParams(netwerkQuery)));
	const netwerkActive = $derived(netwerk.ids.length > 0);

	// What Aantal stappen shows: with a netwerk the steps of its bronnen (the most any asks), else
	// the bron the canvas is drawn around.
	const depth = $derived(
		netwerkActive && explicitDepth !== null
			? explicitDepth
			: netwerkActive
				? Math.max(
						1,
						...composer.entries
							.filter((e) => e.on && e.node)
							.map((e) => depthOfClass(e.node!.drawClass, { explicit: null, all: false }))
					)
				: depthFor(anchorClass)
	);
	/**
	 * How far the netwerk reached, for Aantal stappen: the steps beyond the first and whether the
	 * API cut one of them off; at one step, whether a bron's own neighbours came in part (not
	 * known at Alleen gekozen: no step is greyed out before one is asked).
	 */
	const netwerkReach = $derived<NeighborhoodReach>(
		composer.reach
			? { focal: '', ...composer.reach, buckets: composer.cut }
			: {
					focal: '',
					depth: 1,
					capped: composer.cut.length > 0 && !composer.extending && explicitDepth !== 0,
					cap: NEIGHBORHOOD_CAP,
					buckets: composer.cut
				}
	);
	/** Outside the werkplek, the netwerk kept in this browser: a bron read is added to it. */
	const bewaard = $derived(parseNetwerk(new URLSearchParams(keptNetwerk() ?? '')));
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
	/** Verband compares bronnen: it is offered from two chosen ones, the page's bron counting. */
	const verbandPossible = $derived(
		composer.entries.filter((e) => e.on).length +
			(selectedNode &&
			!selectedNode.id.startsWith('synth:') &&
			!composer.entries.some((e) => e.on && e.node?.id === selectedNode?.id)
				? 1
				: 0) >=
			2
	);
	const chooseView = (w: ViewId) =>
		setUrl({ [VIEW_PARAM]: w === 'omgeving' ? null : w, [MARK_PARAM]: null });

	/**
	 * Where the keten starts: the bron of the page, else the first chosen bron of the netwerk
	 * that is a law or an article (R3-N B3: /explore?netwerk=instruments/… said "alleen bij een
	 * wet" for a law).
	 */
	/** A bron with a keten: a law or an article, or one of the kinds of lineage.ts. */
	const withChain = (n: GraphNode | null | undefined) =>
		!!n &&
		(n.collection === 'instruments' || n.collection === 'articles' || !!LINEAGE[n.collection]);
	/** Another chosen bron the keten was opened from ("Ook gekozen"), by its canvas id. */
	let chainFrom = $state<string | null>(null);
	/** The bronnen chosen besides the page's: in the keten marked, else named beside it. */
	const chainChosen = $derived(
		[selectedNode, ...composer.entries.filter((e) => e.on).map((e) => e.node)].filter(
			(n): n is GraphNode => !!n && !n.id.startsWith('synth:')
		)
	);
	const chainStart = $derived.by(() => {
		if (mode !== 'graph' || view !== 'keten') return null;
		const from = chainChosen.find((n) => n.id === chainFrom && withChain(n));
		if (from) return from;
		if (withChain(selectedNode)) return selectedNode;
		return composer.entries.find((e) => e.on && withChain(e.node))?.node ?? null;
	});
	/**
	 * Whether Keten means something here: a law, a regulation or an article, a judgment, a
	 * fractie or a Kamerlid as the bron or among the chosen ones; elsewhere it is not offered
	 * (R3-K F9, R3-I F1, besluit 41).
	 */
	const chainPossible = $derived(
		mode === 'graph' &&
			[selectedNode, ...composer.entries.filter((e) => e.on).map((e) => e.node)].some(withChain)
	);
	/** A judgment, a fractie or a Kamerlid: its keten is its lineage (lineage.ts). */
	const lineageStart = $derived(
		chainStart && LINEAGE[chainStart.collection] && !chainStart.id.startsWith('synth:')
			? chainStart
			: null
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
	/**
	 * The keten with the regulations no longer in force (drawn faint), or without; and with the
	 * regulations that only name the law, or only those issued under it (the default: a
	 * Grondwet's 171 crossed each other, Thijs 23 Oct). Relatie's Noemt is that switch.
	 */
	/** The search for a bron to add, open (the panel's and the empty canvas's button). */
	let toevoegenOpen = $state(false);
	let chainExpired = $state(false);
	let chainMentions = $state(false);
	let chainBasedOff = $state(false);
	/** The kinds of line a lineage keten (a judgment's appeals, a fractie's continuations) switched off. */
	let lineageOff = $state.raw<ReadonlySet<LineKind>>(new Set());
	const chainHidden = $derived<ReadonlySet<LineKind>>(
		lineageStart
			? lineageOff
			: new Set<LineKind>([
					...(chainMentions ? [] : (['citation'] as const)),
					...(chainBasedOff ? (['structural'] as const) : [])
				])
	);
	let chainData = $state.raw<{
		bwb: string;
		validity: 'in_force' | 'all';
		delegated: Awaited<ReturnType<typeof getLawDelegatedSummary>>;
		basis: Awaited<ReturnType<typeof getLawBasis>> | null;
		eu: Awaited<ReturnType<typeof getEuLinks>> | null;
	} | null>(null);
	let chainError = $state.raw<{ bwb: string; error: unknown } | null>(null);
	let chainTries = $state(0);
	const chainFailure = $derived(
		chainError && (chainError.bwb === chainLaw || chainError.bwb === lineageStart?.id)
			? { what: 'De keten', error: chainError.error, retry: () => chainTries++ }
			: null
	);
	$effect(() => {
		const bwb = chainLaw;
		const validity = chainExpired ? 'all' : 'in_force';
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
		Promise.all([getLawDelegatedSummary(bwb, validity), basis, eu])
			.then(([delegated, basis, eu]) => {
				if (current) chainData = { bwb, validity, delegated, basis, eu };
			})
			.catch((e) => {
				report('Keten', e);
				if (current) chainError = { bwb, error: e };
			});
		return () => {
			current = false;
		};
	});
	/** Up to `max` bronnen a layer drawn, and `keep`; the rest listed under Alle N. */
	function capLayers(layers: ChainLayer[], max: number, keep: string | null) {
		const rest: Record<string, number> = {};
		const more: Record<string, ChainNode[]> = {};
		const drawn = layers.map((l) => {
			const kept = l.nodes.filter((n, i) => i < max || n.id === keep);
			const over = l.nodes.filter((n) => !kept.includes(n));
			if (over.length) {
				rest[l.id] = over.length;
				more[l.id] = over;
			}
			return { ...l, nodes: kept };
		});
		return { layers: drawn, rest, more };
	}
	/** The keten of a judgment, a fractie or a Kamerlid (lineage.ts), by the start's id. */
	let lineageData = $state.raw<{ id: string; layers: ChainLayer[] } | null>(null);
	$effect(() => {
		const n = lineageStart;
		void chainTries;
		if (!n) return;
		const relations = LINEAGE[n.collection]!;
		const ask = (id: string) => {
			const t = parseNodeId(id);
			return t
				? getNodeGraph(t.collection, t.key, { limit: 20, relations: relations.join(',') }).catch(
						(e) => (report('Keten', e), null)
					)
				: Promise.resolve(null);
		};
		let current = true;
		chainError = null;
		ask(n.id)
			.then((start) => (start ? lineage(start, relations, ask) : []))
			.then((layers) => {
				if (current) lineageData = { id: n.id, layers };
			})
			.catch((e) => {
				report('Keten', e);
				if (current) chainError = { bwb: n.id, error: e };
			});
		return () => {
			current = false;
		};
	});
	/** The keten is on its way: the drawing says so, and Soort counts nothing yet (R3-K F6). */
	const chainLoading = $derived(
		(!!lineageStart && lineageData?.id !== lineageStart.id && !chainError) ||
			(!!chainLaw &&
				(chainData?.bwb !== chainLaw ||
					chainData.validity !== (chainExpired ? 'all' : 'in_force')) &&
				!chainFailure)
	);
	// An article's law by its name, not its id, on the keten's head.
	$effect(() => {
		if (chainArticle) ensureInstrumentName(chainLaw);
	});
	/** The keten with or without its mentions: drawn, and counted for Relatie. */
	const chainOf = (mentions: boolean) => {
		const bwb = chainLaw;
		if (!bwb || chainData?.bwb !== bwb) return null;
		const id = `instruments/${bwb.toLowerCase()}`;
		const start = chainStart;
		// A publication by its name (Stb. 2018, 101), never its key (R3-K F11).
		const name =
			start?.collection === 'instruments'
				? (lawName($instrumentMetaStore.get(bwb), null) ?? bronNaam(start, $instrumentMetaStore))
				: lawName($instrumentMetaStore.get(bwb), bwb);
		const eu = chainData.eu;
		return chain({ id, name }, chainData.delegated, chainData.basis, {
			max: 4,
			keep: marked,
			kind: chainKind,
			article: chainArticle,
			mentions,
			eu: eu
				? {
						implements: eu.implements.map((l) => l.instrument),
						implementedBy: eu.implemented_by.map((l) => l.instrument)
					}
				: null
		});
	};
	const chainModel = $derived(
		lineageStart
			? lineageData?.id === lineageStart.id
				? {
						...capLayers(lineageData.layers, 6, marked),
						total: lineageData.layers.reduce((n, l) => n + l.nodes.length, 0) - 1,
						amending: [],
						missing: []
					}
				: null
			: chainOf(chainMentions)
	);
	const chainAll = $derived(chainMentions || lineageStart ? chainModel : chainOf(true));
	/** The article the keten starts from, as the drawing names it: marked until another is. */
	const chainArticleId = $derived(
		chainArticle ? (chainModel?.layers.find((l) => l.id === 'article')?.nodes[0]?.id ?? null) : null
	);
	const chainGap = $derived.by(() => {
		if (view !== 'keten' || chainLoading) return null;
		if (lineageStart) {
			if (!chainModel || chainModel.total > 0) return null;
			return capitalize(
				noneHeld(
					lineageStart.collection === 'judgments'
						? 'andere aanleg'
						: lineageStart.collection === 'factions'
							? 'voorganger of opvolger'
							: 'fractie, kabinet of commissie'
				)
			);
		}
		if (!chainLaw) return null;
		const m = chainModel;
		if (!m) return null;
		if (m.missing.length) return `${joinAnd(m.missing)}: grondslag ${NOT_IN_DATA}`;
		// A regulation whose grondslag the data lacks says so, as the law above it does (F3).
		const withoutBasis = isRegulation(chainKind) && !m.layers.some((l) => l.id === 'basis');
		const none =
			m.total === 0 && !m.layers.some((l) => l.id === 'implementation')
				? noneHeld(
						chainArticle
							? `uitvoeringsregelingen onder ${articleRef(null, chainArticle)}`
							: 'uitvoeringsregelingen'
					)
				: null;
		const gaps = [withoutBasis ? `grondslag ${NOT_IN_DATA}` : null, none].filter(Boolean);
		return gaps.length ? capitalize(gaps.join(', ')) : null;
	});
	/** A node of the keten as the card reads a bron. */
	function chainNodeOf(k: ChainNode): GraphNode {
		const collection = k.collection;
		const key = k.id.slice(k.id.indexOf('/') + 1);
		const i = k.instrument;
		return {
			id: k.id,
			collection,
			key,
			drawClass: drawClassOf(collection),
			label: k.name,
			raw: {
				id: k.id,
				key,
				collection,
				type: NODE_TYPES[collection],
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

	/**
	 * Verband's ends: the bron of the page (one bron added makes two, R3-I F2) and every chosen
	 * bron that is on, each drawn whatever it shares; by name, so the order of the chips does not
	 * change the drawing (Thijs, 23 Oct).
	 */
	const sharedEnds = $derived.by(() => {
		if (mode !== 'graph' || view !== 'verband') return [];
		const ends = composer.entries
			.filter((e) => e.on && e.node)
			.map((e) => ({
				id: e.node!.id,
				name: bronFullName(e.node!, $instrumentMetaStore),
				short: bronNaam(e.node!, $instrumentMetaStore),
				props: e.node!.raw?.props ?? null,
				collection: e.collection
			}));
		if (
			selectedNode &&
			!selectedNode.id.startsWith('synth:') &&
			!ends.some((e) => e.id === selectedNode!.id)
		)
			ends.push({
				id: selectedNode.id,
				name: bronFullName(selectedNode, $instrumentMetaStore),
				short: bronNaam(selectedNode, $instrumentMetaStore),
				props: selectedNode.raw?.props ?? null,
				collection: selectedNode.collection
			});
		return ends.sort((x, y) => x.name.localeCompare(y.name, 'nl') || x.id.localeCompare(y.id));
	});
	/**
	 * The ends Verband draws: at most SHARED_ENDS, so it asks at most 15 pairs; more chosen
	 * bronnen are said, not drawn (19:50, 23 Oct: some 50 pairs at once emptied the API's pool).
	 */
	const SHARED_ENDS = 6;
	const sharedDrawn = $derived(sharedEnds.slice(0, SHARED_ENDS));
	const sharedKey = $derived(sharedDrawn.map((e) => e.id).join(','));
	/** What each pair shares, once a pair is in (/api/nodes/shared): asked again for none. */
	const pairKept = new Map<string, Awaited<ReturnType<typeof getShared>>>();
	let sharedData = $state.raw<{
		key: string;
		answers: NonNullable<Awaited<ReturnType<typeof getShared>>>[];
		direct: DirectLink[];
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
		const ids = key ? key.split(',') : [];
		if (ids.length < 2) return;
		let current = true;
		const ac = new AbortController();
		const pairs = ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b].sort().join(',')));
		// Two at a time, the pairs not yet in; a new choice cancels what is on its way.
		const asked = inPool(
			pairs,
			async (pair) => {
				if (!pairKept.has(pair))
					pairKept.set(pair, await getShared({ ids: pair, limit: MAX_ROWS }, ac.signal));
				return pairKept.get(pair) ?? null;
			},
			{ parallel: 2 }
		);
		const netwerkIds = composer.entries.filter((e) => e.on && e.node).map((e) => e.id);
		const page = untrack(() => selectedLinkId);
		if (page && !netwerkIds.includes(page)) netwerkIds.push(page);
		Promise.all([asked, composer.directLinks(netwerkIds)])
			.then(([answers, direct]) => {
				if (!current) return;
				const got = answers.filter((x): x is NonNullable<typeof x> => !!x);
				sharedData = { key, answers: got, direct, failure: got.length ? null : 'niet' };
			})
			.catch((e) => {
				if (!current || isAborted(e)) return;
				if (!isNotFound(e)) report('Verband', e);
				sharedData = {
					key,
					answers: [],
					direct: [],
					failure: isNotFound(e) ? 'niet' : 'mis',
					error: e
				};
			});
		return () => {
			current = false;
			ac.abort();
		};
	});
	const sharedState = $derived.by(() => {
		const here = sharedData?.key === sharedKey ? sharedData : null;
		if (!here || here.failure) return null;
		const byId = new Map(sharedEnds.map((e) => [e.id, e]));
		return verbandModel(here.answers, here.direct, (id) => ({
			name: byId.get(id)?.name ?? id,
			collection: byId.get(id)?.collection ?? null
		}));
	});
	/**
	 * Aantal stappen of Verband: 1 is what the bronnen share (/api/nodes/shared), 2 and 3 add the
	 * ketens through laws and articles between them (/api/chains). ?diepte, as Omgeving's; unset
	 * is 1. With three or more bronnen the Keuze (?paar) names the pair whose ketens are
	 * sought; Alle has none.
	 */
	const pairSteps = $derived(Math.max(1, Math.min(MAX_STEPS, explicitDepth ?? 1)));
	const PAIR_PARAM = 'paar';
	const pairChoice = $derived(resolveChoice(params.get(PAIR_PARAM), sharedDrawn, sharedState));
	const vcPair = $derived(sharedDrawn.length === 2 || sharedState ? pairOf(pairChoice) : null);
	const vcKey = $derived(vcPair && pairSteps >= 2 ? `${vcPair.join(',')}:${pairSteps}` : '');
	let vcData = $state.raw<
		{ key: string; response: ChainsResponse } | { key: string; error: unknown } | null
	>(null);
	let vcTries = $state(0);
	$effect(() => {
		const key = vcKey;
		void vcTries;
		if (!key) return;
		const [ids, steps] = key.split(':');
		let current = true;
		const ac = new AbortController();
		// Cold it takes 10 to 12 s (slowApi, 30 s); another choice breaks the question off.
		getChains({ ids, max_steps: Number(steps) }, ac.signal)
			.then((response) => current && (vcData = { key, response }))
			.catch((error) => {
				if (!current || isAborted(error)) return;
				report('Verband, ketens', error);
				vcData = { key, error };
			});
		return () => {
			current = false;
			ac.abort();
		};
	});
	const vcState = $derived.by((): ChainsState | null => {
		if (!vcKey || !vcPair) return null;
		const here = vcData?.key === vcKey ? vcData : null;
		if (!here) return { status: 'loading' };
		if ('error' in here) return { status: 'error', error: here.error, retry: () => vcTries++ };
		const byId = new Map(sharedEnds.map((e) => [e.id, e]));
		return {
			status: 'ready',
			model: chainsModel(
				here.response,
				vcPair,
				(id) => ({
					id,
					name: byId.get(id)?.name ?? id,
					collection: byId.get(id)?.collection ?? null
				}),
				pairSteps
			)
		};
	});
	/** An API without /api/nodes/shared: Verband says so, it does not guess from the canvas. */
	const sharedGap = $derived(
		sharedData?.key === sharedKey && sharedData.failure === 'niet'
			? 'gedeelde bronnen nog niet beschikbaar'
			: sharedEnds.length > SHARED_ENDS
				? `${formatCount(SHARED_ENDS)} van ${formatCount(sharedEnds.length)} gekozen bronnen`
				: null
	);
	// Soort and Relatie of a weergave of its own count what it draws, and its filter hides it.
	let hiddenLines = $state.raw<ReadonlySet<LineKind>>(new Set());
	store.filters.subscribe((f) => (hiddenLines = f.hiddenLines));
	const hiddenKinds = $derived<ReadonlySet<FilterGroup>>(
		new Set(FILTER_GROUPS.filter((k) => filter.bronnen && !filter.bronnen.has(k)))
	);
	// On its way, Soort counts nothing: not the canvas's numbers that the keten's replace (F6).
	const chainCounts = $derived(
		chainModel && chainAll ? chainTally(chainModel, chainAll) : { kinds: {}, lines: {} }
	);
	/** Verband without content (on its way, nothing shared): Soort holds no rows, not the canvas's. */
	const NO_COUNTS = { kinds: {}, lines: {} } satisfies Pick<CanvasCounts, 'kinds' | 'lines'>;
	const sharedCounts = $derived.by(() => {
		if (!sharedState) return null;
		const kinds: Partial<Record<FilterGroup, number>> = {};
		for (const r of sharedState.rows) {
			const k = filterGroupOf(r.collection, r.node.key, r.node.props);
			// The judgments are counted from their totals, below, not from the rows drawn.
			if (k && r.collection !== 'judgments') kinds[k] = (kinds[k] ?? 0) + 1;
		}
		const judgments = sharedState.judgments.reduce((n, j) => n + j.total, 0);
		if (judgments) kinds.uitspraken = (kinds.uitspraken ?? 0) + judgments;
		const lines: Partial<Record<LineKind, number>> = {};
		for (const r of sharedState.rows)
			for (const rel of new Set(r.relations.map((x) => lineKindOf(x, drawClassOf(r.collection)))))
				lines[rel] = (lines[rel] ?? 0) + 1;
		return { kinds, lines } satisfies Pick<CanvasCounts, 'kinds' | 'lines'>;
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
		if (r && node) return { node, ties: r.how };
		// A kenmerk or a tussenbron of a keten.
		const known = vcState?.status === 'ready' && marked ? vcState.model.known.get(marked) : null;
		const bronNode = known?.node ? nodeToGraphNode(known.node) : null;
		return bronNode ? { node: bronNode, ties: [] } : null;
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
		const panel = mode === 'read' && panelSeen ? 'verbonden' : readTab;
		const view = { phone: telefoon, table: tableMode, panel, canvasOnly: mode === 'graph' };
		if (node && !verbondenInView(node.collection, view)) return;
		source.load(node);
	});
	onDestroy(() => source.destroy());
	// A filter on the rows or the table needs every row, not the first few per group.
	$effect(() => {
		const f = filter;
		// An article's judgments are cut by the API itself (`askedOfApi`): its jaar and rechter
		// need no other rows.
		const vanApi = selectedNode?.collection === 'articles';
		const opRijen =
			f.lid ||
			(f.rechter && !vanApi) ||
			f.van ||
			f.tot ||
			f.geldendOp ||
			f.betrouwbaarheid ||
			f.status ||
			(f.jaar && !vanApi) ||
			f.zoek ||
			// An article's counts per lid under a bronfilter that splits what one of its
			// buckets holds (toelichtingen without wetsvoorstellen) are counted from its rows.
			(f.bronnen &&
				selectedNode?.collection === 'articles' &&
				!(verbonden.lidPerBak && memberCountsUnder(verbonden.lidPerBak, f.bronnen, f.stuksoort)));
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
			? memberCountsUnder(verbonden.lidPerBak, filter.bronnen, filter.stuksoort)
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
		allRows(verbonden.groups).filter((r) => r.stuksoort === 'wetsvoorstellen').length
	);
	// The first lading is the nodes' sample (5 of 21 on UHW 3): while the wijzigingen are on their
	// way the count says "meer dan", so it does not spring to another number on the same page.
	const billMore = $derived(
		!!verbonden.wachtend?.includes('changes') ||
			verbonden.groups.some(
				(g) => g.capped && g.rows.some((r) => r.stuksoort === 'wetsvoorstellen')
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
	/** Aan het netwerk toevoegen from the card Verbinding: the row's bron joins the netwerk. */
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
	const omgevingGrens = NEIGHBORHOOD_CAP;

	/** The requests around a focus, asked ahead of drawing them: `depth` is what they were asked for. */
	type Around = {
		depth: number;
		surroundings?: ReturnType<typeof getSurroundings>;
		neighborhood?: NeighborhoodAnswer;
		/** A dossier's stukken change wetten two steps away; the one step of a container leaves those out. */
		amending?: NeighborhoodAnswer;
	};
	const aroundOptions = (depth: number) => ({
		depth,
		cap: alles ? ALLES_GRENS : omgevingGrens
	});
	const amendingOptions = {
		depth: 2,
		cap: omgevingGrens,
		relations: ['PART_OF', ...AMENDING_RELATIONS] as Relation[],
		nodeTypes: ['document', 'instrument', 'dossier']
	};
	/**
	 * Asks what a focus draws around itself, all at once: the neighbourhood and a dossier's
	 * amendments do not hang on each other, and a stuk's surroundings come from the one route.
	 */
	function askAround(collection: Collection, key: string, drawClass: DrawClass): Around {
		const depth = depthFor(drawClass);
		if (SURROUNDED.has(collection) && explicitDepth === null && !alles)
			return {
				depth,
				surroundings: getSurroundings(collection, key).catch((e) => {
					report('Verkenner omgeving', e);
					return null;
				})
			};
		return {
			depth,
			neighborhood: store.askNeighborhood(collection, key, aroundOptions(depth)),
			amending:
				collection === 'dossiers'
					? store.askNeighborhood(collection, key, amendingOptions)
					: undefined
		};
	}

	async function expandAround(node: GraphNode, epoch: number, ahead?: Around | null) {
		if (node.id.startsWith('synth:')) return;
		// A stuk, a zaak, a stemming, a toezegging, an activiteit: its own neighbours, the dossier
		// one bron, not the dossier's members around it (R3-N B13, API 0.80.8 surroundings). An
		// explicit depth, or Alle laden, still draws the neighbourhood.
		const depth = depthFor(node.drawClass);
		const around =
			ahead?.depth === depth ? ahead : askAround(node.collection, node.key, node.drawClass);
		if (around.surroundings) {
			const rows = await around.surroundings;
			if (epoch !== focusEpoch) return;
			if (rows && store.showRows(node.id, surroundingRows(rows))) {
				store.sweepOrphans();
				return;
			}
		}
		const options = aroundOptions(depth);
		await store.expandNeighborhood(node.collection, node.key, {
			...options,
			asked: around.neighborhood ?? store.askNeighborhood(node.collection, node.key, options)
		});
		if (epoch !== focusEpoch) return;
		if (node.collection === 'dossiers') {
			await store.expandNeighborhood(node.collection, node.key, {
				...amendingOptions,
				asked: around.amending ?? store.askNeighborhood(node.collection, node.key, amendingOptions)
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
			// Its surroundings go out with them, as far as they are known without the node: the
			// canvas waits for the neighbourhood, not for the light node and the full one first.
			const ahead = inGraph
				? askAround(target.collection, target.key, drawClassOf(target.collection))
				: null;
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
			if (inGraph) await deepen(node, replace, ahead);
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
	async function deepen(node: GraphNode, force = false, ahead?: Around | null) {
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
		await expandAround(node, epoch, ahead);
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
		const n = netwerk;
		const omgeving = view === 'omgeving';
		// Aantal stappen 0 is Alleen gekozen: no surroundings. Read here, so a change of ?diepte
		// composes again.
		const steps = explicitDepth;
		if (mode !== 'graph') return;
		untrack(() => {
			composer.surroundings = omgeving && steps !== 0;
			composer.steps = steps;
			if (n.ids.length > 0) composer.compose(n);
			else if (composer.composed) {
				composer.release();
				if (focus) drawFocusAgain(focus);
			}
		});
	});

	/**
	 * The last bron of a netwerk taken out while a page's own bron is the focus: the canvas goes
	 * back to what that page drew, not what the removed bron brought (its 200 uitspraken).
	 */
	function drawFocusAgain(id: string) {
		store.reset();
		deepenedId = '';
		loadedFocus = id;
		loadFocus(id).catch((e) => showFocusError(e, id));
	}

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
		// What the reader composes is kept for the next visit; a link's netwerk is not.
		bewaarNetwerk(
			n.ids.length > 0 ? new URLSearchParams(netwerkClean(netwerkParams(n))).toString() : null
		);
		// Clearing the netwerk or removing a bron is undone with Back.
		const shrinks = n.ids.length < netwerk.ids.length;
		const next = netwerkParams(n);
		setUrl(
			{
				...next,
				[OFF]: offValue({ ...filtersOff, chosen: offOf(next.uit ?? null).chosen })
			},
			{ push: shrinks }
		);
	}

	// What the legend switched off (a relation, a grouping) is in ?uit beside the chosen bronnen
	// that are off: a reload or a link draws the same canvas, also with one bron.
	const OFF = 'uit';
	const filtersOff = $derived(offOf(params.get(OFF)));
	$effect(() => {
		const { lines, annexes, groups } = filtersOff;
		untrack(() => {
			const now = get(store.filters);
			if (
				sameSet(lines, now.hiddenLines) &&
				annexes === now.hiddenAnnexes &&
				sameSet(groups, now.hiddenGroups)
			)
				return;
			store.setFilters({
				hiddenLines: new Set(lines),
				hiddenAnnexes: annexes,
				hiddenGroups: new Set(groups)
			});
		});
	});
	let filtersStart = true;
	store.filters.subscribe((f) => {
		// The first call is the store as it begins: the address has not been read into it yet.
		if (filtersStart) {
			filtersStart = false;
			return;
		}
		const off = untrack(() => filtersOff);
		if (
			sameSet(off.lines, f.hiddenLines) &&
			off.annexes === f.hiddenAnnexes &&
			sameSet(off.groups, f.hiddenGroups)
		)
			return;
		untrack(() =>
			setUrl({
				[OFF]: offValue({
					...off,
					lines: [...f.hiddenLines],
					annexes: f.hiddenAnnexes,
					groups: [...f.hiddenGroups]
				})
			})
		);
	});

	$effect(() => {
		// A readable address names its bron, also while it is looked up (a Kamerstuk, an
		// article): the remembered netwerk does not take its place.
		if (focus || pad || netwerkQuery || mode === 'index') return;
		const saved = keptNetwerk();
		if (!saved) return;
		// An old address with ?tussen is read without it.
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
		if (!netwerk.ids.includes(id)) return addToNetwerk(node);
		setNetwerk(withRemoved(netwerk, id));
		meldNetwerk(`${kort(bronNaam(node, $instrumentMetaStore))} weggehaald uit het netwerk.`, () =>
			setNetwerk(withAdded(netwerk, id))
		);
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
	// so a plain "2" click does not remove the param. In Omgeving it reaches the chosen bronnen
	// (the page's bron when none is chosen); in Verband it is the pair's.
	const setDepth = (d: number) => setUrl({ diepte: String(d) });

	const tableHref = $derived(withParams(page.url, { tabel: '1', mode: null, naast: null }));
	// "Alle 10.406" of a kind the canvas cut off: those bronnen as a list, the table under that
	// kind (?soort), not as many nodes (Thijs, 28 Oct); the canvas keeps its cap. The werkplek
	// stays in the address, bronfilter and all: Terug leads back to it as it was.
	const lijstHref = (bronnen: readonly FilterGroup[]) =>
		withParams(page.url, { tabel: '1', soort: bronnen.join(',') || null, naast: null });
	const tabelSoort = $derived(
		(params.get('soort') ?? '')
			.split(',')
			.filter((k): k is FilterGroup => (FILTER_GROUPS as readonly string[]).includes(k))
	);
	/** The table's bronfilter: of the kinds of ?soort only, where the list came from Tonen. */
	const tableFilter = $derived<VerbondenFilter>(
		tabelSoort.length
			? { ...filter, bronnen: new Set(tabelSoort.filter((k) => filter.bronnen?.has(k) ?? true)) }
			: filter
	);
	const readHref = $derived(withParams(page.url, { tabel: null, soort: null }));

	const inFlux = new InFlux(() => mode === 'graph');
	// Voorstellen: the lopende voorstellen of the bronnen on the canvas beside them (besluit 37).
	const PROPOSALS = 'voorstellen';
	const proposalsOn = $derived(params.get(PROPOSALS) === 'ja');
	const proposals = new Proposals(
		store,
		() => proposalsOn,
		() => inFlux.counts,
		() => mode === 'graph' && view === 'omgeving'
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
	// The werkplek's own parts, and its weergaven: chunks of their own, asked with the canvas.
	const panelChunk = new Lazy(
		() => import('$lib/selection/NetwerkPanel.svelte'),
		'Verkenner onderdeel'
	);
	const chainView = new Lazy(() => import('$lib/network/ChainView.svelte'), 'Verkenner onderdeel');
	const sharedView = new Lazy(
		() => import('$lib/network/SharedView.svelte'),
		'Verkenner onderdeel'
	);
	const indexOverview = new Lazy(
		() => import('$lib/components/explore/index/IndexOverzicht.svelte'),
		'Verkenner onderdeel'
	);
	// Reading needs none of them: the canvas comes with the Netwerk, and while the page is idle
	// ahead of that, so the switch finds it in.
	$effect(() => {
		if (mode === 'graph') {
			graphChunk.load();
			panelChunk.load();
			if (view === 'keten') chainView.load();
			else if (view === 'verband') sharedView.load();
			return;
		}
		const ask = () => {
			graphChunk.load();
			panelChunk.load();
		};
		if (typeof requestIdleCallback !== 'function') return void setTimeout(ask, 3000);
		const idle = requestIdleCallback(ask, { timeout: 5000 });
		return () => cancelIdleCallback(idle);
	});
	$effect(() => {
		if (mode === 'index') {
			indexChunk.load();
			indexOverview.load();
		}
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

	// ── Share ────────────────────────────────────────────────────────────────
	const shareCopier = createCopier();
	const handleShareView = () => shareCopier.copy(page.url.toString(), 'share');

	/** On a phone the tab of the read view: the text or Verbonden (A197-a, R3-L F4). */
	let readTab = $state<Panel>('tekst');
	const READ_CHOICE: Option<Panel>[] = [
		{ waarde: 'tekst', label: 'Tekst' },
		{ waarde: 'verbonden', label: 'Verbonden' }
	];
	$effect(() => {
		void selectedNode?.id;
		// A link that names the bronnen (?bronnen=, the start page's) comes for Verbonden (R3-I).
		// So does the network asked in the address (?toon=netwerk): it is drawn in Verbonden.
		readTab = untrack(
			() => page.url.searchParams.get('bronnen') || page.url.searchParams.get('toon') === 'netwerk'
		)
			? 'verbonden'
			: 'tekst';
	});
	// The hint of a phone's tab of before (?paneel) is dropped from the address: the werkplek
	// has no tabs, the text and Verbonden stand under each other.
	$effect(() => {
		if (page.url.searchParams.get('paneel') === null) return;
		untrack(() => setUrl({ paneel: null }));
	});
	/** The canvas is on the screen: the werkplek. */
	// Keten and Verband draw what they ask themselves: the neighbourhood of Omgeving waits until
	// Omgeving is shown (laad lui).
	const canvasZichtbaar = $derived(mode === 'graph' && view === 'omgeving');
	// Below --nav-w's own breakpoint, Lezen's table of contents opens as a sheet
	// instead of taking a permanent column.
	let tocOpen = $state(false);
	/** The button Inhoud: where the focus goes back to when its sheet closes (a click does not always focus it). */
	let inhoudKnop = $state<HTMLButtonElement | null>(null);
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

	/** What the light node says of the contents before a table of contents has told (R3-L F1):
	 *  a publication has none, a law of one article none. Null: the node does not say. */
	const contentsFromNode = $derived.by(() => {
		if (selectedNode?.collection !== 'instruments') return null;
		const p = selectedNode.raw?.props ?? {};
		if (p.publication_kind) return false;
		return p.article_count === 1 ? false : null;
	});
	/** Whether the bron on screen has contents to go by: a text with one entry or none has no
	 *  column, no tab Inhoud and no button (the tables of contents tell, contents-state). */
	const hasContents = $derived(
		!!selectedNode &&
			WITH_CONTENTS.has(selectedNode.collection) &&
			contentsEmpty.id !== selectedNode.id &&
			contentsFromNode !== false
	);
	// A stuk's contents come with its text, its head a moment before: the column of the text
	// is not shown until they have told, so it does not jump to the left when there are none
	// (R3-L F1). At most two seconds.
	let contentsWaited = $state<string | null>(null);
	$effect(() => {
		const id = selectedNode?.id ?? null;
		const t = setTimeout(() => {
			contentsWaited = id;
		}, 2000);
		return () => clearTimeout(t);
	});
	const contentsPending = $derived(
		selectedNode?.collection === 'documents' &&
			contentsTold.id !== selectedNode.id &&
			contentsWaited !== selectedNode.id
	);

	// ── Resizable columns ────────────────────────────────────────────────────

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
		// 1 and 2: the layers of a bron, Tekst and Verbonden; 2 puts the focus on Verbonden's
		// first row, for J and K.
		const panel = panelOfKey(e.key);
		if (panel && selectedNode && mode === 'read') {
			e.preventDefault();
			readTab = panel;
			if (panel === 'verbonden')
				requestAnimationFrame(() =>
					document.querySelector<HTMLElement>('.verbonden a.row__title')?.focus()
				);
			return;
		}
		if (e.key.toLowerCase() !== 'l' || !readAction) return;
		e.preventDefault();
		setReading(readAction === 'read');
	}

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
						<div class="reader__close">
							<IconButton
								label="Sluiten"
								onclick={() => goto(closeBesideHref, { noScroll: true, keepFocus: true })}
								>×</IconButton
							>
						</div>
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

{#snippet viewMiddle(scale: number)}
	{#if view === 'keten'}
		{#if chainView.component}{@const ChainViewC = chainView.component}<ChainViewC
				{scale}
				layers={chainModel?.layers ?? []}
				rest={chainModel?.rest}
				more={chainModel?.more}
				loading={chainLoading}
				chosen={marked ?? chainArticleId}
				gap={chainGap}
				{hiddenKinds}
				hiddenLines={chainHidden}
				amending={chainModel?.amending.length ?? 0}
				expired={chainData?.delegated?.expired_total
					? {
							total: chainData.delegated.expired_total,
							shown: chainExpired,
							onToggle: () => (chainExpired = !chainExpired)
						}
					: null}
				failure={chainFailure}
				start={chainStart?.id ?? null}
				period={{ van: filter.van, tot: filter.tot }}
				others={chainChosen
					.filter((n) => n.id !== chainStart?.id)
					.map((n) => ({
						id: n.id,
						name: bronNaam(n, $instrumentMetaStore),
						collection: n.collection,
						onOpen: withChain(n) ? () => (chainFrom = n.id) : null
					}))}
				onChoose={(k) => setUrl({ [MARK_PARAM]: k.id })}
			/>{:else if chainView.error}{@render chunkMissing(chainView, 'De keten')}{:else}<LoadState
				state={{ status: 'loading' }}
				what="De keten"
			/>{/if}
	{:else if view === 'verband'}
		{#if sharedView.component}{@const SharedViewC = sharedView.component}<SharedViewC
				{scale}
				ends={sharedDrawn}
				model={sharedState}
				choice={pairChoice}
				onChoice={(c) => setUrl({ [PAIR_PARAM]: c, [MARK_PARAM]: null })}
				chosen={marked}
				gap={sharedGap}
				{hiddenKinds}
				{hiddenLines}
				failure={sharedFailure}
				loading={sharedEnds.length > 1 && sharedData?.key !== sharedKey}
				steps={pairSteps}
				chains={vcState}
				onChoose={(id) => setUrl({ [MARK_PARAM]: id })}
				onSteps={setDepth}
			/>{:else if sharedView.error}{@render chunkMissing(
				sharedView,
				'Het verband'
			)}{:else}<LoadState state={{ status: 'loading' }} what="Het verband" />{/if}
	{/if}
{/snippet}

<div class="explore-shell">
	<div class="explore-content">
		{#if mode === 'index'}
			{#if params.get('kind') === null}
				<!-- The overview scrolls in its own field: the shell does not scroll. -->
				<div class="index-rol">
					{#if indexOverview.component}{@const OverviewC = indexOverview.component}<OverviewC
						/>{:else if indexOverview.error}{@render chunkMissing(
							indexOverview,
							'Het overzicht'
						)}{:else}<LoadState state={{ status: 'loading' }} what="Het overzicht" />{/if}
				</div>
			{:else if indexChunk.component}{@const IndexViewC = indexChunk.component}<IndexViewC
					category={indexKind}
				/>{:else if indexChunk.error}{@render chunkMissing(indexChunk, 'De lijst')}{:else}<div
					class="explore-empty"
				>
					<LoadState state={{ status: 'loading' }} what="De lijst" />
				</div>{/if}
		{:else if nietGevonden}
			<NietGevonden title="Bron niet gevonden" kop={false}>
				<p>{padNotHeld ? `${notHeld(nameOfPad(pad!, lawNameOf))}.` : focusNotHeld}</p>
				<!-- An article the data lacks: the way to its law, by its name (R3-I F19). -->
				{#if padLaw}<p>
						<a href={bronHref({ collection: 'instruments', key: padLaw })}
							>{lawNameOf(padLaw) ?? padLaw}</a
						>
					</p>{/if}
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
			<div class="werkplek" data-testid="werkplek">
				<div class="col col--graph">
					<!-- The canvas stands with its panel: Weergave, Gekozen and Tonen do not come in after it. -->
					{#if graphChunk.component && panelChunk.component}
						{@const GraphViewC = graphChunk.component}
						<PanelBoundary what="Het netwerk" resetOn={focus}>
							<GraphViewC
								bind:this={graphView}
								{store}
								{filter}
								{verbonden}
								{depth}
								{pairSteps}
								reach={netwerkActive ? netwerkReach : reach}
								counting={netwerkActive && (composer.loading || composer.extending)}
								expecting={netwerkActive ? netwerk.ids.length : 0}
								selectedEdgeId={card?.edgeId ?? null}
								{lineLids}
								inFluxMap={inFlux.counts}
								{marked}
								onMark={(id) => setUrl({ [MARK_PARAM]: id })}
								onNodeClick={lees}
								onMetGroep={(m) => (metGroep = m)}
								onToggleChosen={toggleChosen}
								onAdd={addIdToNetwerk}
								{netwerkActive}
								onEdgeClick={openEdgeCard}
								onClear={() => (card = null)}
								onFilter={applyFilter}
								onDepth={setDepth}
								lijstHref={netwerkActive ? undefined : lijstHref}
								{view}
								onToevoegen={() => (toevoegenOpen = true)}
								midden={view === 'omgeving' ? undefined : viewMiddle}
								middenZoom={view !== 'keten'}
								surroundings={view === 'omgeving'}
								externCounts={view === 'keten'
									? chainCounts
									: view === 'verband'
										? (sharedCounts ?? NO_COUNTS)
										: null}
								extern={view === 'keten' ? chainCard : view === 'verband' ? sharedCard : null}
								externLines={view === 'keten'
									? {
											hidden: chainHidden,
											toggle: (l) => {
												if (lineageStart) {
													const next = new Set(lineageOff);
													if (!next.delete(l)) next.add(l);
													lineageOff = next;
												} else if (l === 'citation') chainMentions = !chainMentions;
												else if (l === 'structural') chainBasedOff = !chainBasedOff;
											}
										}
									: null}
								proposals={view === 'omgeving'
									? {
											on: proposalsOn,
											count: proposals.available,
											onToggle: () => setUrl({ [PROPOSALS]: proposalsOn ? null : 'ja' })
										}
									: undefined}
								externStippen={view === 'keten'
									? chainDots
									: view === 'verband'
										? sharedDots
										: null}
							>
								{#snippet viewChoice()}
									<!-- Nothing chosen, nothing to view three ways: the field Bron toevoegen alone. -->
									{#if focus || pad || netwerkActive}
										<Keuze
											label="Weergave"
											vol
											waarde={view}
											opties={VIEWS.filter(
												(w) =>
													w.waarde === 'omgeving' ||
													w.waarde === view ||
													(w.waarde === 'keten' ? chainPossible : verbandPossible)
											).map((w) => ({ waarde: w.waarde, label: w.label }))}
											onSelect={chooseView}
										/>
									{/if}
								{/snippet}

								{#snippet balk()}
									<button type="button" class="btn raakvlak-knop" onclick={handleShareView}
										>{shareCopier.label('share', 'Deel')}</button
									>
								{/snippet}
								{#snippet canvasOverlay()}
									{#if panelChunk.component}{@const PanelC = panelChunk.component}<PanelC
											bind:searching={toevoegenOpen}
											entries={netwerkActive
												? composer.entries.map((e) =>
														e.node
															? { ...chipNaam(e, e.node), verborgenMet: metGroep.get(e.node.id) }
															: e
													)
												: []}
											loading={composer.loading}
											expected={netwerkActive ? netwerk.ids.length : 0}
											{telefoon}
											onSelect={addIdToNetwerk}
											selection={selectedNode &&
											selectedLinkId &&
											reach &&
											selectedNode.id !== reach.focal &&
											!netwerk.ids.includes(selectedLinkId)
												? { label: bronNaam(selectedNode, $instrumentMetaStore) }
												: null}
											onGroepAan={(kind) => {
												const uit = new Set(get(store.filters).hiddenGroups);
												uit.delete(kind);
												store.setFilters({ hiddenGroups: uit });
											}}
											onToggle={(id) => {
												setNetwerk(withToggled(netwerk, id));
											}}
											onRemove={(id) => {
												setNetwerk(withRemoved(netwerk, id));
											}}
											onAdd={() => selectedNode && addToNetwerk(selectedNode)}
											onClear={wisAlles}
										/>{/if}
								{/snippet}
							</GraphViewC>
						</PanelBoundary>
					{:else if graphChunk.error || panelChunk.error}
						{@render chunkMissing(graphChunk.error ? graphChunk : panelChunk, 'Het netwerk')}
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
						filter={tableFilter}
						onOpenFilter={() => (filterOpen = true)}
						onRow={openRowCard}
						backHref={readHref}
						backLabel={params.get('mode') === NETWORK_MODE
							? 'Terug naar het netwerk'
							: 'Terug naar de tekst'}
					/>
				{:else if connectionsTable.error}{@render chunkMissing(connectionsTable)}{:else}<div
						class="explore-empty"
					>
						<LoadState state={{ status: 'loading' }} what="De tabel" />
					</div>{/if}
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
			<div class="explore-read" class:explore-read--with-nav={withContents}>
				<!-- On a phone the text and Verbonden are two tabs, Verbonden one tap away (A197-a, UX
				     R3-L F4); on a tablet they stand beside each other. The contents open as a sheet. -->
				<nav class="mobile-tabs" class:mobile-tabs--tabs={!withContents} aria-label="Panelen">
					<div class="lees-tabs">
						<Keuze
							vol
							label="Tekst of Verbonden"
							opties={READ_CHOICE}
							waarde={readTab}
							onSelect={(w) => (readTab = w)}
						/>
					</div>
					{#if withContents}
						<button
							type="button"
							class="btn mobile-tab--toc"
							bind:this={inhoudKnop}
							aria-haspopup="dialog"
							aria-expanded={tocOpen}
							onclick={() => (tocOpen = true)}>Inhoud</button
						>
					{/if}
				</nav>
				<!-- Kept in the page while it holds nothing, hidden: the table of contents tells again
				     when its rows come (contents-state). -->
				{#if WITH_CONTENTS.has(selectedNode.collection)}
					<div class="col col--nav toc-column" hidden={!withContents}>
						{@render toc()}
					</div>
				{/if}
				<div
					class="col col--reader col--measure"
					class:mobile-hidden={readTab === 'verbonden'}
					data-wacht={contentsPending || undefined}
				>
					{@render reader()}
				</div>
				<div
					class="col col--panel"
					class:mobile-hidden={readTab === 'tekst'}
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
				<TocSheet onClose={() => (tocOpen = false)} opener={() => inhoudKnop}
					>{@render toc()}</TocSheet
				>
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
		height: calc(100vh - var(--balk-h) - var(--tabbar-h));
		height: calc(100dvh - var(--balk-h) - var(--tabbar-h));
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

	/* Verbonden is as wide with every reader (an article, a stuk, a lid): 400 from 1280, as
	   mockup V1, with room for the text and its contents beside it (A190, Thijs 23 Oct);
	   below, it grows with the screen from 340 to 408. The reader cannot drag it. */
	.explore-read {
		--nav-w-auto: 200px;
		--panel: clamp(340px, calc(100vw - 872px), 408px);
	}
	@media (min-width: 1280px) {
		.explore-read {
			--panel: 400px;
		}
	}

	.explore-read {
		grid-template-columns: minmax(0, 1fr) var(--panel);
	}
	/* A reader without contents (a kabinet, a lid, a fractie) and Verbonden stand together in
	   the middle of the screen: the room is the same at both outer edges, none kept for
	   contents (A190, UX-toets T9: 123 at the left, 32 at the right). The text column is the
	   measure with its margins. */
	@media (min-width: 1101px) {
		.explore-read:not(.explore-read--with-nav) {
			grid-template-columns:
				minmax(0, calc(790px + var(--s-6) + var(--s-8)))
				var(--panel);
			justify-content: center;
		}
		/* No numbers hang at its left: the step to the edge is Verbonden's at the right. */
		.explore-read:not(.explore-read--with-nav) .col--measure {
			--reader-pad-left: var(--s-6);
		}
	}

	.explore-read--with-nav {
		grid-template-columns: calc(var(--nav-w, var(--nav-w-auto)) + 5px) minmax(0, 1fr) var(--panel);
	}
	/* The reading view with its contents keeps margins at both sides from 1280 (A208d, Thijs
	   23 Oct: "meer ruimte aan de zijkanten"): 24, 32 from 1440, and on a wide screen the whole
	   at most 1680 wide in the middle, so the contents, the text and Verbonden keep their
	   distances and the room beyond goes to both edges alike. The contents' rows and
	   Verbonden's last column step in by one step (12), so both edges read the same. */
	@media (min-width: 1280px) {
		.explore-read--with-nav {
			padding-inline: max(var(--s-5), calc((100vw - 1680px) / 2));
		}
	}
	@media (min-width: 1440px) {
		.explore-read--with-nav {
			padding-inline: max(var(--s-6), calc((100vw - 1680px) / 2));
		}
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

	/* The close of the toelichting opened beside the text: an IconButton in the corner. */
	.reader__close {
		position: absolute;
		top: var(--s-1);
		right: var(--s-2);
		z-index: var(--z-raised);
	}
	@media (max-width: 768px) {
		.reader__close {
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

	/* The tabs of a phone and of the narrow read view: shown by the media rules below. */
	/* A height in whole pixels: the tabs' own grew 32 → 32.5 px when the UI font came, and
	   moved the text under them half a pixel (FE2, 10 Oct: 0 px after the first paint). */
	.mobile-tabs {
		display: none;
		align-items: center;
		gap: var(--s-2);
		box-sizing: border-box;
		height: var(--veld-h);
		border-bottom: 1px solid var(--rule);
		background: var(--paper-2);
	}
	/* A phone: Tekst and Verbonden are a Keuze, a finger high, with a margin around it. */
	@media (max-width: 768px) {
		.mobile-tabs {
			height: auto;
			padding: var(--s-2) var(--s-3);
		}
	}
	/* Inhoud beside it is a Knop. */
	.mobile-tab--toc {
		flex: none;
		margin-left: auto;
	}

	/* The nav column (LezenNav/DocumentToc/JudgmentToc) is a permanent column above
	   1100px; below it, Inhoud opens the same content as a sheet (TocSheet). The text and
	   Verbonden stand under each other in one scroll, Verbonden after the text (V1-a-375). */
	/* Below 1101 no column of contents: Inhoud opens as a sheet (TocSheet). On a tablet the text
	   and Verbonden stand beside each other, each in its own scroll (A197-a); on a phone they
	   are two tabs (below). */
	@media (max-width: 1100px) {
		.explore-read,
		.explore-read--with-nav {
			grid-template-columns: minmax(0, 1fr) var(--panel);
			grid-template-rows: auto minmax(0, 1fr);
		}
		.explore-read .mobile-tabs {
			display: flex;
			grid-column: 1 / -1;
			grid-row: 1;
		}
		.explore-read .col {
			grid-row: 2;
		}
		.explore-read .toc-column {
			display: none;
		}
	}
	/* The tabs Tekst and Verbonden are the phone's; a tablet has both beside each other, and a
	   bar only for Inhoud. */
	@media (min-width: 769px) {
		.lees-tabs,
		.explore-read .mobile-tabs--tabs {
			display: none;
		}
	}
	/* The text waits, unseen, until its contents have told (contentsPending, R3-L F1). */
	.col--reader[data-wacht] {
		visibility: hidden;
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
		.col,
		.explore-read .col {
			grid-row: 2;
			grid-column: 1;
		}
		.lees-tabs {
			display: flex;
			flex: 1;
		}
		/* The tab not chosen. */
		.explore-read .mobile-hidden {
			display: none;
		}
		/* Verbonden as a tab of its own: the page's margins, its own scroll. */
		.explore-read .col--panel {
			padding: var(--s-5) var(--s-4) var(--s-7);
		}
	}
</style>

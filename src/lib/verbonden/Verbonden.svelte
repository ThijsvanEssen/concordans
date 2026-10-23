<script lang="ts">
	// The panel Verbonden: the verbindingen of the selected bron, in the groups of the table in
	// groups.ts, under the bronfilter.
	import { ecliKey } from '$lib/bron/address';
	import { capitalize, joinAnd, plural } from '$lib/text/words';
	import { report } from '$lib/api/errors';
	import { rijen } from '$lib/actions/rijen';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { page } from '$app/state';
	import { tick, untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { refId } from '$lib/bron/href';
	import type { GraphNode } from '$lib/graph/types';
	import {
		filterGroupCount,
		emptyLine,
		EMPTY_FILTER,
		FILTER_GROUP_NOUN,
		withFilterGroup,
		askedOfApi,
		filterParams,
		type VerbondenFilter
	} from './filter';
	import { formatCount, isAtLeast } from '$lib/text/getal';
	import { countLabel, groupCount, type Group } from './groups';
	import { csvName, download, exportLabel, exportRows, rowsToCsv } from './export';
	import { caseNumberOf, repeatedTitles, rowKey, type Row } from './rows';
	import { LOAD_FAILED, type VerbondenState } from './data-source';
	import PendingRows, { pendingKind } from './PendingRows.svelte';
	import PendingGroup from './PendingGroup.svelte';
	import GroupHead from './GroupHead.svelte';
	import TierBar from './TierBar.svelte';
	import JudgmentOrderLine from './JudgmentOrderLine.svelte';
	import VerbondenRow from './VerbondenRow.svelte';
	import { VERBONDEN_BUCKET } from '$lib/api/records';
	import { groupRequest } from './open-group';
	import Picto from '$lib/components/ui/Picto.svelte';
	import NetworkSketch from './NetworkSketch.svelte';
	import SchetsKaart from './SchetsKaart.svelte';
	import KindSummary from './KindSummary.svelte';
	import { kindsOf, kindsTotal, kindOfGroup } from './summary';
	import { PHONE_SKETCH_LIMIT, sketch as drawSketch, type SketchGroup } from './sketch';
	import { citingTiers, lawTiers, type TierCount } from './tiers';
	import { importanceOf, byImportance } from './importance';
	import type { LoaderOptions } from './loaders';
	import { isInhoudGroep, isKernGroep, lazeKernIds } from '$lib/bron/behoort';
	import {
		PREVIEW_ROWS,
		countLine,
		filterGroups,
		hiddenLine,
		shownLabel,
		totalCount,
		vasteGroepen,
		yearHistogram
	} from './view';

	let {
		verbonden,
		selection,
		filter,
		onFilter,
		onOpenFilter,
		onAddToNetwerk,
		inNetwerk,
		onProposedText,
		tableHref,
		onRetry,
		onReloadGroup,
		onMeer,
		onAlles,
		showNetwork,
		onShowNetwork,
		networkHref,
		networkName
	}: {
		verbonden: VerbondenState;
		selection: GraphNode;
		filter: VerbondenFilter;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		/** Één bron uit de rij in het netwerk zetten. */
		onAddToNetwerk?: (row: Row) => void;
		/** Of de bron van een rij al in het netwerk staat. */
		inNetwerk?: (row: Row) => boolean;
		/** A wetsvoorstel row: show the proposed wording next to the current text. */
		onProposedText?: (row: Row) => void;
		tableHref: string;
		/** Loads the verbindingen again after a failed load; without it no Opnieuw is offered. */
		onRetry?: () => void;
		/** Another order or year for a group: its loader asks again, the rest stays. */
		onReloadGroup?: (groupId: string, options: Partial<LoaderOptions>) => void;
		/** A group is opened: its rows beyond the first few are asked now. */
		onMeer?: (groupId: string) => void | Promise<void>;
		/** Every row, before a copy or an export. */
		onAlles?: () => Promise<void>;
		/** In Tekst: whether the network is drawn above the groups (Netwerk tonen, besluit 32). */
		showNetwork?: boolean;
		/** Netwerk tonen or verbergen; without it the panel has no such button (on the canvas). */
		onShowNetwork?: (on: boolean) => void;
		/** The werkplek with this bron: Open in netwerk, under the drawing. */
		networkHref?: string;
		/** The name of the bron in the middle of the network, its citeertitel. */
		networkName?: string;
	} = $props();

	/** "Toelichtingen en wijzigingen", the first word with a capital. */
	const zin = (woorden: string[]) => capitalize(joinAnd(woorden));

	let expanded = $state(new Set<string>());

	// "Bekijk in Verbonden" on a cluster bron: the group with most bronnen of its kind,
	// opened and in view.
	let root = $state<HTMLElement | null>(null);
	$effect(() =>
		groupRequest.subscribe((r) => {
			if (!r) return;
			const count = (g: (typeof shown)[number]) =>
				g.rows.filter((row) => row.ref.collection === r.collection).length;
			const best = [...shown].sort((a, b) => count(b) - count(a))[0];
			groupRequest.set(null);
			if (!best || count(best) === 0) return;
			showGroup(best.id);
		})
	);

	// A link that names the bronnen (?bronnen=, the start page's) comes for Verbonden: where the
	// text and Verbonden stand under each other, once its groups are in, it is in view (R3-I F5).
	// The text above it arrives after the groups and moves it; it is brought back until the
	// reader scrolls for themselves.
	let announced = false;
	$effect(() => {
		if (announced || !onShowNetwork || !root || groepen.length === 0) return;
		announced = true;
		if (!page.url.searchParams.get('bronnen') || !matchMedia('(max-width: 768px)').matches) return;
		const toVerbonden = () => root?.scrollIntoView({ block: 'start' });
		let ownScroll = false;
		const ownScrolled = () => (ownScroll = true);
		for (const e of ['touchstart', 'wheel', 'keydown'] as const)
			addEventListener(e, ownScrolled, { once: true, passive: true });
		const until = Date.now() + 3000;
		const ticker = setInterval(() => {
			if (ownScroll || Date.now() > until) return clearInterval(ticker);
			toVerbonden();
		}, 250);
		afterTick(toVerbonden);
	});

	/** A group opened and in view: from the network, or "Bekijk in Verbonden". */
	function showGroup(id: string) {
		const g = groepen.find((x) => x.id === id);
		const kind = g ? kindOfGroup(g) : null;
		if (onShowNetwork && kind) openKind(kind);
		expanded = new Set([...expanded, id]);
		// Once its rows are drawn: a smooth scroll is cut off while they render.
		afterTick(() =>
			root?.querySelector(`[data-group="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' })
		);
	}

	// The year of the bronfilter, for a wet asked of the API itself (BE-51), and the year and
	// the rechter for an article: its judgments of that year and court are loaded, not
	// filtered out of the first page.
	$effect(() => {
		const asked = askedOfApi(filter, selection.collection);
		const now = untrack(() => verbonden.options);
		if (asked.year === now.year && asked.court === now.court && asked.area === now.area) return;
		onReloadGroup?.('judgments', asked);
	});

	// A new bron starts closed; the same bron with more rows (a group opened) stays as it is.
	const bronId = $derived(verbonden.id);
	$effect(() => {
		void bronId;
		expanded = new Set();
	});

	// The kern of the bron (Procesgang, Ingediend bij, Wet, Fractie) stands above its text in
	// the band; Verbonden is the context and leaves those groups out (Thijs, 9 Oct: "dubbelop";
	// docs/hierarchie.md, Kern of context). The table keeps all, and the count is the table's:
	// one number for the head, the link and the table (UX-toets 10 Oct, #15: "0 verbindingen"
	// over "Alle 79 in een tabel" on a fractie).
	// A bron in the kern is not listed again by another relation either: the Rechtbank of a
	// procesgang is no "uitspraak die hier wordt aangehaald" (Thijs, 9 Oct). The instances
	// before the eerdere aanleg come with the band's own cached light nodes.
	let keten = $state<Set<string>>(new Set());
	$effect(() => {
		const { collection, key, id } = selection;
		keten = new Set();
		// Without the kern Verbonden shows its groups whole.
		lazeKernIds(collection, key, (selection.raw?.props ?? {}) as Record<string, unknown>).then(
			(ids) => {
				if (selection.id === id) keten = new Set(ids);
			},
			(e) => report('Verbonden kern', e)
		);
	});
	/** The judgment a translation renders (`translation_of`, an ECLI), as an id. */
	const vertalingVan = (r: Row) => {
		const ecli = r.props?.translation_of;
		return typeof ecli === 'string' && ecli.trim() ? `judgments/${ecliKey(ecli)}` : null;
	};
	const kernIds = $derived(
		new Set([
			...verbonden.groups
				.filter((g) => isKernGroep(selection.collection, g))
				.flatMap((g) => g.rows.map((r) => refId(r.ref))),
			...keten
		])
	);
	const groepen = $derived(
		verbonden.groups
			.filter(
				(g) => !isKernGroep(selection.collection, g) && !isInhoudGroep(selection.collection, g)
			)
			.map((g) => {
				const own = g.rows.filter(
					(r) => !kernIds.has(refId(r.ref)) && !kernIds.has(vertalingVan(r) ?? '')
				);
				const weg = g.rows.length - own.length;
				// The most important first where the API does not rank them (importance.ts).
				const rank = g.orders ? null : importanceOf(selection.collection, g.id);
				const rows = rank ? byImportance(own, rank) : own;
				return weg || rank ? { ...g, rows, total: g.total != null ? g.total - weg : g.total } : g;
			})
	);
	const alleenKern = $derived(
		groepen.every((g) => g.rows.length === 0 && !g.failed) &&
			verbonden.groups.some(
				(g) =>
					g.rows.length > 0 &&
					(isKernGroep(selection.collection, g) || isInhoudGroep(selection.collection, g))
			)
	);
	// A group whose loader is under way keeps its place with "laden…" (VerbondenState.wachtend).
	const filtered = $derived(filterGroups(groepen, filter, new Set(verbonden.wachtend ?? [])));
	// A group whose loader the light node cannot foretell (no counted buckets: Toelichting,
	// Wijzigingen) stands below the counted ones, always, so it never comes in above what stands
	// (UX-toets 0.79.43, #1). One order per page; a group under a heading of its own keeps it.
	const onvoorspelbaar = (g: Group) => !!g.load && !g.bakken && !g.section;
	const voorzien = (g: Group) => !g.laden || verbonden.verwacht?.[g.id] != null;
	const shown = $derived.by(() => {
		const r = filtered.filter(voorzien);
		return [...r.filter((g) => !onvoorspelbaar(g)), ...r.filter(onvoorspelbaar)];
	});
	// A group still loading whose rows the node cannot foretell takes no place: it may come
	// empty, and its place going would move what stands below it (UX-toets 0.79.47, #1: the
	// skeleton of Wijzigingen 92 px up when Toelichting came empty). One line under the
	// groups says what is still coming; a group that comes with rows takes its place above it.
	const nogOnderweg = $derived(
		filtered.filter((g) => !voorzien(g)).map((g) => g.noun ?? g.label.toLowerCase())
	);
	const hidden = $derived(hiddenLine(groepen, filter));
	// What the table lists: the bronfilter applied, as its own count line does.
	// One count, written once it holds (#56): a group still loading counts what the node
	// foretells for it; while one cannot be foretold, the head waits.
	const vast = $derived(
		vasteGroepen(verbonden.groups, verbonden.wachtend ?? [], verbonden.verwacht ?? {})
	);
	const wachtSet = $derived(new Set(verbonden.wachtend ?? []));
	// A bron with no verbinding at all, every group in: one line says so, and nothing offers to
	// count, group, filter, tabulate or export what is not there (A53).
	const empty = $derived(
		!!verbonden.id &&
			!verbonden.loading &&
			!verbonden.failed &&
			wachtSet.size === 0 &&
			verbonden.groups.every((g) => !g.failed && !g.laden) &&
			vast != null &&
			totalCount(vast) === 0
	);
	const total = $derived(shownLabel(vast ?? verbonden.groups, filter, wachtSet));

	/** The one count of every verbinding, unfiltered: the API's, the sum of the buckets of the light
	 *  node, once it is larger than what the groups hold so far. The head and the link to the table
	 *  say it alike (T8: 4.700 over Alle 4.701). Null where a filter or a cut-off group says otherwise. */
	const alleVerbindingen = $derived.by(() => {
		// The drawn network counts what is drawn (its legend), so its heading does too.
		if (showNetwork || !vast || !verbonden.buckets || filtering || isAtLeast(total)) return null;
		const api = [...verbonden.buckets.values()].reduce((sum, n) => sum + n, 0);
		return Math.max(api, totalCount(vast));
	});

	// ── At a glance: per soort its count and the three to read (summary.ts) ──
	// In Tekst Verbonden opens on the soorten; "Alle N" opens one with its groups, its order and
	// its filters; a bronfilter in the address (a lid's count, Filter) shows the groups at once.
	const kinds = $derived(
		kindsOf(
			groepen,
			selection.collection,
			verbonden.buckets,
			verbonden.groups.filter(
				(g) => isKernGroep(selection.collection, g) || isInhoudGroep(selection.collection, g)
			)
		)
	);
	/** The soorten opened in place with all their rows, from "Alle N" or a circle of the
	 *  network: one view of Verbonden, no second one per soort (A208e). */
	let openKinds = $state(new Set<string>());
	$effect(() => {
		void selection.id;
		openKinds = new Set();
	});
	const filtering = $derived(Object.values(filterParams(filter)).some((v) => v !== null));
	const overview = $derived(!!onShowNetwork && !filtering);
	/** A soort opened in place with its rows, from "Alle N" or a circle of the network; again
	 *  "Alle N" (Minder) closes it. */
	function openKind(id: string, toggle = false) {
		if (toggle && openKinds.has(id)) {
			openKinds = new Set([...openKinds].filter((k) => k !== id));
			return;
		}
		openKinds = new Set([...openKinds, id]);
		// "Alle N" opens the soort with its rows at once, not its first rows and a second "Alle N"
		// (R3-L F5): its groups open, the rest of their rows asked.
		const groups = groepen.filter((g) => kindOfGroup(g) === id);
		expanded = new Set([...expanded, ...groups.map((g) => g.id)]);
		for (const g of groups)
			if ((g.total ?? 0) > g.rows.length) onMeer?.(g.id)?.catch((e) => report('Verbonden meer', e));
		afterTick(() =>
			root?.querySelector(`[data-kind="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'start' })
		);
	}

	// The judgments that cite an article per instantie, counted by the API over all of them:
	// the bar of the group and its circles in the network. Asked once the group's total is in.
	const citingJudgments = $derived(
		selection.collection === 'articles' || selection.collection === 'instruments'
			? groepen.find((g) => g.id === 'judgments' && !g.laden && (g.total ?? 0) > 0)
			: undefined
	);
	// Over the soort as its heading counts it: what the three instanties leave is Overige.
	const citingTotal = $derived(
		citingJudgments ? (kinds.find((k) => k.id === 'judgments')?.count ?? 0) : 0
	);
	let tierCounts = $state<{ id: string; parts: TierCount[] } | null>(null);
	$effect(() => {
		const all = citingTotal;
		const { id } = selection;
		const props = selection.raw?.props ?? {};
		const bwb = typeof props.bwb_id === 'string' ? props.bwb_id : null;
		const number = typeof props.article_number === 'string' ? props.article_number : null;
		const isLaw = selection.collection === 'instruments';
		if (!all || (isLaw ? !bwb : !bwb || !number)) return;
		const ac = new AbortController();
		(isLaw ? lawTiers(bwb!, all, ac.signal) : citingTiers(bwb!, number!, all, ac.signal)).then(
			(parts) => {
				if (!ac.signal.aborted) tierCounts = { id, parts };
			},
			(e) => {
				if (ac.signal.aborted) return;
				report('Verbonden tierCounts', e);
				// No bar: its held room goes (KindSummary tiersPending).
				tierCounts = { id, parts: [] };
			}
		);
		return () => ac.abort();
	});
	const parts = $derived(tierCounts?.id === selection.id ? tierCounts.parts : null);
	/** The bar per instantie is asked and not in: its room is held (UX-toets T9b, A202). */
	const tiersPending = $derived.by(() => {
		const props = selection.raw?.props ?? {};
		const bwb = typeof props.bwb_id === 'string';
		const number = typeof props.article_number === 'string';
		const isLaw = selection.collection === 'instruments';
		return !!citingTotal && (isLaw ? bwb : bwb && number) && !parts;
	});

	// The network on request: the soorten as the summary shows them, each with its count, so
	// the legend's total and the heading's are one sum.
	const sketchGroups = $derived<SketchGroup[]>(
		showNetwork
			? kinds.map((k) => ({
					id: k.id,
					name: k.label,
					collection: k.collection,
					hue: k.id === 'regelingen' ? k.id : null,
					count: k.count,
					rows: k.rows,
					capped: k.partial,
					parts: k.id === 'judgments' ? parts : null
				}))
			: []
	);
	const centerName = $derived(networkName ?? selection.label ?? '');
	// On a phone fewer bronnen stand on their own: past a dozen a soort is one circle with its
	// count, so no names lie over each other in the narrow drawing (A208e).
	const phone = typeof matchMedia === 'function' && matchMedia('(max-width: 768px)').matches;
	const sketched = $derived(
		showNetwork
			? drawSketch(sketchGroups, centerName, phone ? PHONE_SKETCH_LIMIT : undefined)
			: null
	);
	/** The bron on its own opened under the drawing. */
	let schetsId = $state<string | null>(null);
	$effect(() => {
		void selection.id;
		schetsId = null;
	});
	const schetsOpen = $derived(sketched?.singles.find((l) => l.id === schetsId) ?? null);

	function toggle(set: Set<string>, id: string) {
		const next = new Set(set);
		if (!next.delete(id)) next.add(id);
		return next;
	}

	/** The row opened in place: one at a time. */
	let openRij = $state<string | null>(null);
	const wisselRij = (row: Row) => (openRij = openRij === rowKey(row) ? null : rowKey(row));

	// The years of all the group's judgments where the API counts them (a wet, BE-47; an
	// article, #895), where there are enough to choose among or one is chosen (a small
	// remainder keeps its way back); else of the rows loaded, which the sentence then says.
	const years = (g: Group) =>
		g.rows[0]?.filterGroup !== 'uitspraken'
			? []
			: g.years?.length
				? g.years.reduce((n, y) => n + y.count, 0) > VERBONDEN_BUCKET ||
					filter.jaar ||
					filter.rechter
					? g.years
					: []
				: g.rows.length > VERBONDEN_BUCKET
					? yearHistogram(g.rows)
					: [];

	// An export holds every row: those not loaded yet are asked first. The same rows as the
	// table's Exporteer, the kern included. Verzamel gave way to Bundels: a row's box keeps
	// it in the map (src/lib/map).
	async function exportCsv() {
		await onAlles?.();
		await tick();
		download(
			csvName(selection.label, selection.key),
			rowsToCsv(exportRows(verbonden.groups, filter), selection.collection, page.url.origin)
		);
	}
</script>

<!-- A soort of judgments opened in place keeps its order and its year and court (A208e). -->
{#snippet kindTools(kind: string)}
	{@const g = kind === 'judgments' ? groepen.find((x) => kindOfGroup(x) === 'judgments') : null}
	{#if g && (g.orders || years(g).length > 0)}
		<JudgmentOrderLine
			orders={g.orders}
			order={verbonden.options.order}
			onOrder={(order) => onReloadGroup?.(g.id, { order })}
			years={years(g)}
			courts={g.courts}
			{filter}
			{onFilter}
		/>
	{/if}
{/snippet}

<aside
	class="verbonden"
	class:verbonden--tekst={!!onShowNetwork}
	aria-label="Verbonden"
	bind:this={root}
>
	<div class="head">
		<h2 class="head__title">Verbonden</h2>
		{#if onShowNetwork && !empty}
			<button
				type="button"
				class="btn head__netwerk"
				aria-pressed={!!showNetwork}
				onclick={() => onShowNetwork(!showNetwork)}
				><Picto naam="netwerk-o" size={13} />{showNetwork
					? 'Netwerk verbergen'
					: 'Netwerk tonen'}</button
			>
		{/if}
		<!-- A bron without verbindingen has no count: its one line says so below (A53), not a
		     sentence of explanation (R7, UX-toets 0.79.43). -->
		<!-- Its line stands from the start, empty until the count is in: the groups under it do
		     not move when it comes (UX-toets T9, A190). -->
		{#if !empty}
			<span class="head__count"
				>{!(
					verbonden.groups.length > 0 ||
					(!verbonden.loading && !verbonden.failed && verbonden.id)
				)
					? ''
					: overview && kinds.length && !verbonden.loading
						? // The sum of the soorten shown under it, so the head and the soorten agree (R3-L
							// F7); a group that waits on its rows says its own count.
							`${formatCount(kindsTotal(kinds))} ${plural(kindsTotal(kinds), 'verbinding', 'verbindingen')}`
						: alleVerbindingen != null
							? `${formatCount(alleVerbindingen)} ${plural(alleVerbindingen, 'verbinding', 'verbindingen')}`
							: vast && (!overview || kinds.length)
								? countLine(vast, filter, wachtSet)
								: overview && kinds.length
									? `${formatCount(kindsTotal(kinds))} ${plural(kindsTotal(kinds), 'verbinding', 'verbindingen')}`
									: ''}</span
			>
		{/if}
	</div>
	<!-- The choose-line of the panel (docs/bediening.md): how grouped, the filter. No menu of
	     the bronnen: the groups below are the kinds chosen, and the presets and kinds are in
	     the filter (Thijs, 11 Oct). -->
	{#if !empty}<div class="regel">
			<button type="button" class="btn" onclick={onOpenFilter}>Filter</button>
		</div>{/if}

	<div class="body" use:rijen={'a.row__title'} aria-busy={verbonden.loading}>
		{#if sketched && (sketched.singles.length > 0 || sketched.clusters.length > 0)}
			<NetworkSketch
				sketch={sketched}
				name={centerName}
				open={schetsOpen?.id ?? null}
				onSingle={(id) => (schetsId = schetsId === id ? null : id)}
				onGroup={openKind}
			/>
			<!-- A bron on its own clicked in the drawing: its card, in place (besluit 39). -->
			{#if schetsOpen}
				<SchetsKaart row={schetsOpen.row} {selection} {onAddToNetwerk} {inNetwerk} />
			{/if}
			<!-- The werkplek with this bron: what the Netwerk button of the bar does from here. -->
			<p class="groot"><TekstLink href={networkHref ?? '/explore'}>Open in netwerk</TekstLink></p>
		{/if}
		<!-- The soorten once their set is in, each in its place in their order: before, the heads
		     to come as blank rows, so no soort comes in above another and pushes it (UX-toets
		     T9b). -->
		{#if overview && !verbonden.failed && kinds.length > 0 && !verbonden.loading}
			<KindSummary
				{kinds}
				{selection}
				tiers={parts}
				{tiersPending}
				open={openKinds}
				onOpen={(id) => openKind(id, true)}
				{kindTools}
				{onRetry}
				{onProposedText}
				{onAddToNetwerk}
				{inNetwerk}
			/>
		{:else if verbonden.failed}
			<div class="note">
				<LoadState state={LOAD_FAILED} what="De verbindingen" plural retry={onRetry} />
			</div>
		{:else if verbonden.loading && (overview || verbonden.groups.length === 0)}
			<!-- The heads of the groups to come, with their counts, and rows still being read. -->
			<!-- Each group in its place, with blank rows as many as it will show (#1): what
			     comes fills them in, and nothing below moves. -->
			{#each verbonden.preview?.length ? verbonden.preview : [null] as p, i (p?.id ?? i)}
				{#if p?.section && p.section !== verbonden.preview?.[i - 1]?.section}
					<h3 class="section">{p.section}</h3>
				{/if}
				<PendingGroup group={p} collection={selection.collection} />
			{/each}
			<p class="sr-only" role="status">Verbindingen laden</p>
		{/if}

		{#each overview ? [] : shown as g, i (g.id)}
			{@const all = expanded.has(g.id)}
			{@const bars = years(g)}
			{@const count = groupCount(g)}
			<!-- A group is no folding section (besluit 38, K1): always open. -->
			{@const toe = false}
			{@const zussen = repeatedTitles(g.rows)}
			{#if g.section && g.section !== shown[i - 1]?.section}
				<h3 class="section">{g.section}</h3>
			{/if}
			<section class="group" data-group={g.id}>
				<!-- While its rows come, the count the node foretells, as the skeleton showed it (#1). -->
				<GroupHead
					label={g.label}
					count={g.laden
						? verbonden.verwacht?.[g.id] != null
							? formatCount(verbonden.verwacht[g.id])
							: '…'
						: g.failed && g.rows.length === 0
							? ''
							: countLabel(g)}
				/>
				{#if !toe}
					{#if g.laden && verbonden.verwacht?.[g.id]}
						<!-- Its place as it will be: blank rows as many as it will show, so the rows
								 that come do not push down what stands below (#1). -->
						<PendingRows
							count={verbonden.verwacht[g.id]}
							shown={PREVIEW_ROWS}
							kind={pendingKind(g.noun, selection.collection)}
						/>
						<p class="sr-only">
							{g.noun ? `${capitalize(g.noun)} laden…` : 'Laden…'}
						</p>
					{/if}
					{#if g.failed && g.rows.length === 0}
						<div class="note">
							<LoadState
								state={{ status: 'error', error: g.error }}
								what={g.noun ? `De ${g.noun}` : 'Deze groep'}
								plural={!!g.noun}
								retry={onRetry}
							/>
						</div>
					{/if}
					{#if g.id === citingJudgments?.id && !filter.jaar && !filter.rechter}
						<!-- Per instantie, over all of them, the same unit as the heading: the judgments
						     (A208c); under a year or a court the heading counts those, the bar would not. -->
						<div class="tiers-plek"><TierBar {parts} pending={tiersPending} /></div>
					{/if}
					{#if g.orders || bars.length > 0 || g.areas?.length}
						<JudgmentOrderLine
							orders={g.orders}
							order={verbonden.options.order}
							onOrder={(order) => onReloadGroup?.(g.id, { order })}
							years={bars}
							courts={g.courts}
							areas={g.areas}
							{filter}
							{onFilter}
						/>
					{/if}
					<ul class="rows">
						{#each all ? g.rows : g.rows.slice(0, PREVIEW_ROWS) as row (rowKey(row))}
							<VerbondenRow
								{row}
								{selection}
								inPlace={g.inPlace}
								sister={zussen.has(row.title) ? caseNumberOf(row) : null}
								open={openRij === rowKey(row)}
								onToggle={() => wisselRij(row)}
								{onProposedText}
								{onAddToNetwerk}
								{inNetwerk}
							/>
						{/each}
					</ul>
					{#if g.rows.length > PREVIEW_ROWS}
						<p class="group__alle">
							<AlleN
								aantal={count}
								noun={g.noun ?? 'verbindingen'}
								open={all}
								onclick={() => {
									if (!all && (g.total ?? 0) > g.rows.length)
										onMeer?.(g.id)?.catch((e) => report('Verbonden meer', e));
									expanded = toggle(expanded, g.id);
								}}
							/>
						</p>
					{/if}
					{#if all && count > g.rows.length}
						<p class="group__alle">
							<TekstLink href={tableHref}>Alle {formatCount(count)} in een tabel</TekstLink>
						</p>
					{/if}
				{/if}
			</section>
		{/each}

		{#if nogOnderweg.length > 0 && !overview}
			<p class="note stil group__laden" role="status">
				{zin(nogOnderweg)} laden…
			</p>
		{/if}

		{#if empty}
			<p class="note stil">{emptyLine(EMPTY_FILTER)}</p>
		{:else if !verbonden.loading && !verbonden.failed && alleenKern}
			<p class="note stil">Geen andere verbindingen.</p>
		{:else if !verbonden.loading && !verbonden.failed && shown.length === 0 && groepen.length > 0}
			<p class="note stil">{emptyLine(filter)}</p>
		{/if}

		{#if hidden.length > 0}
			<!-- What the bronfilter leaves out, as a quiet line of links: each shows its group. -->
			<p class="hidden">
				Ook <span class="ook"
					>{#each hidden as h (h.group)}<span
							><TekstLink
								title="Toon ook de {FILTER_GROUP_NOUN[h.group]}"
								onclick={() => onFilter(withFilterGroup(filter, h.group))}
								>{filterGroupCount(h.count, h.group)}</TekstLink
							></span
						>{/each}</span
				>
			</p>
		{/if}

		{#if verbonden.groups.length > 0 && !empty}
			<div class="foot">
				<!-- At a glance as the mockups word it; with a soort open, with the count it lists. -->
				<TekstLink href={tableHref}
					>{overview
						? 'Alles in een tabel'
						: `${isAtLeast(total) ? 'Alle verbindingen' : `Alle ${alleVerbindingen != null ? formatCount(alleVerbindingen) : total}`} in een tabel`}</TekstLink
				>
				<!-- The part it exports is known once every row is in: asked on the way to the click. -->
				<TekstLink
					onclick={exportCsv}
					onpointerenter={() => onAlles?.()}
					onfocus={() => onAlles?.()}
					>{verbonden.volledig ? exportLabel(verbonden.groups, filter) : 'Exporteer'}</TekstLink
				>
			</div>
		{/if}
	</div>
</aside>

<style>
	.verbonden {
		scroll-margin-top: var(--topbar-h);
		display: flex;
		flex-direction: column;
		height: 100%;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
	}
	.head {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-2);
		padding: var(--s-4) var(--s-4) 0;
	}
	/* The choose-line: one height (24 px), one baseline, under the heading. */
	.regel {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0 var(--s-4);
		padding: var(--s-1) var(--s-4) var(--s-2);
		border-bottom: 1px solid var(--rule);
	}
	/* Under the sketch, at the right, as Alles in Actueel. */
	@media (max-width: 768px) {
		.groot :global(.tekstlink) {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
	.groot {
		display: flex;
		justify-content: flex-end;
		margin: 0 0 var(--s-3);
		font-size: var(--t-meta);
	}
	/* Netwerk tonen at the right of the heading; the count on the line under it. */
	.head__netwerk {
		margin-left: auto;
	}
	/* A finger's 44 px on a touch screen and below 768. */
	@media (pointer: coarse), (max-width: 768px) {
		.head__netwerk {
			min-height: var(--veld-h-raak);
		}
	}
	/* In Tekst Verbonden is a column of the page, as the mockups V1 lay it out: a rule at its left
	   as long as what it holds, 32 px to its words, its heading at the size of a section, and
	   its soorten on their own edges. Beside the canvas it stays a panel with its own scroll. */
	.verbonden--tekst {
		height: auto;
		padding-left: var(--s-6);
		border-left: 1px solid var(--rule);
	}
	.verbonden--tekst .head {
		padding: 0;
		margin-bottom: var(--s-4);
	}
	.verbonden--tekst .head__title {
		font-size: var(--t-h3);
		line-height: var(--lh-snug);
	}
	.verbonden--tekst .regel,
	.verbonden--tekst .note,
	.verbonden--tekst .hidden {
		padding-inline: 0;
	}
	.verbonden--tekst .body {
		overflow: visible;
		padding-bottom: 0;
	}
	.verbonden--tekst .foot {
		padding: var(--s-4) 0 0;
		border-top: 1px solid var(--rule);
		font-size: var(--t-meta);
	}
	/* Under the text on a narrow screen: the rule above it is the column's (explore/+page). */
	@media (max-width: 1100px) {
		.verbonden--tekst {
			padding-left: 0;
			border-left: 0;
		}
	}
	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.head__count {
		flex-basis: 100%;
		min-height: calc(var(--t-micro) * var(--lh-snug));
		color: var(--ink-3);
	}
	.body {
		flex: 1;
		overflow-y: auto;
		padding-bottom: var(--s-6);
	}
	.note,
	.hidden {
		margin: 0;
		padding: var(--s-4);
	}
	.hidden {
		margin-top: var(--s-2);
		border-top: 1px solid var(--rule);
	}
	.section {
		margin: var(--s-4) 0 0;
		padding: 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 400;
		font-style: italic;
		color: var(--ink-3);
	}
	.rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	/* The counts of the line, a comma between them. */
	.ook > span + span::before {
		content: ', ';
	}
	.foot {
		display: flex;
		gap: var(--s-4);
		padding: var(--s-4);
		font-size: var(--t-micro);
	}
	/* On a phone each a finger's 44 px of its own (R3-L F11). */
	@media (pointer: coarse), (max-width: 768px) {
		.foot :global(.tekstlink) {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}

	.tiers-plek {
		padding: var(--s-1) var(--s-4) var(--s-2);
	}
	.group__alle {
		margin: 0;
		padding: var(--s-1) var(--s-4) var(--s-3);
		font-size: var(--t-meta);
	}
</style>

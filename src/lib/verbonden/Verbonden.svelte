<script lang="ts">
	// The panel Verbonden: the verbindingen of the selected bron, in the groups of the table in
	// groups.ts, under the bronfilter. In the network each group can put its bronnen on the
	// canvas or take them off.
	import { ecliKey } from '$lib/bron/leesbaar';
	import { capitalize, count, joinAnd } from '$lib/text/words';
	import { meldNetwerk } from '$lib/stores/netwerk-melding';
	import { report } from '$lib/api/errors';
	import { rijen } from '$lib/actions/rijen';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { isOpen, zetOpen } from '$lib/components/ui/dicht.svelte';
	import { page } from '$app/state';
	import { tick, untrack } from 'svelte';
	import { afterTick } from '$lib/util/after-tick';
	import { refId } from '$lib/bron/href';
	import type { GraphStore } from '$lib/graph/store/types';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type { GraphNode } from '$lib/graph/types';
	import { kindCount, BRON_KIND_NOUN, withKind, type VerbondenFilter } from './filter';
	import { formatCount } from '$lib/text/getal';
	import { countLabel, groupCount, type Group } from './groups';
	import { csvName, download, exportLabel, exportRows, rowsToCsv } from './export';
	import { caseNumberOf, repeatedTitles, rowKey, type Row } from './rows';
	import { LOAD_FAILED, type VerbondenState } from './source';
	import PendingRows, { pendingKind } from './PendingRows.svelte';
	import PendingGroup from './PendingGroup.svelte';
	import GroupHead from './GroupHead.svelte';
	import JudgmentOrderLine from './JudgmentOrderLine.svelte';
	import VerbondenRow from './VerbondenRow.svelte';
	import { VERBONDEN_BUCKET } from '$lib/api/records';
	import { groupRequest } from './open-group';
	import type { LoaderOptions } from './loaders';
	import { isInhoudGroep, isKernGroep, lazeKernIds } from '$lib/bron/behoort';
	import {
		GROUPINGS,
		PREVIEW_ROWS,
		countLine,
		filterGroups,
		hiddenLine,
		regroup,
		shownLabel,
		vasteGroepen,
		yearHistogram,
		type Grouping
	} from './view';

	let {
		verbonden,
		selection,
		filter,
		store,
		network = false,
		onFilter,
		onOpenFilter,
		onNaarNetwerk,
		onAddToNetwerk,
		inNetwerk,
		onProposedText,
		tableHref,
		onRetry,
		onReloadGroup,
		onMeer,
		onAlles
	}: {
		verbonden: VerbondenState;
		selection: GraphNode;
		filter: VerbondenFilter;
		store: GraphStore;
		/** The canvas is on screen: groups carry their layer control. */
		network?: boolean;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		/** A group was drawn in the network (on a phone: to the Netwerk tab). */
		onNaarNetwerk?: () => void;
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
	} = $props();

	/** "Toelichtingen en wijzigingen", the first word with a capital. */
	const zin = (woorden: string[]) => capitalize(joinAnd(woorden));

	let grouping = $state<Grouping>('soort');
	let expanded = $state(new Set<string>());

	let onCanvas = $state(new Set<string>());
	$effect(() => store.nodes.subscribe((ns) => (onCanvas = new Set(ns.map((n) => n.id)))));

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
			expanded = new Set([...expanded, best.id]);
			// A group closed in this browser opens for it.
			zetOpen(`verbonden:${best.id}`, true);
			// Once its rows are drawn: a smooth scroll is cut off while they render.
			afterTick(() =>
				root
					?.querySelector(`[data-group="${CSS.escape(best.id)}"]`)
					?.scrollIntoView({ block: 'start' })
			);
		})
	);

	// The year of the bronfilter, for a wet asked of the API itself (BE-51): its judgments
	// of that year are loaded, not filtered out of the first page.
	$effect(() => {
		const year = selection.collection === 'instruments' ? (filter.jaar ?? null) : null;
		if (year === untrack(() => verbonden.options.year)) return;
		onReloadGroup?.('judgments', { year });
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
				(g) =>
					!isKernGroep(selection.collection, g) &&
					!isInhoudGroep(
						selection.collection,
						g,
						(selection.raw?.props ?? {}) as Record<string, unknown>
					)
			)
			.map((g) => {
				const rows = g.rows.filter(
					(r) => !kernIds.has(refId(r.ref)) && !kernIds.has(vertalingVan(r) ?? '')
				);
				const weg = g.rows.length - rows.length;
				return weg ? { ...g, rows, total: g.total != null ? g.total - weg : g.total } : g;
			})
	);
	const alleenKern = $derived(
		groepen.every((g) => g.rows.length === 0 && !g.failed) &&
			verbonden.groups.some(
				(g) =>
					g.rows.length > 0 &&
					(isKernGroep(selection.collection, g) ||
						isInhoudGroep(
							selection.collection,
							g,
							(selection.raw?.props ?? {}) as Record<string, unknown>
						))
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
		const r = regroup(filtered, grouping, selection.collection).filter(voorzien);
		return [...r.filter((g) => !onvoorspelbaar(g)), ...r.filter(onvoorspelbaar)];
	});
	// A group still loading whose rows the node cannot foretell takes no place: it may come
	// empty, and its place going would move what stands below it (UX-toets 0.79.47, #1: the
	// skeleton of Wijzigingen 92 px up when Toelichting came empty). One line under the
	// groups says what is still coming; a group that comes with rows takes its place above it.
	const nogOnderweg = $derived(
		regroup(filtered, grouping, selection.collection)
			.filter((g) => !voorzien(g))
			.map((g) => g.noun ?? g.label.toLowerCase())
	);
	const hidden = $derived(hiddenLine(groepen, filter));
	// What the table lists: the bronfilter applied, as its own count line does.
	// One count, written once it holds (#56): a group still loading counts what the node
	// foretells for it; while one cannot be foretold, the head waits.
	const vast = $derived(
		vasteGroepen(verbonden.groups, verbonden.wachtend ?? [], verbonden.verwacht ?? {})
	);
	const wachtSet = $derived(new Set(verbonden.wachtend ?? []));
	const total = $derived(shownLabel(vast ?? verbonden.groups, filter, wachtSet));

	function toggle(set: Set<string>, id: string) {
		const next = new Set(set);
		if (!next.delete(id)) next.add(id);
		return next;
	}

	const drawable = (rows: Row[]) => rows.filter((r) => r.relation && r.direction);
	/** Whether a group holds all its rows, not the first five of Verbonden's first request. */
	const heel = (g: Group) => g.rows.length >= (g.total ?? 0) || opgehaald.has(g.id);
	/** The groups whose own buckets were asked for a drawing: as whole as the API gives. */
	let opgehaald = $state(new Set<string>());
	$effect(() => {
		void selection.id;
		opgehaald = new Set();
	});
	// On, off and undo act on the whole group, not on the rows loaded (kabinet-Jetten, 10 Oct:
	// 5 of 28 bewindspersonen).
	const isLayerOn = (g: Group) => {
		const rows = drawable(g.rows);
		return heel(g) && rows.length > 0 && rows.every((r) => onCanvas.has(refId(r.ref)));
	};
	/** The group with all its rows, asked first where it holds only the first few. */
	async function heleGroep(g: Group): Promise<Group> {
		if (heel(g) || !onMeer) return g;
		const voor = selection.id;
		await onMeer(g.id);
		await tick();
		if (voor !== selection.id) return g;
		opgehaald = new Set(opgehaald).add(g.id);
		return groepen.find((x) => x.id === g.id) ?? g;
	}

	/**
	 * What the last "toon in netwerk" did, under its group: how many were drawn or taken off,
	 * with a way back (UX 8 Oct: the box changed nothing one could see). Gone after a while.
	 */
	let melding = $state<{ groep: string; tekst: string; terug: (() => void) | null } | null>(null);
	let meldingTimer: ReturnType<typeof setTimeout> | undefined;
	const MELDING_MS = 8000;

	/** `31 bronnen`, `1 bron`: the kind of a row is not always the noun of its group. */
	const telling = (rows: Row[]) => count(rows.length, 'bron', 'bronnen');

	// Another bron: its groups have their own notes, none yet.
	$effect(() => {
		void selection.id;
		melding = null;
	});

	function meld(groep: string, tekst: string, terug: (() => void) | null) {
		clearTimeout(meldingTimer);
		melding = { groep, tekst, terug };
		meldingTimer = setTimeout(() => (melding = null), MELDING_MS);
		// On a phone the network says it too: the Netwerk tab is where the reader goes.
		meldNetwerk(tekst, terug, MELDING_MS);
	}

	async function toggleLayer(eerst: Group) {
		const aan = isLayerOn(eerst);
		const voor = selection.id;
		const g = aan ? eerst : await heleGroep(eerst);
		if (voor !== selection.id) return;
		const rows = drawable(g.rows);
		if (aan) {
			const ids = rows.map((r) => refId(r.ref));
			store.hideRows(ids);
			meld(g.id, `${telling(rows)} uit het netwerk gehaald.`, () =>
				store.showRows(selection.id, rows as CanvasRow[])
			);
			return;
		}
		const nieuw = rows.filter((r) => !onCanvas.has(refId(r.ref)));
		// Before the network has drawn the bron itself there is nothing to draw beside; say so
		// rather than claim it was drawn.
		if (!store.showRows(selection.id, rows as CanvasRow[])) {
			meld(g.id, 'Het netwerk laadt nog; niets getekend.', null);
			return;
		}
		onNaarNetwerk?.();
		if (nieuw.length)
			meld(g.id, `${telling(nieuw)} getekend in het netwerk.`, () =>
				store.hideRows(nieuw.map((r) => refId(r.ref)))
			);
		else meld(g.id, `Alle ${telling(rows)} stonden al in het netwerk.`, null);
	}

	/** The row opened in place: one at a time. */
	let openRij = $state<string | null>(null);
	const wisselRij = (row: Row) => (openRij = openRij === rowKey(row) ? null : rowKey(row));

	// The years of all the group's judgments where the API counts them (a wet, BE-47);
	// else of the rows loaded, which the sentence then says.
	const years = (g: Group) =>
		grouping !== 'soort' || g.rows[0]?.kind !== 'uitspraken'
			? []
			: g.years?.length
				? g.years
				: g.rows.length > VERBONDEN_BUCKET
					? yearHistogram(g.rows)
					: [];

	// An export holds every row: those not loaded yet are asked first. The same rows as the
	// table's Exporteer, the kern included. Verzamel gave way to Gemarkeerd: a row's box keeps
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

<aside class="verbonden" aria-label="Verbonden" bind:this={root}>
	<div class="head">
		<h2 class="head__title">Verbonden</h2>
		<!-- A bron without verbindingen says so by its count, not by a sentence (R7, UX-toets
		     0.79.43: "Deze bron heeft geen verbindingen in de gegevens."). -->
		{#if verbonden.groups.length > 0 || (!verbonden.loading && !verbonden.failed && verbonden.id)}
			<span class="head__count">{vast ? countLine(vast, filter, wachtSet) : ''}</span>
		{/if}
	</div>
	<!-- The choose-line of the panel (docs/bediening.md): how grouped, the filter. No menu of
	     the bronnen: the groups below are the kinds chosen, and the presets and kinds are in
	     the filter (Thijs, 11 Oct). -->
	<div class="regel">
		<TekstMenu
			klein
			label="Indeling"
			waarde={grouping}
			opties={GROUPINGS.map((g) => ({ waarde: g.id, label: g.label }))}
			onSelect={(id) => (grouping = id)}
		/>
		<button type="button" class="regel__knop" onclick={onOpenFilter}>Filter</button>
	</div>

	<div class="body" use:rijen={'a.row__title'} aria-busy={verbonden.loading}>
		{#if verbonden.failed}
			<div class="note">
				<LoadState state={LOAD_FAILED} what="De verbindingen" plural retry={onRetry} />
			</div>
		{:else if verbonden.loading && verbonden.groups.length === 0}
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

		{#each shown as g, i (g.id)}
			{@const all = expanded.has(g.id)}
			{@const bars = years(g)}
			{@const count = groupCount(g)}
			{@const toe = !isOpen(`verbonden:${g.id}`, true)}
			{@const zussen = repeatedTitles(g.rows)}
			{#if g.section && g.section !== shown[i - 1]?.section}
				<h3 class="section">{g.section}</h3>
			{/if}
			<section class="group" data-group={g.id}>
				{#snippet laag()}
					<RijActies
						naam={g.label}
						netwerk={{
							aan: isLayerOn(g),
							voegToe: () => toggleLayer(g),
							haalWeg: () => toggleLayer(g)
						}}
					/>
				{/snippet}
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
					open={!toe}
					onToggle={() => zetOpen(`verbonden:${g.id}`, toe)}
					actions={network && drawable(g.rows).length > 0 ? laag : undefined}
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
						<p class="note stil">
							Kon niet worden geladen.
							{#if onRetry}
								<TekstLink onclick={onRetry}>Opnieuw</TekstLink>
							{/if}
						</p>
					{/if}
					{#if melding?.groep === g.id}
						<p class="group__melding" role="status">
							{melding.tekst}
							{#if melding.terug}
								<TekstLink
									onclick={() => {
										melding?.terug?.();
										melding = null;
									}}>Ongedaan maken</TekstLink
								>
							{/if}
						</p>
					{/if}
					{#if g.orders || bars.length > 0}
						<JudgmentOrderLine
							orders={g.orders}
							order={verbonden.options.order}
							onOrder={(order) => onReloadGroup?.(g.id, { order })}
							years={bars}
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

		{#if nogOnderweg.length > 0}
			<p class="note stil group__laden" role="status">
				{zin(nogOnderweg)} laden…
			</p>
		{/if}

		{#if !verbonden.loading && !verbonden.failed && alleenKern}
			<p class="note stil">Geen verbindingen buiten wat boven de tekst staat.</p>
		{:else if !verbonden.loading && !verbonden.failed && shown.length === 0 && groepen.length > 0}
			<p class="note stil">Geen verbindingen binnen de gekozen bronnen en filters.</p>
		{/if}

		{#if hidden.length > 0}
			<!-- What the bronfilter leaves out, as a quiet line of links: each shows its group. -->
			<p class="hidden">
				Ook <span class="ook"
					>{#each hidden as h (h.kind)}<span
							><TekstLink
								title="Toon ook de {BRON_KIND_NOUN[h.kind]}"
								onclick={() => onFilter(withKind(filter, h.kind))}
								>{kindCount(h.count, h.kind)}</TekstLink
							></span
						>{/each}</span
				>
			</p>
		{/if}

		{#if verbonden.groups.length > 0}
			<div class="foot">
				<TekstLink href={tableHref}>Alle {total} in een tabel</TekstLink>
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
		gap: var(--s-2);
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
	.regel__knop {
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
		height: var(--veld-h-klein);
	}
	.regel__knop:hover,
	.regel__knop:focus-visible {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.head__title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.head__count {
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
		font-weight: 600;
		font-style: italic;
		color: var(--ink-3);
	}
	/* What the last drawing of the group in the network did, under its head. */
	.group__melding {
		margin: 0;
		padding: 0 var(--s-4) var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-2);
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

	.group__alle {
		margin: 0;
		padding: var(--s-1) var(--s-4) var(--s-3);
		font-size: var(--t-meta);
	}
</style>

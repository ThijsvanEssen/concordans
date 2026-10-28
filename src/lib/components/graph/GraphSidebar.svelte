<script lang="ts">
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	// The filter of the werkplek, which is also its key (besluit 39): Tonen (the kinds drawn,
	// of how many where the API cut them off, that whole a link to their list), Relatie (the
	// lijnsoorten drawn, a line sample each). Bijlagen and the netwerk's own filter are rows of
	// Tonen.
	import ProposalsOption from '$lib/proposals/ProposalsOption.svelte';
	import type { ComponentProps } from 'svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import type { Collection } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		FILTER_GROUP_LABEL,
		stuksoortOn,
		toggleFilterGroup,
		toggleStuksoort,
		type FilterGroup,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import {
		LINE_KINDS,
		LINE_KIND_LABEL,
		LINE_KIND_SAMPLE,
		type LineKind
	} from '$lib/graph/line-kind';
	import { kindColour } from '$lib/bron/kleur';
	import { STUKSOORTEN, STUKSOORT_LABEL, sortColour, type Stuksoort } from '$lib/bron/rubrieken';
	import { GROUP_LABEL } from '$lib/graph/collection-role';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import LineSample from './LineSample.svelte';
	import { BRON_LABEL } from '$lib/vocabulary';
	import { kindCuts } from './kind-cut';
	import { formatCount } from '$lib/text/getal';
	import { SORT_SHAPE } from '$lib/bron/vormen';
	import type { ContainerKind } from '$lib/graph/container-membership';
	import { type NeighborhoodReach } from '$lib/graph/store/types';
	import { kindRowCount, type KindRow } from './kind-rows';

	let {
		filter,
		onFilter,
		lijstHref,
		hiddenLines,
		onToggleLine,
		hiddenAnnexes = false,
		onToggleAnnexes,
		onToggleGroup,
		canvasCounts,
		hasNodes = false,
		reach = null,
		counting = false,
		proposals,
		kindRowsShown = null,
		kindsSettled = true,
		withCurrentMember = false
	}: {
		filter: VerbondenFilter;
		onFilter: (f: VerbondenFilter) => void;
		/** All the focus's direct neighbours of these kinds as a list, not as nodes (Thijs, 28 Oct). */
		lijstHref?: (bronnen: readonly FilterGroup[]) => string;
		hiddenLines: ReadonlySet<LineKind>;
		onToggleLine: (l: LineKind) => void;
		/** Bijlagen (a bron of no kind of its own) switched off. */
		hiddenAnnexes?: boolean;
		onToggleAnnexes?: () => void;
		onToggleGroup?: (kind: ContainerKind) => void;
		canvasCounts: {
			kinds?: Partial<Record<FilterGroup, number>>;
			stuksoorten?: Partial<Record<Stuksoort, number>>;
			lines?: Partial<Record<LineKind, number>>;
			annexes?: number;
			metGroep?: Partial<
				Record<FilterGroup, { count: number; van: number; groepen: ContainerKind[] }>
			>;
		};
		hasNodes?: boolean;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		/** The netwerk is still coming in: Soort counts once it is there, no number springs (R3-N B5). */
		counting?: boolean;
		/** The vinkje Voorstellen, last row of Tonen (besluit 37). */
		proposals?: ComponentProps<typeof ProposalsOption>;
		/** Soort around one bron: the soorten of Verbonden, drawn of their whole (kind-rows.ts, N1). */
		kindRowsShown?: KindRow[] | null;
		/** Verbonden's counts are in: before that Soort holds their place (F5). */
		kindsSettled?: boolean;
		/** Leden drawn filled while current, as an outline once gone: the key says so (N13). */
		withCurrentMember?: boolean;
	} = $props();

	// The kinds count what is on the canvas, with a selection too: the legend is the key to
	// the drawing, open as closed; the focus's direct verbindingen are in Verbonden (besluit 29).
	const totals = $derived(canvasCounts.kinds ?? {});

	// Per kind drawn, the whole where the API cut it off: "63 van 10.395" in the count's column
	// (Thijs, 10 Oct: "maak duidelijk dat we niet alles zien"; 23 Oct: one list, one grid).
	const cuts = $derived(kindCuts(reach?.buckets ?? [], totals));
	// Relatie: the lines drawn, one row per relation, in the words of the mockup (A197-b) where
	// one relation is read two ways (a judgment haalt aan, a Kamerstuk noemt).
	// Stuksoort: what the stukken drawn are, a block of its own under Tonen (Filter Soort names the
	// soorten, the stuksoort is a facet of the soort Stukken).
	const stuksoorten = $derived(
		(totals.stukken ?? 0) > 0 || filter.bronnen?.has('stukken') === false
			? STUKSOORTEN.filter(
					(s) => (canvasCounts.stuksoorten?.[s] ?? 0) > 0 || !stuksoortOn(filter, s)
				)
			: []
	);
	const kinds = $derived(FILTER_GROUPS.filter((k) => (totals[k] ?? 0) > 0 || !isOn(k)));
	// Relatie: one row per lijnsoort (Netwerkcanvas, Lijnen) that is drawn or switched off.
	const lines = $derived(
		LINE_KINDS.filter((l) => (canvasCounts.lines?.[l] ?? 0) > 0 || hiddenLines.has(l))
	);
	const annexes = $derived(canvasCounts.annexes ?? 0);

	const isOn = (k: (typeof FILTER_GROUPS)[number]) =>
		filter.bronnen === null || filter.bronnen.has(k);
	/** A row of Soort is on while every kind of the bronfilter it holds is. */
	const rowOn = (r: KindRow) => r.filterGroups.every(isOn);
	/** Its switch: all its kinds off, or all on again. */
	function toggleRow(r: KindRow) {
		const on = rowOn(r);
		const next = new Set(filter.bronnen ?? FILTER_GROUPS);
		for (const k of r.filterGroups) {
			if (on) next.delete(k);
			else next.add(k);
		}
		onFilter({ ...filter, bronnen: next.size === FILTER_GROUPS.length ? null : next });
	}
	const rowGroupsOff = (r: KindRow) =>
		r.filterGroups.map(metGroepUit).find((g): g is ContainerKind[] => !!g) ?? null;

	// A kind whose bronnen all went with a grouping switched off stays, greyed: a click
	// switches that grouping on again (Thijs, 9 Oct). Partly hidden, the row is as ever.
	const metGroepUit = (k: FilterGroup): ContainerKind[] | null => {
		const m = canvasCounts.metGroep?.[k];
		return m && isOn(k) && m.count > 0 && m.count >= m.van ? m.groepen : null;
	};
</script>

<!-- The whole of a kind the canvas cut off, in its count: "67 van 10.406", the 10.406 the way
     to them as a list (the table of Verbonden under that kind), not as so many nodes. -->
{#snippet alleLijst(total: number, bronnen: readonly FilterGroup[], noun: string)}
	{#if lijstHref}
		{@const woorden = `Alle ${formatCount(total)} ${noun.toLowerCase()}`}
		<TekstLink class="rij__alle" href={lijstHref(bronnen)} aria-label={woorden} title={woorden}
			>{formatCount(total)}</TekstLink
		>
	{/if}
{/snippet}

{#snippet tonenRest()}
	{#if annexes > 0 || hiddenAnnexes}
		<FilterOptie
			label="Bijlagen"
			on={!hiddenAnnexes}
			onToggle={() => onToggleAnnexes?.()}
			count={annexes}
			loading={counting}
			empty={annexes === 0}
		>
			{#snippet voor()}<KindGlyph
					vorm="regel-o"
					size={11}
					colour={kindColour('annexes')}
				/>{/snippet}
		</FilterOptie>
	{/if}
	{#if proposals}<ProposalsOption {...proposals} />{/if}
{/snippet}

<aside class="legend">
	<!-- Nothing on the canvas: nothing to filter, group or count yet. -->
	{#if !hasNodes}
		<p class="empty stil">Nog geen bronnen in het netwerk.</p>
	{:else}
		<!-- Around one bron: the soorten of Verbonden, how many drawn of how many (N1, N2). -->
		{#if kindRowsShown}{#if kindRowsShown.length > 0 || annexes > 0}
				<Sectie title="Tonen" niveau={3} inklapbaar={false}>
					{#each kindRowsShown as r, i (r.id)}
						{@const on = rowOn(r)}
						{#if r.further && !kindRowsShown[i - 1]?.further}
							<h4 class="block__sub">Een stap verder</h4>
						{/if}
						{@const off = rowGroupsOff(r)}
						{@const alle =
							r.load && r.total != null && on && kindsSettled && !counting ? r.total : null}
						<div class="rij">
							<FilterOptie
								label={r.label}
								title={off ? `Aan met ${off.map((g) => GROUP_LABEL[g]).join(' en ')}` : undefined}
								wrap
								{on}
								onToggle={() => (off ? off.forEach((g) => onToggleGroup?.(g)) : toggleRow(r))}
								count={alle != null && lijstHref
									? `${formatCount(r.drawn)} van`
									: kindRowCount(r, on)}
								naam={alle != null && lijstHref ? `${r.label} ${kindRowCount(r, on)}` : undefined}
								loading={counting || !kindsSettled}
								empty={r.drawn === 0}
								gedimd={!!off}
							>
								{#snippet voor()}<KindGlyph
										vorm={r.filterGroups[0] ? SORT_SHAPE[r.filterGroups[0]] : undefined}
										collection={r.filterGroups[0] ? undefined : (r.collection ?? undefined)}
										size={11}
										colour={r.filterGroups[0]
											? sortColour(r.filterGroups[0])
											: r.collection
												? kindColour(r.collection)
												: undefined}
									/>{/snippet}
							</FilterOptie>
							{#if alle != null}{@render alleLijst(alle, r.filterGroups, r.label)}{/if}
						</div>
						{#if withCurrentMember && r.collection === 'members'}
							<!-- The one marking of a current lid, as the canvas draws it (N13). -->
							<p class="sleutel">
								<span class="sleutel__item"
									><KindGlyph collection="members" size={11} colour={kindColour('members')} />Huidig
									lid</span
								>
								<span class="sleutel__item"
									><KindGlyph
										collection="members"
										size={11}
										open
										colour={kindColour('members')}
									/>Oud-lid</span
								>
							</p>
						{/if}
					{/each}
					{@render tonenRest()}
				</Sectie>
			{/if}
			<!-- The kinds drawn, and one switched off: no rows of nothing, no heading without rows. -->
		{:else if kinds.length > 0 || annexes > 0}
			<Sectie title="Tonen" niveau={3} inklapbaar={false}>
				{#each kinds as k (k)}
					{@const n = totals[k] ?? 0}
					{@const groepen = metGroepUit(k)}
					{@const cut = cuts[k]}
					{@const alle = cut && lijstHref && !counting ? cut : null}
					<div class="rij">
						<FilterOptie
							label={FILTER_GROUP_LABEL[k]}
							title={groepen
								? `Aan met ${groepen.map((g) => GROUP_LABEL[g]).join(' en ')}`
								: undefined}
							wrap
							on={isOn(k)}
							onToggle={() =>
								groepen
									? groepen.forEach((g) => onToggleGroup?.(g))
									: onFilter(toggleFilterGroup(filter, k))}
							count={alle
								? `${formatCount(n)} van`
								: cut
									? `${formatCount(n)} van ${formatCount(cut.total)}`
									: n}
							naam={alle
								? `${FILTER_GROUP_LABEL[k]} ${formatCount(n)} van ${formatCount(alle.total)}`
								: undefined}
							loading={counting}
							empty={n === 0}
							gedimd={!!groepen}
						>
							{#snippet voor()}<KindGlyph
									vorm={SORT_SHAPE[k]}
									size={11}
									colour={sortColour(k)}
								/>{/snippet}
						</FilterOptie>
						{#if alle}{@render alleLijst(
								alle.total,
								[k],
								BRON_LABEL[alle.collection as Collection][1]
							)}{/if}
					</div>
				{/each}
				{@render tonenRest()}
			</Sectie>
		{/if}

		{#if stuksoorten.length > 1 || filter.stuksoort}
			<Sectie title="Stuksoort" niveau={3} inklapbaar={false}>
				{#each stuksoorten as s (s)}
					{@const n = canvasCounts.stuksoorten?.[s] ?? 0}
					<FilterOptie
						label={STUKSOORT_LABEL[s]}
						wrap
						on={stuksoortOn(filter, s)}
						onToggle={() => onFilter(toggleStuksoort(filter, s))}
						count={n}
						loading={counting}
						empty={n === 0}
					>
						{#snippet voor()}<KindGlyph
								vorm={s === 'wetsvoorstellen' ? 'voorstel' : 'stuk'}
								size={11}
								colour={sortColour('stukken')}
							/>{/snippet}
					</FilterOptie>
				{/each}
			</Sectie>
		{/if}

		{#if lines.length > 0}
			<Sectie title="Relatie" niveau={3} inklapbaar={false}>
				{#each lines as l (l)}
					{@const sample = LINE_KIND_SAMPLE[l]}
					<FilterOptie
						label={LINE_KIND_LABEL[l]}
						wrap
						on={!hiddenLines.has(l)}
						onToggle={() => onToggleLine(l)}
						count={canvasCounts.lines?.[l] ?? 0}
						loading={counting}
					>
						{#snippet voor()}<LineSample relation={sample.relation} from={sample.from} />{/snippet}
					</FilterOptie>
				{/each}
			</Sectie>
		{/if}
	{/if}
</aside>

<style>
	/* In the strip at the left of the werkplek, in Weergave: a block (Sectie) for each of Tonen
	   and Relatie. */
	.legend {
		/* The marks of Tonen and Relatie in one column, as wide as a line sample. */
		--optie-voor: 28px;
		--lezer-stap: var(--s-4);
		display: flex;
		flex-direction: column;
		gap: var(--lezer-stap);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}
	/* The bronnen one step further, under the soorten of Verbonden. */
	.block__sub {
		margin: var(--s-3) 0 var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	/* Under the leden: what filled and outline mean on the canvas. */
	.sleutel {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		margin: 0;
		padding-left: var(--optie-voor);
		color: var(--ink-3);
	}
	.sleutel__item {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
	}
	/* A row of Tonen, and beside its count the whole of a kind cut off: one line, the link the
	   last word of "67 van 10.406" (a link cannot stand inside the option's button). */
	.rij {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		column-gap: var(--s-1);
	}
	/* Without that link the option takes the whole row: every count ends on the one edge. */
	.rij > :global(:only-child) {
		grid-column: 1 / -1;
	}
	.rij > :global(.rij__alle) {
		font-size: var(--t-micro);
	}
	.empty {
		margin: 0;
	}
</style>

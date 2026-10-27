<script lang="ts">
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import { NL } from '$lib/text/collator';
	// The filter of the werkplek, which is also its key (besluit 39): Tonen (the kinds drawn,
	// of how many where the API cut them off, and the step that loads them all), Relatie (the
	// lijnsoorten drawn, a line sample each); under Meer the preset,
	// the lid and the overlays. Omtrekken and Bijlagen are rows of Tonen.
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import type { Snippet } from 'svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { HEAT_PERIODS, type Overlay } from '$lib/selection/overlay';
	import type { Collection } from '$lib/vocabulary';
	import {
		FILTER_GROUPS,
		FILTER_GROUP_LABEL,
		PRESETS,
		activePreset,
		toggleFilterGroup,
		withPreset,
		type FilterGroup,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/data-source';
	import { allRows, lidCounts } from '$lib/verbonden/view';
	import {
		LINE_KINDS,
		LINE_KIND_LABEL,
		LINE_KIND_SAMPLE,
		type LineKind
	} from '$lib/graph/line-kind';
	import { kindColour } from '$lib/bron/kleur';
	import { GROUP_LABEL } from '$lib/graph/collection-role';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import LineSample from './LineSample.svelte';
	import { BRON_LABEL } from '$lib/vocabulary';
	import { kindCuts } from './kind-cut';
	import { formatCount } from '$lib/text/getal';
	import { FILTER_GROUP_VORM } from '$lib/bron/vormen';
	import type { ContainerKind } from '$lib/graph/container-membership';
	import { type NeighborhoodReach } from '$lib/graph/store/types';
	import { kindRowCount, type KindRow } from './kind-rows';

	let {
		verbonden,
		filter,
		onFilter,
		onOpenFilter,
		onLaadSoort,
		laadtSoort = new Set<string>(),
		hiddenLines,
		onToggleLine,
		hiddenAnnexes = false,
		onToggleAnnexes,
		outlines = 0,
		hiddenGroups = new Set(),
		onToggleGroup,
		canvasCounts,
		overlay = { kind: 'none' } as Overlay,
		inFluxCount = 0,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		hasNodes = false,
		reach = null,
		counting = false,
		meer,
		kindRowsShown = null,
		kindsSettled = true,
		withCurrentMember = false
	}: {
		verbonden: VerbondenState;
		filter: VerbondenFilter;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		/** All the focus's direct neighbours of one kind (the per-kind step). */
		onLaadSoort?: (collection: Collection) => void;
		/** The kinds being loaded so. */
		laadtSoort?: ReadonlySet<string>;
		hiddenLines: ReadonlySet<LineKind>;
		onToggleLine: (l: LineKind) => void;
		/** Bijlagen (a bron of no kind of its own) switched off. */
		hiddenAnnexes?: boolean;
		onToggleAnnexes?: () => void;
		/** How many outlines the canvas draws; the Vinkje Omtrekken stands where there are some. */
		outlines?: number;
		/** Groupings switched off: no hull around their bronnen. */
		hiddenGroups?: ReadonlySet<ContainerKind>;
		onToggleGroup?: (kind: ContainerKind) => void;
		canvasCounts: {
			kinds?: Partial<Record<FilterGroup, number>>;
			lines?: Partial<Record<LineKind, number>>;
			annexes?: number;
			metGroep?: Partial<
				Record<FilterGroup, { count: number; van: number; groepen: ContainerKind[] }>
			>;
		};
		overlay?: Overlay;
		inFluxCount?: number;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		hasNodes?: boolean;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		/** The netwerk is still coming in: Soort counts once it is there, no number springs (R3-N B5). */
		counting?: boolean;
		/** First under Meer: the netwerk's own filters (NetworkOptions). */
		meer?: Snippet;
		/** Soort around one bron: the soorten of Verbonden, drawn of their whole (kind-rows.ts, N1). */
		kindRowsShown?: KindRow[] | null;
		/** Verbonden's counts are in: before that Soort holds their place (F5). */
		kindsSettled?: boolean;
		/** Leden drawn filled while current, as an outline once gone: the key says so (N13). */
		withCurrentMember?: boolean;
	} = $props();

	const MEER = 'netwerk:meer';
	const meerOpen = $derived(isOpen(MEER, false));

	// The kinds count what is on the canvas, with a selection too: the legend is the key to
	// the drawing, open as closed; the focus's direct verbindingen are in Verbonden (besluit 29).
	const totals = $derived(canvasCounts.kinds ?? {});

	// Per kind drawn, the whole where the API cut it off: "63 van 10.395" in the count's column
	// (Thijs, 10 Oct: "maak duidelijk dat we niet alles zien"; 23 Oct: one list, one grid).
	const cuts = $derived(kindCuts(reach?.buckets ?? [], totals));
	// Relatie: the lines drawn, one row per relation, in the words of the mockup (A197-b) where
	// one relation is read two ways (a judgment haalt aan, a Kamerstuk noemt).
	/** The kind of bron a filter group draws, for its colour (kleur.ts). */
	const GROUP_COLLECTION: Record<FilterGroup, Collection> = {
		artikelen: 'articles',
		wetten: 'instruments',
		uitspraken: 'judgments',
		toelichtingen: 'documents',
		wetsvoorstellen: 'documents',
		dossiers: 'dossiers',
		stemmingen: 'decisions',
		leden: 'members',
		organen: 'committees',
		internationaal: 'instruments'
	};
	const kinds = $derived(FILTER_GROUPS.filter((k) => (totals[k] ?? 0) > 0 || !isOn(k)));
	// Relatie: one row per lijnsoort (Netwerkcanvas, Lijnen) that is drawn or switched off.
	const lines = $derived(
		LINE_KINDS.filter((l) => (canvasCounts.lines?.[l] ?? 0) > 0 || hiddenLines.has(l))
	);
	const annexes = $derived(canvasCounts.annexes ?? 0);
	/** Omtrekken are on while no grouping is switched off. */
	const outlinesOn = $derived(hiddenGroups.size === 0);
	function toggleOutlines() {
		const kinds = Object.keys(GROUP_LABEL) as ContainerKind[];
		for (const kind of kinds) if (outlinesOn === !hiddenGroups.has(kind)) onToggleGroup?.(kind);
	}

	// On the canvas a wet, dossier, fractie or commissie is a hull, never a bron: the kinds
	// are named by what does stand there (Thijs). Verbonden lists the wetten, dossiers and
	// fracties themselves, and keeps their names; the switch is the same.
	const OP_HET_NETWERK: Partial<Record<FilterGroup, { label: string; elders: string }>> = {
		wetten: { label: 'Wetten en regelingen', elders: 'Wetten' },
		dossiers: { label: 'Overige stukken', elders: 'Dossiers' },
		leden: { label: 'Leden', elders: 'Leden en fracties' }
	};
	const kindLabel = (k: FilterGroup) => OP_HET_NETWERK[k]?.label ?? FILTER_GROUP_LABEL[k];
	const kindTitle = (k: FilterGroup) => {
		const n = OP_HET_NETWERK[k];
		return n ? `${n.label} (in Verbonden: ${n.elders})` : undefined;
	};
	const lids = $derived(
		[...(verbonden.lidTellingen ?? lidCounts(allRows(verbonden.groups)))]
			.map(([k]) => k)
			.filter((k) => k !== '')
			.sort(NL.compare)
	);
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

	const mutOn = $derived(overlay.kind === 'open');
	const heatOn = $derived(overlay.kind === 'heat');
</script>

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
	{#if outlines > 0 || hiddenGroups.size > 0}
		<FilterOptie label="Omtrekken" on={outlinesOn} onToggle={toggleOutlines} />
	{/if}
{/snippet}

<aside class="legend">
	<!-- Nothing on the canvas: nothing to filter, group or count yet. -->
	{#if !hasNodes}
		<p class="empty stil">Nog geen bronnen in het netwerk.</p>
	{:else}
		<!-- Around one bron: the soorten of Verbonden, how many drawn of how many (N1, N2). -->
		{#if kindRowsShown}{#if kindRowsShown.length > 0 || annexes > 0 || outlines > 0}
				<Sectie title="Tonen" niveau={3} inklapbaar={false}>
					{#each kindRowsShown as r, i (r.id)}
						{@const on = rowOn(r)}
						{#if r.further && !kindRowsShown[i - 1]?.further}
							<h4 class="block__sub">Een stap verder</h4>
						{/if}
						{@const off = rowGroupsOff(r)}
						<FilterOptie
							label={r.label}
							title={off ? `Aan met ${off.map((g) => GROUP_LABEL[g]).join(' en ')}` : undefined}
							wrap
							{on}
							onToggle={() => (off ? off.forEach((g) => onToggleGroup?.(g)) : toggleRow(r))}
							count={kindRowCount(r, on)}
							loading={counting || !kindsSettled}
							empty={r.drawn === 0}
							gedimd={!!off}
						>
							{#snippet voor()}<KindGlyph
									collection={r.collection ?? undefined}
									size={11}
									colour={r.collection ? kindColour(r.collection) : undefined}
								/>{/snippet}
						</FilterOptie>
						{#if r.load && onLaadSoort && kindsSettled}
							{@const c = r.load}
							<p class="laad">
								{#if laadtSoort.has(c)}<span class="stil">Laden…</span>{:else}<AlleN
										aantal={r.total ?? 0}
										noun={r.label.toLowerCase()}
										onclick={() => onLaadSoort(c)}
									/>{/if}
							</p>
						{/if}
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
		{:else if kinds.length > 0 || annexes > 0 || outlines > 0}
			<Sectie title="Tonen" niveau={3} inklapbaar={false}>
				{#each kinds as k (k)}
					{@const n = totals[k] ?? 0}
					{@const groepen = metGroepUit(k)}
					{@const cut = cuts[k]}
					<FilterOptie
						label={kindLabel(k)}
						title={groepen
							? `Aan met ${groepen.map((g) => GROUP_LABEL[g]).join(' en ')}`
							: kindTitle(k)}
						wrap
						on={isOn(k)}
						onToggle={() =>
							groepen
								? groepen.forEach((g) => onToggleGroup?.(g))
								: onFilter(toggleFilterGroup(filter, k))}
						count={cut ? `${formatCount(n)} van ${formatCount(cut.total)}` : n}
						loading={counting}
						empty={n === 0}
						gedimd={!!groepen}
					>
						{#snippet voor()}<KindGlyph
								vorm={FILTER_GROUP_VORM[k]}
								size={11}
								colour={kindColour(GROUP_COLLECTION[k])}
							/>{/snippet}
					</FilterOptie>
					<!-- The one step where the kind is cut off: all of it, under its count. -->
					{#if cut && onLaadSoort}
						{@const c = cut.collection as Collection}
						<p class="laad">
							{#if laadtSoort.has(c)}<span class="stil">Laden…</span>{:else}<AlleN
									aantal={cut.total}
									noun={BRON_LABEL[c][1].toLowerCase()}
									onclick={() => onLaadSoort(c)}
								/>{/if}
						</p>
					{/if}
				{/each}
				{@render tonenRest()}
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
		<div class="verder">
			<FoldButton sleutel={MEER} open={meerOpen} controls="netwerk-meer">Meer</FoldButton>
		</div>
		{#if meerOpen}
			<div class="verder__inhoud" id="netwerk-meer">
				{#if meer}<section class="block">{@render meer()}</section>{/if}
				<section class="block">
					<div class="block__label">Beperk tot</div>
					<TekstMenu
						label="Beperk tot"
						tekst="Beperk tot"
						waarde={activePreset(filter)?.id ?? null}
						opties={PRESETS.map((p) => ({ waarde: p.id, label: p.label }))}
						onSelect={(id) => {
							const p = PRESETS.find((x) => x.id === id);
							if (p) onFilter(withPreset(filter, p));
						}}
					>
						{#snippet onder(sluit)}
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									sluit();
									onOpenFilter();
								}}>Kies bronnen en verbindingen</button
							>
						{/snippet}
					</TekstMenu>
				</section>

				{#if lids.length > 0}
					<section class="block">
						<div class="block__label">Lid</div>
						<TekstMenu
							label="Lid"
							waarde={filter.lid ?? ''}
							opties={[
								{ waarde: '', label: 'Alle leden' },
								...lids.map((lid) => ({ waarde: lid, label: `Lid ${lid}` })),
								{ waarde: 'geen', label: 'Lid niet genoemd' }
							]}
							onSelect={(v) => onFilter({ ...filter, lid: v === '' ? null : v })}
						/>
					</section>
				{/if}

				<section class="block">
					<div class="block__label">Markering</div>
					<div class="block">
						<TekstMenu
							label="Markering"
							waarde={mutOn ? 'mut' : heatOn ? 'heat' : 'geen'}
							opties={[
								{ waarde: 'geen', label: 'Geen' },
								{
									waarde: 'mut',
									label: `Openstaande dossiers${mutOn && inFluxCount > 0 ? ` (${inFluxCount})` : ''}`,
									uit: !onToggleMutatie,
									titel: 'Een ring om de bronnen die een wetsvoorstel wil wijzigen'
								},
								{
									waarde: 'heat',
									label: 'Verwijzingen per maand',
									uit: !onToggleHeat,
									titel: 'Hoe vaak een bron in de gekozen periode is aangehaald'
								}
							]}
							onSelect={(w) => {
								if (w === 'geen') {
									if (mutOn) onToggleMutatie?.();
									else if (heatOn) onToggleHeat?.();
								} else if (w === 'mut') {
									if (heatOn) onToggleHeat?.();
									if (!mutOn) onToggleMutatie?.();
								} else {
									if (mutOn) onToggleMutatie?.();
									if (!heatOn) onToggleHeat?.();
								}
							}}
						/>
						{#if heatOn}
							<div class="sub">
								<Keuze
									label="Periode"
									waarde={overlay.kind === 'heat' ? String(overlay.months) : null}
									opties={HEAT_PERIODS.map((m) => ({
										waarde: String(m),
										label: `${m} maanden`,
										uit: !onHeatPeriodChange
									}))}
									onSelect={(m) => onHeatPeriodChange?.(Number(m))}
								/>
							</div>
						{/if}
					</div>
				</section>
			</div>
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
	.verder {
		padding: var(--s-1) 0;
		border-top: 1px solid var(--rule);
	}
	.verder__inhoud {
		display: flex;
		flex-direction: column;
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
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
	/* Under the count, in its column: the one step of a kind cut off. */
	.laad {
		display: flex;
		justify-content: flex-end;
		margin: 0;
		font-size: var(--t-micro);
	}
	.block__label {
		display: flex;
		justify-content: space-between;
		margin-bottom: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.empty {
		margin: 0;
	}
	/* One line that says what a control does, or why it is off. */
	.sub {
		margin-top: var(--s-2);
	}
</style>

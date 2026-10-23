<script lang="ts">
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import { NL } from '$lib/text/collator';
	// The legend of the werkplek, which is also its filter (besluit 39): Soort (the kinds drawn,
	// of how many where the API cut them off, and the step that loads them all), Relatie (the
	// verbindingen drawn, a line sample each), the Periode the page gives; under Meer the preset,
	// the grouping, the depth, the lid and the overlays.
	import FoldButton from '$lib/components/ui/FoldButton.svelte';
	import { isOpen } from '$lib/components/ui/dicht.svelte';
	import type { Snippet } from 'svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import { HEAT_PERIODS, type Overlay } from '$lib/selection/overlay';
	import type { Collection, Relation } from '$lib/vocabulary';
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
	import { lineName } from '$lib/verbonden/relation-words';
	import { kindColour } from '$lib/bron/kleur';
	import {
		edgeColorFor,
		edgeStyleFor,
		hullColorFor,
		hullDashFor,
		lijnDikte,
		pijlLengte,
		PIJL_BREED
	} from './nodeSprites';
	import { EDGE_WEIGHT } from '$lib/graph/types';
	import { drawClassOf } from '$lib/graph/types';
	import { GROUP_LABEL, inLegend } from '$lib/graph/collection-role';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { BRON_LABEL } from '$lib/vocabulary';
	import { kindCuts } from './kind-cut';
	import { formatCount } from '$lib/text/getal';
	import { FILTER_GROUP_VORM } from '$lib/bron/vormen';
	import type { ContainerKind } from '$lib/graph/container-membership';
	import { NEIGHBORHOOD_CAP, type NeighborhoodReach } from '$lib/graph/store/types';

	let {
		verbonden,
		filter,
		selectionCollection,
		onFilter,
		onOpenFilter,
		depth,
		onDepth,
		onLaadSoort,
		laadtSoort = new Set<string>(),
		hiddenRelations,
		onToggleRelation,
		hiddenGroups = new Set(),
		onToggleGroup,
		canvasCounts,
		overlay = { kind: 'none' } as Overlay,
		inFluxCount = 0,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		netwerkActive = false,
		hasNodes = false,
		reach = null,
		counting = false,
		periode,
		meer
	}: {
		verbonden: VerbondenState;
		filter: VerbondenFilter;
		selectionCollection: Collection | null;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		depth: number;
		onDepth: (d: number) => void;
		/** All the focus's direct neighbours of one kind (the per-kind step). */
		onLaadSoort?: (collection: Collection) => void;
		/** The kinds being loaded so. */
		laadtSoort?: ReadonlySet<string>;
		hiddenRelations: ReadonlySet<Relation>;
		onToggleRelation: (r: Relation) => void;
		/** Groupings switched off: no hull around their bronnen. */
		hiddenGroups?: ReadonlySet<ContainerKind>;
		onToggleGroup?: (kind: ContainerKind) => void;
		canvasCounts: {
			kinds?: Partial<Record<FilterGroup, number>>;
			relations?: Partial<Record<Relation, number>>;
			refersFrom?: Collection[];
			metGroep?: Partial<
				Record<FilterGroup, { count: number; van: number; groepen: ContainerKind[] }>
			>;
		};
		overlay?: Overlay;
		inFluxCount?: number;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		/** With a netwerk, a depth adds context around the selection instead of setting the view. */
		netwerkActive?: boolean;
		hasNodes?: boolean;
		/** How far the last neighbourhood reached, and whether the API cut it off. */
		reach?: NeighborhoodReach | null;
		/** The netwerk is still coming in: Soort counts once it is there, no number springs (R3-N B5). */
		counting?: boolean;
		/** The block Periode, after Relatie. */
		periode?: Snippet;
		/** First under Meer: the netwerk's own filters (NetworkOptions). */
		meer?: Snippet;
	} = $props();

	const MEER = 'netwerk:meer';
	const meerOpen = $derived(isOpen(MEER, false));

	// The kinds count what is on the canvas, with a selection too: the legend is the key to
	// the drawing, open as closed; the focus's direct verbindingen are in Verbonden (besluit 29).
	const totals = $derived(canvasCounts.kinds ?? {});

	// Diepte: the steps that add nothing, as the API cut the neighbourhood off at its cap.
	const DEPTHS = [1, 2, 3];
	const grens = $derived(reach?.cap ?? NEIGHBORHOOD_CAP);
	const CAPPED_REASON = $derived(
		`Maximaal ${grens} bronnen getoond; een stap verder voegt niets toe.`
	);
	const beyondCap = (d: number) => !netwerkActive && !!reach?.capped && d > reach.depth;
	// Per kind drawn, the whole where the API cut it off: "63 van 10.395" in the count's column
	// (Thijs, 10 Oct: "maak duidelijk dat we niet alles zien"; 23 Oct: one list, one grid).
	const cuts = $derived(kindCuts(reach?.buckets ?? [], totals));
	const NO_SELECTION_REASON = 'Kies eerst een bron in het netwerk.';
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
	const relations = $derived(
		(Object.entries(canvasCounts.relations ?? {}) as [Relation, number][])
			.filter(([r]) => inLegend(r))
			.sort((a, b) => b[1] - a[1])
			.map(([relation]) => ({
				relation,
				label: lineName(relation, canvasCounts.refersFrom)
			}))
	);
	const CONTAINER_KIND_HINT: Record<ContainerKind, string> = {
		instrument: 'een omtrek om de artikelen van een wet of regeling',
		faction: 'een omtrek om de leden van een fractie',
		committee: 'een omtrek om de leden van een commissie',
		dossier: 'een omtrek om de stukken van een dossier'
	};

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

	// A kind whose bronnen all went with a grouping switched off stays, greyed: a click
	// switches that grouping on again (Thijs, 9 Oct). Partly hidden, the row is as ever.
	const metGroepUit = (k: FilterGroup): ContainerKind[] | null => {
		const m = canvasCounts.metGroep?.[k];
		return m && isOn(k) && m.count > 0 && m.count >= m.van ? m.groepen : null;
	};

	const mutOn = $derived(overlay.kind === 'open');
	const heatOn = $derived(overlay.kind === 'heat');

	// The line sample of a relation, in the colour of the edge from this bron.
	const sourceKind = (relation: Relation) =>
		drawClassOf(
			// A citation of the selected bron comes from the other end.
			relation === 'REFERS_TO' && selectionCollection === 'articles'
				? 'judgments'
				: (selectionCollection ?? 'articles')
		);
	const dash = (relation: Relation) => {
		const style = edgeStyleFor(relation, null);
		return style === 'dotted' ? '1 3' : style === 'dashed' ? '4 3' : undefined;
	};
</script>

<aside class="legend">
	<!-- Nothing on the canvas: nothing to filter, group or count yet. -->
	{#if !hasNodes}
		<p class="empty stil">Nog geen bronnen in het netwerk.</p>
	{:else}
		<!-- The kinds drawn, and one switched off: no rows of nothing, no heading without rows. -->
		{#if kinds.length > 0}
			<section class="block">
				<h3 class="block__title">Soort</h3>
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
							{#if laadtSoort.has(c)}<span class="stil">Laden…</span>{:else}<TekstLink
									onclick={() => onLaadSoort(c)}
									aria-label="Alle {formatCount(cut.total)} {BRON_LABEL[c][1].toLowerCase()} laden"
									>Alle laden</TekstLink
								>{/if}
						</p>
					{/if}
				{/each}
			</section>
		{/if}

		{#if relations.length > 0}
			<section class="block">
				<h3 class="block__title">Relatie</h3>
				{#each relations as r (r.relation)}
					{@const rel = r.relation as Relation}
					{@const on = !hiddenRelations.has(rel)}
					<FilterOptie label={r.label} wrap {on} onToggle={() => onToggleRelation(rel)}>
						{#snippet voor()}
							<!-- As thick as on the canvas at the default zoom, with its arrowhead. -->
							{@const dik = Math.max(lijnDikte(EDGE_WEIGHT[rel]), 1.4)}
							{@const kop = dik * pijlLengte()}
							<svg width="28" height="12" viewBox="0 0 28 12" aria-hidden="true"
								><line
									x1="1"
									y1="6"
									x2={27 - kop}
									y2="6"
									stroke={edgeColorFor(rel, sourceKind(rel))}
									stroke-width={dik}
									stroke-dasharray={dash(rel)}
								/><polygon
									points="{27 - kop},{6 - (kop * PIJL_BREED) / 2} 27,6 {27 - kop},{6 +
										(kop * PIJL_BREED) / 2}"
									fill={edgeColorFor(rel, sourceKind(rel))}
								/></svg
							>{/snippet}
					</FilterOptie>
				{/each}
			</section>
		{/if}
		{@render periode?.()}
		<div class="verder">
			<FoldButton sleutel={MEER} open={meerOpen} controls="netwerk-meer">Meer</FoldButton>
		</div>
		{#if meerOpen}
			<div class="verder__inhoud" id="netwerk-meer">
				{#if meer}<section class="block">{@render meer()}</section>{/if}
				<section class="block">
					<div class="block__label">Voorkeuze</div>
					<TekstMenu
						label="Voorkeuze"
						tekst="Voorkeuze"
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

				<section class="block">
					<h3 class="block__title">Groepering</h3>
					{#each Object.keys(GROUP_LABEL) as ck (ck)}
						{@const kind = ck as ContainerKind}
						<FilterOptie
							label={GROUP_LABEL[kind]}
							title={`${GROUP_LABEL[kind]}: ${CONTAINER_KIND_HINT[kind]}${kind === 'instrument' ? '; uit verbergt ook de artikelen' : ''}`}
							on={kind === 'instrument' ? isOn('artikelen') : !hiddenGroups.has(kind)}
							count={kind === 'instrument' ? (totals.artikelen ?? 0) : null}
							onToggle={() =>
								kind === 'instrument'
									? onFilter(toggleFilterGroup(filter, 'artikelen'))
									: onToggleGroup?.(kind)}
						>
							<!-- As on the canvas: the colour of the group and its own line. -->
							{#snippet voor()}<svg width="22" height="12" viewBox="0 0 22 12" aria-hidden="true">
									<rect
										x="1"
										y="1"
										width="20"
										height="10"
										rx="5"
										fill={hullColorFor(kind)}
										fill-opacity="0.08"
										stroke={hullColorFor(kind)}
										stroke-width="1.5"
										stroke-dasharray={hullDashFor(kind)}
									/>
								</svg>{/snippet}
						</FilterOptie>
					{/each}
				</section>

				<section class="block">
					<!-- The label says what the buttons do; the rest in a title (Thijs, 9 Oct: what the
			     interface makes clear is not written out under it). -->
					<div
						class="block__label"
						title={netwerkActive
							? 'De verbonden bronnen van de gekozen bron erbij; het netwerk blijft'
							: `Stappen vanaf de bron, per stap hooguit ${grens} bronnen`}
					>
						{netwerkActive ? 'Verbonden bronnen' : 'Aantal stappen'}
					</div>
					<Keuze
						label={netwerkActive ? 'Verbonden bronnen' : 'Aantal stappen'}
						waarde={netwerkActive ? null : String(depth)}
						opties={DEPTHS.map((d) => {
							const reden =
								netwerkActive && !selectionCollection
									? NO_SELECTION_REASON
									: beyondCap(d)
										? CAPPED_REASON
										: null;
							return {
								waarde: String(d),
								label: String(d),
								uit: !!reden,
								titel: reden ?? undefined
							};
						})}
						onSelect={(d) => onDepth(Number(d))}
					/>
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
					<div class="block__label">Toon erbij</div>
					<div class="block">
						<TekstMenu
							label="Toon erbij"
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
	/* In the strip at the left of the werkplek: blocks under a rule, as the mockup A197-b. */
	.legend {
		/* The marks of Soort and Relatie in one column, as wide as a line sample. */
		--optie-voor: 28px;
		display: flex;
		flex-direction: column;
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}
	.legend > .block,
	.legend > :global(.block) {
		padding: var(--s-4) 0;
		border-top: 1px solid var(--rule);
	}
	.block__title {
		flex: 1;
		margin: 0 0 var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.verder {
		padding: var(--s-3) 0;
		border-top: 1px solid var(--rule);
	}
	.verder__inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
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

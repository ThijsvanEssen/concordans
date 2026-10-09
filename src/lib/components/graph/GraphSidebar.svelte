<script lang="ts">
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	// The legend of the network, which is also its filter: the bronnen that take part
	// (with counts and the preset), the verbindingen per relation with a line sample,
	// the depth from the focus, the lid, and one line with what is on the canvas and
	// what the filter hides. The overlays are under Meer.
	import { menu } from '$lib/actions/menu';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { HEAT_PERIODS, type Overlay } from '$lib/stores/overlay';
	import type { Collection, Relation } from '$lib/vocabulary';
	import {
		BRON_KINDS,
		BRON_KIND_LABEL,
		PRESETS,
		activePreset,
		bronnenLabel,
		toggleKind,
		withPreset,
		type BronKind,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/source';
	import { allRows, kindTotals, lidCounts, relationCounts } from '$lib/verbonden/view';
	import { edgeColorFor, edgeStyleFor, hullColorFor, hullDashFor } from './nodeSprites';
	import { kindOfCollection } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { BRON_KIND_VORM } from '$lib/bron/vormen';
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
		reach = null
	}: {
		verbonden: VerbondenState;
		filter: VerbondenFilter;
		selectionCollection: Collection | null;
		onFilter: (f: VerbondenFilter) => void;
		onOpenFilter: () => void;
		depth: number;
		onDepth: (d: number) => void;
		hiddenRelations: Set<Relation>;
		onToggleRelation: (r: Relation) => void;
		/** Groupings switched off: no hull around their bronnen. */
		hiddenGroups?: ReadonlySet<ContainerKind>;
		onToggleGroup?: (kind: ContainerKind) => void;
		canvasCounts: {
			kinds?: Partial<Record<BronKind, number>>;
			metGroep?: Partial<
				Record<BronKind, { count: number; van: number; groepen: ContainerKind[] }>
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
	} = $props();

	let presetMenu = $state(false);
	let lidMenu = $state(false);

	// With nothing selected, the kinds count what is on the canvas; with a selection, its
	// verbindingen. While those load the counts say so ("…"), not a column of zeros.
	const fromCanvas = $derived(!selectionCollection);
	const totals = $derived(fromCanvas ? (canvasCounts.kinds ?? {}) : kindTotals(verbonden.groups));
	const counting = $derived(!fromCanvas && verbonden.loading && verbonden.groups.length === 0);

	// Diepte: the steps that add nothing, as the API cut the neighbourhood off at its cap.
	const DEPTHS = [1, 2, 3];
	const grens = $derived(reach?.cap ?? NEIGHBORHOOD_CAP);
	const CAPPED_REASON = $derived(
		`Grens van ${grens} bronnen bereikt; een stap verder voegt niets toe.`
	);
	const beyondCap = (d: number) => !netwerkActive && !!reach?.capped && d > reach.depth;
	const NO_SELECTION_REASON = 'Kies eerst een bron in het netwerk.';
	// Never drawn as an edge on the canvas, so not a togglable line here either.
	// PART_OF, MEMBER_OF and LED_BY always point at a container (a wet, fractie,
	// commissie or dossier) — a hull groups them now, not a line. VERSION_OF links
	// an article's own versions across time; the reader's version nav uses it
	// directly, never the canvas. ABOUT, AMENDS and REPEALS only sometimes point at
	// a container (a document can amend an article, not just a wet) and stay
	// listed, even though the canvas silently folds the container case of those
	// into a hull rather than drawing it — an open gap, not a fix.
	const NEVER_DRAWN_RELATIONS = new Set<Relation>(['PART_OF', 'MEMBER_OF', 'LED_BY', 'VERSION_OF']);
	const relations = $derived(
		selectionCollection
			? relationCounts(verbonden.groups, selectionCollection).filter(
					(r) => !NEVER_DRAWN_RELATIONS.has(r.relation as Relation)
				)
			: []
	);
	const CONTAINER_KIND_LABEL: Record<ContainerKind, string> = {
		instrument: 'Wet',
		faction: 'Fractie',
		committee: 'Commissie',
		dossier: 'Dossier'
	};
	const CONTAINER_KIND_HINT: Record<ContainerKind, string> = {
		instrument: 'een omtrek om de artikelen van een wet',
		faction: 'een omtrek om de leden van een fractie',
		committee: 'een omtrek om de leden van een commissie',
		dossier: 'een omtrek om de stukken van een dossier'
	};

	// On the canvas a wet, dossier, fractie or commissie is a hull, never a bron: the kinds
	// are named by what does stand there (Thijs). Verbonden lists the wetten, dossiers and
	// fracties themselves, and keeps their names; the switch is the same.
	const OP_HET_NETWERK: Partial<Record<BronKind, { label: string; elders: string }>> = {
		wetten: { label: 'Publicaties', elders: 'Wetten' },
		dossiers: { label: 'Overige stukken', elders: 'Dossiers' },
		leden: { label: 'Leden', elders: 'Leden en fracties' }
	};
	const kindLabel = (k: BronKind) => OP_HET_NETWERK[k]?.label ?? BRON_KIND_LABEL[k];
	const kindTitle = (k: BronKind) => {
		const n = OP_HET_NETWERK[k];
		return n ? `${n.label} (in Verbonden: ${n.elders})` : undefined;
	};
	const lids = $derived(
		[...(verbonden.lidTellingen ?? lidCounts(allRows(verbonden.groups)))]
			.map(([k]) => k)
			.filter((k) => k !== '')
			.sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }))
	);
	const isOn = (k: (typeof BRON_KINDS)[number]) => filter.bronnen === null || filter.bronnen.has(k);

	// A kind whose bronnen all went with a grouping switched off stays, greyed: a click
	// switches that grouping on again (Thijs, 9 Oct). Partly hidden, the row is as ever.
	const metGroepUit = (k: BronKind): ContainerKind[] | null => {
		const m = canvasCounts.metGroep?.[k];
		return m && isOn(k) && m.count > 0 && m.count >= m.van ? m.groepen : null;
	};

	const mutOn = $derived(overlay.kind === 'open' || overlay.kind === 'dossier');
	const heatOn = $derived(overlay.kind === 'heat');

	// The line sample of a relation, in the colour of the edge from this bron.
	const sourceKind = (relation: Relation) =>
		kindOfCollection(
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
		<p class="empty">Nog geen bronnen in het netwerk.</p>
	{:else}
		<section class="block">
			<div class="block__head">
				<h3 class="block__title">Bronnen</h3>
				<div class="menu" use:menu={{ open: presetMenu, close: () => (presetMenu = false) }}>
					<button
						type="button"
						class="btn is-text preset"
						aria-haspopup="menu"
						aria-expanded={presetMenu}
						title={bronnenLabel(filter)}
						onclick={() => (presetMenu = !presetMenu)}>Voorkeuze<Caret open={presetMenu} /></button
					>
					{#if presetMenu}
						<div class="menu__list" role="menu">
							{#each PRESETS as p (p.id)}
								<button
									type="button"
									role="menuitemradio"
									aria-checked={activePreset(filter)?.id === p.id}
									class="menu__item"
									class:is-active={activePreset(filter)?.id === p.id}
									onclick={() => {
										onFilter(withPreset(filter, p));
										presetMenu = false;
									}}>{p.label}</button
								>
							{/each}
							<button
								type="button"
								role="menuitem"
								class="menu__item menu__item--more"
								onclick={() => {
									presetMenu = false;
									onOpenFilter();
								}}>Kies bronnen en verbindingen</button
							>
						</div>
					{/if}
				</div>
			</div>
			<!-- Articles are switched with their wet, under Groepering (Thijs, 9 Oct). -->
			{#each BRON_KINDS.filter((b) => b !== 'artikelen') as k (k)}
				{@const n = totals[k] ?? 0}
				{@const groepen = metGroepUit(k)}
				<FilterOptie
					label={kindLabel(k)}
					title={groepen
						? `Aan met ${groepen.map((g) => CONTAINER_KIND_LABEL[g]).join(' en ')}`
						: kindTitle(k)}
					wrap
					on={isOn(k)}
					onToggle={() =>
						groepen ? groepen.forEach((g) => onToggleGroup?.(g)) : onFilter(toggleKind(filter, k))}
					count={counting ? null : n}
					bezig={counting}
					empty={!counting && n === 0}
					gedimd={!!groepen}
				>
					{#snippet voor()}<KindGlyph vorm={BRON_KIND_VORM[k]} size={11} />{/snippet}
				</FilterOptie>
			{/each}
		</section>

		<section class="block">
			<h3 class="block__title">Groepering</h3>
			{#each Object.keys(CONTAINER_KIND_LABEL) as ck (ck)}
				{@const kind = ck as ContainerKind}
				<FilterOptie
					label={CONTAINER_KIND_LABEL[kind]}
					title={`${CONTAINER_KIND_LABEL[kind]}: ${CONTAINER_KIND_HINT[kind]}${kind === 'instrument' ? '; uit verbergt ook de artikelen' : ''}`}
					on={kind === 'instrument' ? isOn('artikelen') : !hiddenGroups.has(kind)}
					count={kind === 'instrument' && !counting ? (totals.artikelen ?? 0) : null}
					bezig={kind === 'instrument' && counting}
					onToggle={() =>
						kind === 'instrument'
							? onFilter(toggleKind(filter, 'artikelen'))
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

		{#if relations.length > 0}
			<section class="block">
				<h3 class="block__title">Verbindingen</h3>
				{#each relations as r (r.relation)}
					{@const rel = r.relation as Relation}
					{@const on = !hiddenRelations.has(rel)}
					<FilterOptie label={r.label} {on} onToggle={() => onToggleRelation(rel)} count={r.count}>
						{#snippet voor()}<svg width="26" height="8" viewBox="0 0 26 8" aria-hidden="true"
								><line
									x1="1"
									y1="4"
									x2="25"
									y2="4"
									stroke={edgeColorFor(rel, sourceKind(rel))}
									stroke-width="1.6"
									stroke-dasharray={dash(rel)}
								/></svg
							>{/snippet}
					</FilterOptie>
				{/each}
			</section>
		{/if}

		<section class="block">
			<!-- The label says what the buttons do; the rest in a title (Thijs, 9 Oct: what the
			     interface makes clear is not written out under it). -->
			<div
				class="block__label"
				title={netwerkActive
					? 'De buren van de gekozen bron erbij; het netwerk blijft'
					: `Stappen vanaf de bron, per stap hooguit ${grens} bronnen`}
			>
				{netwerkActive ? 'Buren' : 'Diepte'}
			</div>
			<div class="chips">
				{#each DEPTHS as d (d)}
					{@const reden =
						netwerkActive && !selectionCollection
							? NO_SELECTION_REASON
							: beyondCap(d)
								? CAPPED_REASON
								: null}
					<button
						type="button"
						class="btn"
						class:is-primary={!netwerkActive && depth === d}
						aria-pressed={!netwerkActive && depth === d}
						disabled={!!reden}
						title={reden ?? undefined}
						onclick={() => onDepth(d)}>{d}</button
					>
				{/each}
			</div>
		</section>

		{#if lids.length > 0}
			<section class="block">
				<div class="block__label">Lid van het artikel</div>
				<div class="menu" use:menu={{ open: lidMenu, close: () => (lidMenu = false) }}>
					<button
						type="button"
						class="btn"
						aria-haspopup="menu"
						aria-expanded={lidMenu}
						onclick={() => (lidMenu = !lidMenu)}
						>{filter.lid === null
							? 'Alle leden'
							: filter.lid === 'geen'
								? 'Lid niet genoemd'
								: `Lid ${filter.lid}`}<Caret open={lidMenu} /></button
					>
					{#if lidMenu}
						<div class="menu__list menu__list--left" role="menu">
							<button
								type="button"
								role="menuitemradio"
								aria-checked={filter.lid === null}
								class="menu__item"
								onclick={() => {
									onFilter({ ...filter, lid: null });
									lidMenu = false;
								}}>Alle leden</button
							>
							{#each lids as lid (lid)}
								<button
									type="button"
									role="menuitemradio"
									aria-checked={filter.lid === lid}
									class="menu__item"
									onclick={() => {
										onFilter({ ...filter, lid });
										lidMenu = false;
									}}>Lid {lid}</button
								>
							{/each}
							<button
								type="button"
								role="menuitemradio"
								aria-checked={filter.lid === 'geen'}
								class="menu__item"
								onclick={() => {
									onFilter({ ...filter, lid: 'geen' });
									lidMenu = false;
								}}>Lid niet genoemd</button
							>
						</div>
					{/if}
				</div>
			</section>
		{/if}

		<section class="block">
			<div class="block__label">Overlay</div>
			<div class="block">
				<div class="chips">
					<button
						type="button"
						class="btn"
						class:is-primary={!mutOn && !heatOn}
						aria-pressed={!mutOn && !heatOn}
						onclick={() => {
							if (mutOn) onToggleMutatie?.();
							else if (heatOn) onToggleHeat?.();
						}}>Geen</button
					>
					<button
						type="button"
						class="btn"
						class:is-primary={mutOn}
						aria-pressed={mutOn}
						disabled={!onToggleMutatie}
						title="Een ring om de bronnen die een wetsvoorstel wil wijzigen"
						onclick={() => {
							if (!mutOn) onToggleMutatie?.();
						}}
						>Open dossiers{#if mutOn && inFluxCount > 0}
							({inFluxCount}){/if}</button
					>
					<button
						type="button"
						class="btn"
						class:is-primary={heatOn}
						aria-pressed={heatOn}
						disabled={!onToggleHeat}
						title="Hoe vaak een bron in de gekozen periode is aangehaald"
						onclick={() => {
							if (!heatOn) onToggleHeat?.();
						}}>Verwijzingen per maand</button
					>
				</div>
				{#if heatOn}
					<div class="chips chips--sub" role="group" aria-label="Periode">
						{#each HEAT_PERIODS as m (m)}
							<button
								type="button"
								class="btn"
								class:is-primary={overlay.kind === 'heat' && overlay.months === m}
								aria-pressed={overlay.kind === 'heat' && overlay.months === m}
								onclick={() => onHeatPeriodChange?.(m)}
								disabled={!onHeatPeriodChange}>{m} maanden</button
							>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	{/if}
</aside>

<style>
	.legend {
		width: 250px;
		flex-shrink: 0;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		gap: 18px;
		padding: 20px 18px;
		border-right: 1px solid var(--rule);
		background: var(--paper);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}
	.block__head {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: var(--s-1);
	}
	.block__title {
		flex: 1;
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.block__head .block__title {
		margin: 0;
	}
	.block__label {
		display: flex;
		justify-content: space-between;
		margin-bottom: 6px;
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	/* The presets of the filter: a plain control, not a summary in the accent. */
	.preset {
		font-size: var(--t-label);
		color: var(--ink-2);
	}
	.menu {
		position: relative;
	}
	.menu__list {
		position: absolute;
		top: calc(100% + 4px);
		right: 0;
		z-index: var(--z-float);
		min-width: 200px;
		padding: 6px 0;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
	}
	.menu__list--left {
		right: auto;
		left: 0;
	}
	.menu__item {
		display: block;
		width: 100%;
		padding: 6px var(--s-3);
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-ui);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.menu__item:hover {
		background: var(--paper-2);
	}
	.menu__item.is-active {
		font-weight: 600;
	}
	.menu__item--more {
		margin-top: var(--s-1);
		padding-top: var(--s-2);
		border-top: 1px solid var(--rule);
		color: var(--ink-2);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 5px;
	}
	.chips--sub {
		margin-top: 6px;
	}
	.empty {
		margin: 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
		line-height: 1.4;
	}
	/* One line that says what a control does, or why it is off. */
</style>

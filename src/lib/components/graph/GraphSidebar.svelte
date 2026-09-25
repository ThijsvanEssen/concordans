<script lang="ts">
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
		formatCount,
		hiddenByKind,
		toggleKind,
		withPreset,
		type BronKind,
		type VerbondenFilter
	} from '$lib/verbonden/filter';
	import type { VerbondenState } from '$lib/verbonden/source';
	import { allRows, hiddenLine, kindTotals, lidCounts, relationCounts } from '$lib/verbonden/view';
	import { edgeColorFor, edgeStyleFor, hullColorFor } from './nodeSprites';
	import { kindOfCollection } from '$lib/graph/types';
	import type { ContainerKind } from '$lib/graph/container-membership';

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
		canvasCounts,
		overlay = { kind: 'none' } as Overlay,
		inFluxCount = 0,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		netwerkActive = false,
		hasNodes = false,
		onResetGraph
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
		canvasCounts: { nodes: number; edges: number; kinds?: Partial<Record<BronKind, number>> };
		overlay?: Overlay;
		inFluxCount?: number;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		/** With a netwerk, a depth adds context around the selection instead of setting the view. */
		netwerkActive?: boolean;
		hasNodes?: boolean;
		onResetGraph?: () => void;
	} = $props();

	let presetMenu = $state(false);
	let lidMenu = $state(false);
	let confirmClear = $state(false);

	// With a netwerk and nothing selected, the kinds count what is on the canvas.
	const fromCanvas = $derived(netwerkActive && !selectionCollection);
	const totals = $derived(fromCanvas ? (canvasCounts.kinds ?? {}) : kindTotals(verbonden.groups));
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
		instrument: 'artikelen',
		faction: 'leden',
		committee: 'leden',
		dossier: 'stukken, zaken'
	};
	const hidden = $derived(
		fromCanvas ? hiddenByKind([], totals, filter) : hiddenLine(verbonden.groups, filter)
	);
	const lids = $derived(
		[...lidCounts(allRows(verbonden.groups)).keys()]
			.filter((k) => k !== '')
			.sort((a, b) => a.localeCompare(b, 'nl', { numeric: true }))
	);
	const isOn = (k: (typeof BRON_KINDS)[number]) => filter.bronnen === null || filter.bronnen.has(k);

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
	<section class="block">
		<div class="block__head">
			<h3 class="block__title">Bronnen</h3>
			<div class="menu" use:menu={{ open: presetMenu, close: () => (presetMenu = false) }}>
				<button
					type="button"
					class="btn is-text preset"
					aria-haspopup="menu"
					aria-expanded={presetMenu}
					onclick={() => (presetMenu = !presetMenu)}
					>{bronnenLabel(filter)}<Caret open={presetMenu} /></button
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
		{#each BRON_KINDS as k (k)}
			{@const n = totals[k] ?? 0}
			<label class="row" class:is-empty={n === 0}>
				<input type="checkbox" checked={isOn(k)} onchange={() => onFilter(toggleKind(filter, k))} />
				<span class="box" aria-hidden="true">{isOn(k) ? '✓' : ''}</span>
				<span class="row__name">{BRON_KIND_LABEL[k]}</span>
				<span class="row__count">{formatCount(n)}</span>
			</label>
		{/each}
	</section>

	<section class="block">
		<h3 class="block__title">Groepering</h3>
		{#each Object.keys(CONTAINER_KIND_LABEL) as ck (ck)}
			{@const kind = ck as ContainerKind}
			<div class="row row--static">
				<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
					<circle
						cx="7"
						cy="7"
						r="6"
						fill={hullColorFor(kind)}
						fill-opacity="0.18"
						stroke={hullColorFor(kind)}
					/>
				</svg>
				<span class="row__name">{CONTAINER_KIND_LABEL[kind]}</span>
				<span class="row__count">{CONTAINER_KIND_HINT[kind]}</span>
			</div>
		{/each}
	</section>

	{#if relations.length > 0}
		<section class="block">
			<h3 class="block__title">Verbindingen</h3>
			{#each relations as r (r.relation)}
				{@const rel = r.relation as Relation}
				{@const on = !hiddenRelations.has(rel)}
				<label class="row">
					<input type="checkbox" checked={on} onchange={() => onToggleRelation(rel)} />
					<span class="box" aria-hidden="true">{on ? '✓' : ''}</span>
					<svg width="26" height="8" viewBox="0 0 26 8" aria-hidden="true"
						><line
							x1="1"
							y1="4"
							x2="25"
							y2="4"
							stroke={edgeColorFor(rel, sourceKind(rel))}
							stroke-width="1.6"
							stroke-dasharray={dash(rel)}
						/></svg
					>
					<span class="row__name">{r.label}</span>
					<span class="row__count">{formatCount(r.count)}</span>
				</label>
			{/each}
		</section>
	{/if}

	<section class="block">
		<div class="block__label">{netwerkActive ? 'Omgeving van de selectie' : 'Diepte'}</div>
		<div class="chips">
			{#each [1, 2, 3] as d (d)}
				<button
					type="button"
					class="btn"
					class:is-primary={!netwerkActive && depth === d}
					onclick={() => onDepth(d)}>{d}</button
				>
			{/each}
			<span class="muted">{netwerkActive ? 'stappen, als context' : 'stappen vanaf de bron'}</span>
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

	<p class="status">
		{formatCount(canvasCounts.nodes)}
		{canvasCounts.nodes === 1 ? 'bron' : 'bronnen'}, {formatCount(canvasCounts.edges)}
		{canvasCounts.edges === 1 ? 'verbinding' : 'verbindingen'} op het doek.
		{#if hidden.length > 0}
			{hidden
				.map((h) => `${formatCount(h.count)} ${BRON_KIND_LABEL[h.kind].toLowerCase()}`)
				.join(', ')} verborgen door het bronfilter.
		{/if}
	</p>

	<details class="more">
		<summary>Meer</summary>
		<div class="block">
			<div class="block__label">Overlay</div>
			<div class="chips">
				<button
					type="button"
					class="btn"
					class:is-primary={!mutOn && !heatOn}
					onclick={() => {
						if (mutOn) onToggleMutatie?.();
						else if (heatOn) onToggleHeat?.();
					}}>Geen</button
				>
				<button
					type="button"
					class="btn"
					class:is-primary={mutOn}
					disabled={!onToggleMutatie}
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
					disabled={!onToggleHeat}
					onclick={() => {
						if (!heatOn) onToggleHeat?.();
					}}>Citaties per maand</button
				>
			</div>
			{#if heatOn}
				<div class="chips chips--sub" role="group" aria-label="Periode">
					{#each HEAT_PERIODS as m (m)}
						<button
							type="button"
							class="btn"
							class:is-primary={overlay.kind === 'heat' && overlay.months === m}
							onclick={() => onHeatPeriodChange?.(m)}
							disabled={!onHeatPeriodChange}>{m} maanden</button
						>
					{/each}
				</div>
			{/if}
		</div>
		{#if hasNodes && onResetGraph}
			<div class="block">
				{#if confirmClear}
					<button
						type="button"
						class="btn"
						onclick={() => {
							confirmClear = false;
							onResetGraph?.();
						}}>Ja, wis het netwerk</button
					>
				{:else}
					<button
						type="button"
						class="btn"
						onclick={() => {
							confirmClear = true;
							setTimeout(() => (confirmClear = false), 4000);
						}}>Wis netwerk</button
					>
				{/if}
			</div>
		{/if}
	</details>
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
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--ink-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}
	.block__head {
		display: flex;
		align-items: baseline;
		gap: 6px;
		margin-bottom: 4px;
	}
	.block__title {
		flex: 1;
		margin: 0 0 4px;
		font-family: var(--font-serif);
		font-size: 16px;
		font-weight: 500;
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
		font-weight: 500;
		color: var(--ink-3);
	}
	.preset {
		font-size: 11.5px;
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
		padding: 6px 12px;
		border: 0;
		background: none;
		font: inherit;
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
		margin-top: 4px;
		padding-top: 8px;
		border-top: 1px solid var(--rule);
		color: var(--ink-2);
	}
	.row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 6px 0;
		cursor: pointer;
	}
	.row.is-empty {
		color: var(--ink-3);
	}
	.row--static {
		cursor: default;
	}
	.row input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
	}
	.box {
		width: 14px;
		height: 14px;
		display: grid;
		place-items: center;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: 10px;
		line-height: 1;
		color: var(--paper);
		flex: none;
	}
	.row input:checked + .box {
		background: var(--ink);
		border-color: var(--ink);
	}
	.row input:focus-visible + .box {
		outline: 2px solid var(--accent);
		outline-offset: 2px;
	}
	.row__name {
		flex: 1;
	}
	.row__count {
		color: var(--ink-3);
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
	.muted {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.status {
		margin: auto 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
		line-height: 1.4;
	}
	.more {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.more summary {
		cursor: pointer;
		font-weight: 500;
	}
	.more .block {
		margin-top: 12px;
	}
</style>

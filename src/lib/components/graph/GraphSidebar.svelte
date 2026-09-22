<script lang="ts">
	// Sidebar of the canvas: overlays, pinned bronnen, hidden bronnen, and the laws on the
	// canvas as a filter. The layers and the legend are the groups of the panel Verbonden.
	import type { GraphFilters } from '$lib/graph/graph-store';
	import type { GraphNode } from '$lib/graph/types';
	import { HEAT_PERIODS, type Overlay } from '$lib/stores/overlay';

	let {
		filters,
		instruments = [] as { bwbId: string; label: string; count: number }[],
		collapseToLaws,
		overlay = { kind: 'none' } as Overlay,
		inFluxCount = 0,
		pinnedNodes = [] as GraphNode[],
		onInstrumentToggle,
		onCollapseToLawsChange,
		onToggleHeat,
		onHeatPeriodChange,
		onToggleMutatie,
		onUnpin,
		onClearPins,
		onResetGraph,
		hasNodes = false,
		hasSelection = false,
		hiddenCount = 0,
		onRevealHidden
	}: {
		filters: GraphFilters;
		instruments?: { bwbId: string; label: string; count: number }[];
		collapseToLaws: boolean;
		overlay?: Overlay;
		/** Bronnen in behandeling, shown while that overlay is active. */
		inFluxCount?: number;
		pinnedNodes?: GraphNode[];
		onInstrumentToggle?: (bwbId: string) => void;
		onCollapseToLawsChange: (v: boolean) => void;
		onToggleHeat?: () => void;
		onHeatPeriodChange?: (months: number) => void;
		onToggleMutatie?: () => void;
		onUnpin?: (nodeId: string) => void;
		onClearPins?: () => void;
		onResetGraph?: () => void;
		hasNodes?: boolean;
		hasSelection?: boolean;
		/** Bronnen the neighbourhood fetch returned that the convergence prune removed. */
		hiddenCount?: number;
		onRevealHidden?: () => void;
	} = $props();

	let confirmClear = $state(false);
	let clearTimer: ReturnType<typeof setTimeout> | null = null;
	function requestClear() {
		confirmClear = true;
		clearTimer = setTimeout(() => (confirmClear = false), 4000);
	}
	function executeClear() {
		confirmClear = false;
		if (clearTimer) clearTimeout(clearTimer);
		onResetGraph?.();
	}

	const mutOn = $derived(overlay.kind === 'open' || overlay.kind === 'dossier');
	const heatOn = $derived(overlay.kind === 'heat');
</script>

<aside class="graph-sidebar">
	<section class="sb-section">
		<div class="sb-head">Overlay</div>
		<div class="sb-seg" role="radiogroup" aria-label="Overlay">
			<button
				type="button"
				class="sb-seg-btn"
				class:sb-seg-btn--active={!mutOn && !heatOn}
				role="radio"
				aria-checked={!mutOn && !heatOn}
				onclick={() => {
					if (mutOn) onToggleMutatie?.();
					else if (heatOn) onToggleHeat?.();
				}}>Geen</button
			>
			<button
				type="button"
				class="sb-seg-btn sb-seg-btn--mutatie"
				class:sb-seg-btn--active={mutOn}
				role="radio"
				aria-checked={mutOn}
				disabled={!onToggleMutatie}
				onclick={() => {
					if (!mutOn) onToggleMutatie?.();
				}}
			>
				In behandeling{#if mutOn && inFluxCount > 0}<span class="sb-seg-count">{inFluxCount}</span
					>{/if}
			</button>
			<button
				type="button"
				class="sb-seg-btn sb-seg-btn--heat"
				class:sb-seg-btn--active={heatOn}
				role="radio"
				aria-checked={heatOn}
				disabled={!onToggleHeat}
				onclick={() => {
					if (!heatOn) onToggleHeat?.();
				}}>Citaties per maand</button
			>
		</div>
		{#if heatOn}
			<div class="sb-heat-period" role="group" aria-label="Periode">
				{#each HEAT_PERIODS as m, i (i)}
					<button
						type="button"
						class="sb-heat-period-btn"
						class:sb-heat-period-btn--active={overlay.kind === 'heat' && overlay.months === m}
						onclick={() => onHeatPeriodChange?.(m)}
						disabled={!onHeatPeriodChange}>{m}m</button
					>
				{/each}
			</div>
		{/if}
	</section>

	{#if pinnedNodes.length > 0}
		<section class="sb-section">
			<div class="sb-head sb-head--pin">
				<span>Vastgepind ({pinnedNodes.length})</span>
				{#if onClearPins}
					<button type="button" class="sb-head-action" onclick={onClearPins}>Wissen</button>
				{/if}
			</div>
			<ul class="sb-pin-list">
				{#each pinnedNodes as p (p.id)}
					<li class="sb-pin-item">
						<span class="sb-pin-label">{p.label}</span>
						{#if onUnpin}
							<button
								type="button"
								class="sb-pin-x"
								onclick={() => onUnpin?.(p.id)}
								aria-label="Losmaken">✕</button
							>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if hasSelection && hiddenCount > 0}
		<section class="sb-section sb-section--focus">
			<div class="sb-focus-row">
				<span class="sb-focus-num">{hiddenCount}</span>
				<span class="sb-focus-label">niet zichtbaar</span>
				{#if onRevealHidden}
					<button type="button" class="sb-focus-action" onclick={() => onRevealHidden?.()}>
						Toon alle
					</button>
				{/if}
			</div>
		</section>
	{/if}

	{#if instruments.length > 1}
		<section class="sb-section sb-section--grow">
			<div class="sb-head sb-head--pin">
				<span>Wetten</span>
				<div class="sb-seg sb-seg--small" role="radiogroup" aria-label="Detail">
					<button
						type="button"
						class="sb-seg-btn"
						class:sb-seg-btn--active={!collapseToLaws}
						role="radio"
						aria-checked={!collapseToLaws}
						onclick={() => onCollapseToLawsChange(false)}>Artikelen</button
					>
					<button
						type="button"
						class="sb-seg-btn"
						class:sb-seg-btn--active={collapseToLaws}
						role="radio"
						aria-checked={collapseToLaws}
						onclick={() => onCollapseToLawsChange(true)}>Wetten</button
					>
				</div>
			</div>
			<div class="sb-inst-list">
				{#each instruments as inst (inst.bwbId)}
					{@const isActive =
						filters.activeInstruments.size > 0 && filters.activeInstruments.has(inst.bwbId)}
					<button
						type="button"
						class="sb-inst-row"
						class:sb-inst-row--active={isActive}
						onclick={() => onInstrumentToggle?.(inst.bwbId)}
						aria-pressed={isActive}
					>
						<span class="sb-inst-label">{inst.label}</span>
						<span class="sb-inst-count">{inst.count}</span>
					</button>
				{/each}
			</div>
		</section>
	{/if}

	{#if hasNodes && onResetGraph}
		<section class="sb-section">
			{#if confirmClear}
				<button type="button" class="sb-head-action sb-head-action--danger" onclick={executeClear}
					>Ja, wis het netwerk</button
				>
			{:else}
				<button type="button" class="sb-head-action" onclick={requestClear}>Wis netwerk</button>
			{/if}
		</section>
	{/if}
</aside>

<style>
	.graph-sidebar {
		width: 200px;
		flex-shrink: 0;
		height: 100%;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
		border-right: 1px solid var(--rule);
		background: var(--paper-2);
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}

	.sb-section {
		padding: var(--s-4) 0 var(--s-3);
		border-bottom: 1px solid var(--rule);
		flex-shrink: 0;
	}

	.sb-section--grow {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.sb-head {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.09em;
		text-transform: uppercase;
		color: var(--fg-3);
		padding: 0 var(--s-4) var(--s-2);
	}

	.sb-inst-list {
		flex: 1;
		min-height: 0;
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--rule) transparent;
	}

	.sb-inst-row {
		display: flex;
		align-items: center;
		width: 100%;
		padding: 5px var(--s-4);
		background: none;
		border: none;
		cursor: pointer;
		text-align: left;
		gap: var(--s-2);
		transition: background var(--dur-1) var(--ease);
	}

	.sb-inst-row:hover {
		background: var(--paper-3);
	}

	.sb-inst-row--active {
		background: color-mix(in srgb, var(--accent) 8%, transparent);
	}

	.sb-inst-row--active:hover {
		background: color-mix(in srgb, var(--accent) 14%, transparent);
	}

	.sb-inst-label {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		flex: 1;
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sb-inst-row--active .sb-inst-label {
		color: var(--accent);
	}

	.sb-inst-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--fg-3);
		flex-shrink: 0;
	}

	.sb-inst-row--active .sb-inst-count {
		color: var(--accent);
	}

	.sb-head--pin {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sb-head-action {
		background: none;
		border: none;
		font-family: var(--font-sans);
		font-size: 10px;
		text-transform: none;
		letter-spacing: normal;
		color: var(--ink-4);
		cursor: pointer;
		padding: 0;
	}

	.sb-head-action:hover {
		color: var(--spine);
	}

	.sb-pin-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.sb-pin-item {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 3px var(--s-4);
	}

	.sb-pin-label {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 12px;
		color: var(--ink-2);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.sb-pin-x {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--ink-4);
		font-size: 11px;
		padding: 0 4px;
	}

	.sb-pin-x:hover {
		color: var(--spine);
	}

	.sb-section--focus {
		padding-bottom: var(--s-3);
	}

	.sb-focus-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 0 var(--s-3);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
	}

	.sb-focus-num {
		font-family: var(--font-mono);
		font-size: 12px;
		font-weight: 600;
		color: var(--ink);
		min-width: 26px;
		text-align: right;
	}

	.sb-focus-label {
		color: var(--ink-4);
		letter-spacing: 0.02em;
	}

	.sb-focus-action {
		width: calc(100% - 2 * var(--s-3));
		margin: 8px var(--s-3) 0;
		padding: 6px 10px;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.sb-focus-action:hover {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.sb-head-action--danger {
		color: var(--spine);
	}

	.sb-head-action--danger:hover {
		color: var(--spine);
		opacity: 0.75;
	}

	.sb-seg {
		display: grid;
		grid-template-columns: 1fr 1fr 1fr;
		margin: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		overflow: hidden;
		background: var(--paper);
	}

	.sb-seg-btn {
		position: relative;
		padding: 5px 6px;
		background: var(--paper);
		border: 0;
		border-right: 1px solid var(--rule-strong);
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-3);
		cursor: pointer;
		text-align: center;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.sb-seg-btn:last-child {
		border-right: 0;
	}

	.sb-seg-btn:hover:not(.sb-seg-btn--active):not(:disabled) {
		background: var(--paper-2);
		color: var(--ink);
	}

	.sb-seg-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.sb-seg-btn--active {
		background: var(--ink);
		color: var(--paper);
		font-weight: 500;
	}

	.sb-seg-btn--mutatie.sb-seg-btn--active {
		background: var(--spine, #7a1f1a);
		border-color: var(--spine, #7a1f1a);
	}

	.sb-seg-btn--heat.sb-seg-btn--active {
		background: var(--teal, #1f5a56);
		border-color: var(--teal, #1f5a56);
	}

	.sb-seg-count {
		margin-left: 4px;
		padding: 0 4px;
		border-radius: 7px;
		background: color-mix(in srgb, currentColor 22%, transparent);
		font-family: var(--font-mono);
		font-variant-numeric: tabular-nums;
		font-size: 9px;
		line-height: 1.4;
	}

	.sb-heat-period {
		display: flex;
		gap: 4px;
		margin: 6px 2px 4px;
	}

	.sb-heat-period-btn {
		flex: 1;
		height: 22px;
		padding: 0 6px;
		background: var(--paper);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-3);
		cursor: pointer;
	}

	.sb-heat-period-btn:hover {
		background: var(--paper-3);
		color: var(--ink);
	}

	.sb-heat-period-btn--active {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.sb-seg--small {
		margin: 0;
	}
</style>

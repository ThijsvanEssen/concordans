<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { formatCount } from '$lib/text/getal';
	import { axisLabels } from '../years-axis';
	import type { ViewProps } from '../lists/list';
	import type { JudgmentsState } from '../lists/judgments';

	// The judgments per year under the filters, the last forty, as columns; a bar filters on
	// its year, the chosen one in ink, the ones outside the period pale.
	let { ctx }: ViewProps<Schema<'JudgmentListItemDTO'>, JudgmentsState> = $props();

	const years = $derived(
		(ctx.state.facets?.year ?? [])
			.flatMap((f) => (f.value ? [{ year: f.value, count: f.count }] : []))
			.sort((a, b) => a.year.localeCompare(b.year))
			.slice(-40)
	);
	/** The width of the year axis, for the labels that fit (`axisLabels`). */
	let axisWidth = $state(0);
</script>

{#if years.length > 1}
	{@const max = Math.max(...years.map((y) => y.count))}
	{@const { from, to } = ctx.p}
	<figure class="years">
		<div class="years-bars">
			{#each years as { year, count } (year)}
				{@const on = from === `${year}-01-01` && to === `${year}-12-31`}
				{@const inRange = (!from || `${year}-12-31` >= from) && (!to || `${year}-01-01` <= to)}
				<button
					type="button"
					class="years-bar"
					class:years-bar--on={on}
					class:years-bar--out={!inRange}
					style:height="{Math.max(2, (count / max) * 100)}%"
					title="{year}: {formatCount(count)} uitspraken"
					aria-label="{year}: {formatCount(count)} uitspraken"
					aria-pressed={on}
					onclick={() =>
						ctx.patch({
							from: on ? null : `${year}-01-01`,
							to: on ? null : `${year}-12-31`
						})}
				></button>
			{/each}
		</div>
		<figcaption class="years-axis" bind:clientWidth={axisWidth}>
			{#each axisLabels( years.map((y) => y.year), axisWidth ) as label, i (years[i].year)}
				<span>{label}</span>
			{/each}
		</figcaption>
	</figure>
{/if}

<style>
	.years {
		margin: 0 0 var(--s-4);
	}
	.years-bars {
		display: flex;
		align-items: flex-end;
		gap: 2px;
		height: 96px;
		border-bottom: 1px solid var(--rule-strong);
	}
	.years-bar {
		flex: 1;
		min-width: 0;
		padding: 0;
		border: 0;
		background: var(--indigo);
		opacity: 0.55;
		cursor: pointer;
		transition: opacity var(--dur-1) var(--ease);
	}
	.years-bar:hover,
	.years-bar--on {
		opacity: 1;
	}
	.years-bar--out {
		background: var(--rule-strong);
		opacity: 1;
	}
	.years-bar:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
	.years-axis {
		display: flex;
		gap: 2px;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-label); /* a chart's own labels, below the ladder: docs/typografie.md */
		color: var(--ink-3);
	}
	.years-axis span {
		flex: 1;
		min-width: 0;
		overflow: visible;
		white-space: nowrap;
	}
	/* The last year ends at the edge and runs inward, never past it. */
	.years-axis span:last-child {
		display: flex;
		justify-content: flex-end;
	}
</style>

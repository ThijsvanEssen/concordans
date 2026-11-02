<svelte:options namespace="svg" />

<script lang="ts">
	// What stands behind the lanes: the panel of each column with its head, the strip Algemene
	// wetten, the heads in Wetten, the cards of Wie maakt; on a phone the one line that counts who makes.
	import { sortColour } from '$lib/bron/rubrieken';
	import { COLUMN_SORT, COLUMN_TITLE, LANE_SORT, LANE_TITLE } from '$lib/graph/lane-columns';
	import { CONTENT_TOP, type LaneLayout } from '$lib/graph/lane-layout';
	import type { Scene } from '$lib/graph/scene';

	let { layout, phone, scene }: { layout: LaneLayout; phone: boolean; scene: Scene } = $props();
</script>

{#each layout.columns as c (c.column)}
	{#if phone}
		<rect
			class="panel"
			x={c.x}
			y={c.y}
			width={c.width}
			height={c.height}
			rx="12"
			style:--tint={sortColour(COLUMN_SORT[c.column])}
		/>
		<text class="col-head" x={c.x + 12} y={c.y + 22}>{COLUMN_TITLE[c.column]}</text>
		<rect
			class="col-bar"
			x={c.x + 12}
			y={c.y + 29}
			width="120"
			height="3"
			rx="1.5"
			fill={sortColour(COLUMN_SORT[c.column])}
		/>
	{:else}
		<rect
			class="panel"
			x={c.x - 14}
			y={CONTENT_TOP - 52}
			width={c.width + 28}
			height={c.height + 52 + 14}
			rx="12"
			style:--tint={sortColour(COLUMN_SORT[c.column])}
		/>
		<text class="col-head" x={c.x} y={CONTENT_TOP - 26}>{COLUMN_TITLE[c.column]}</text>
		<rect
			class="col-bar"
			x={c.x}
			y={CONTENT_TOP - 18}
			width={c.width}
			height="3"
			rx="1.5"
			fill={sortColour(COLUMN_SORT[c.column])}
		/>
	{/if}
{/each}
{#if layout.strip}
	{@const s = layout.strip}
	<rect
		class="panel"
		x={s.x}
		y={s.y}
		width={s.width}
		height={s.height}
		rx="12"
		style:--tint="var(--rubriek-wetten)"
	/>
	<text class="col-head" x={s.x + 14} y={s.y + 24}>Algemene wetten</text>
{/if}
{#each layout.heads as h (h.label)}
	<text class="lane-head law-head" x={h.x} y={h.y}>{h.label}</text>
{/each}
{#each layout.lanes as l (l.lane)}
	<rect
		class="lane"
		x={l.x}
		y={l.y}
		width={l.width}
		height={l.height}
		rx="8"
		stroke={sortColour(LANE_SORT[l.lane])}
	/>
	<text class="lane-head" x={l.x + 8} y={l.y + 16}>{LANE_TITLE[l.lane]}</text>
{/each}
{#if phone}
	{#each layout.columns.filter((c) => c.column === 'makers') as c (c.column)}
		{@const makers = scene.units.filter((u) => u.column === 'makers' && !u.general)}
		{@const byLane = (['government', 'council', 'parliament'] as const)
			.map((lane) => [lane, makers.filter((u) => u.lane === lane).length] as const)
			.filter(([, k]) => k > 0)}
		<text class="summary" x={c.x + 12} y={c.y + c.height - 14}
			>{byLane
				.map(
					([lane, k]) =>
						`${k} ${lane === 'council' ? LANE_TITLE[lane] : LANE_TITLE[lane].toLowerCase()}`
				)
				.join(', ')}</text
		>
	{/each}
{/if}

<style>
	.panel {
		fill: color-mix(in srgb, var(--tint) 4.5%, transparent);
	}
	.col-head {
		font-size: var(--t-micro);
		font-weight: 600;
		fill: var(--ink);
	}
	.lane {
		fill: var(--paper);
		stroke-opacity: 0.35;
	}
	.lane-head {
		font-size: var(--t-label);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		fill: var(--ink-2);
	}
	.law-head {
		paint-order: stroke;
		stroke: var(--paper);
		stroke-width: 3px;
		stroke-linejoin: round;
	}
	.summary {
		font-size: var(--t-note);
		fill: var(--ink-2);
	}
</style>

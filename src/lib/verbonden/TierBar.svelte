<script lang="ts">
	// The judgments per instantie as one bar and its legend (A202, A208c): the one form on an
	// article and on a law, in the summary and in the group. The legend is a table: the name at
	// the left, its count at the right in one column of figures; two columns where the panel
	// has the room, one on a phone. Its room stands while the counts come (`pending`).
	import { formatCount } from '$lib/text/getal';
	import type { TierCount } from './tiers';

	let { parts, pending = false }: { parts: TierCount[] | null; pending?: boolean } = $props();

	/** The share of each part of the bar, the largest darkest. */
	const SHADES = [1, 0.7, 0.45, 0.22];
	/** While the counts come: four rows of the legend, unseen. */
	const HELD = [0, 1, 2, 3].map((i) => ({ label: `…${i}`, count: 0 }));
	const rows = $derived(parts?.length ? parts : pending ? HELD : []);
</script>

{#if rows.length}
	<div class="tiers" class:is-quiet={!parts?.length} aria-hidden={!parts?.length}>
		<div class="tiers__bar">
			{#each rows as t, j (t.label)}
				<i style:flex="{t.count || 1} 1 0" style:opacity={SHADES[j] ?? 0.22}></i>
			{/each}
		</div>
		<ul class="tiers__legend" aria-label="Per instantie">
			{#each rows as t, j (t.label)}
				<li>
					<span class="tiers__swatch" style:opacity={SHADES[j] ?? 0.22}></span><span
						class="tiers__name">{t.label}</span
					><span class="tiers__count">{formatCount(t.count)}</span>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.tiers__bar {
		display: flex;
		gap: 2px;
		height: var(--s-2);
		margin: 0 0 var(--s-2);
	}
	.tiers__bar i {
		display: block;
		height: 100%;
		background: var(--indigo);
	}
	/* While the counts come: the room, no figures. */
	.is-quiet {
		visibility: hidden;
	}
	.tiers__legend {
		display: grid;
		grid-template-columns: repeat(
			auto-fill,
			minmax(min(100%, calc(2 * var(--s-8) + var(--s-6) + var(--s-4))), 1fr)
		);
		gap: 0 var(--s-4);
		margin: 0;
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: var(--s-5);
		color: var(--ink-3);
	}
	.tiers__legend li {
		display: grid;
		grid-template-columns: var(--s-2) minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--s-2);
	}
	.tiers__swatch {
		width: var(--s-2);
		height: var(--s-2);
		background: var(--indigo);
	}
	.tiers__name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
	}
	.tiers__count {
		color: var(--ink);
		text-align: right;
		font-variant-numeric: tabular-nums;
	}
	/* On a phone one column: a row a tier. */
	@media (max-width: 768px) {
		.tiers__legend {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>

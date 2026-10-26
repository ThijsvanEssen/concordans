<script lang="ts">
	// The judgments per instantie as one bar and its legend (A202, A208c, A255): the one form on
	// an article and on a law, in the summary and in the group. The legend is a table: the name
	// at the left, its count at the right in one column of figures; two columns where the panel
	// has the room, one on a phone. Where one instantie is all there is, no bar: one line. Its
	// room stands while the counts come (`pending`).
	import { formatCount } from '$lib/text/getal';
	import TierSwatch from './TierSwatch.svelte';
	import { eenInstantie, type TierCount } from './tiers';

	let { parts, pending = false }: { parts: TierCount[] | null; pending?: boolean } = $props();

	/** While the counts come: four rows of the legend, unseen. */
	const HELD: TierCount[] = [0, 1, 2, 3].map((i) => ({
		tier: null,
		label: `…${i}`,
		count: 0,
		trap: null,
		europa: false,
		van: ''
	}));
	const rows = $derived(parts?.length ? parts : pending ? HELD : []);
	const eenRegel = $derived(eenInstantie(parts));
</script>

{#if eenRegel}
	<p class="tiers__een">{eenRegel}</p>
{:else if rows.length}
	<div class="tiers" class:is-quiet={!parts?.length} aria-hidden={!parts?.length}>
		<div class="tiers__bar" aria-hidden="true">
			{#each rows as t (t.label)}
				<span class="tiers__deel" style:flex="{t.count || 1} 1 0"><TierSwatch vorm={t} balk /></span
				>
			{/each}
		</div>
		<ul class="tiers__legend" aria-label="Per instantie">
			{#each rows as t (t.label)}
				<li>
					<TierSwatch vorm={t} /><span class="tiers__name">{t.label}</span><span
						class="tiers__count">{formatCount(t.count)}</span
					>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
	.tiers__bar {
		display: flex;
		gap: 2px;
		height: var(--s-3);
		margin: 0 0 var(--s-2);
	}
	.tiers__deel {
		display: block;
		min-width: 0;
	}
	/* While the counts come: the room, no figures. */
	.is-quiet {
		visibility: hidden;
	}
	.tiers__een {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: var(--s-5);
		color: var(--ink-3);
	}
	.tiers__legend {
		display: grid;
		grid-template-columns: repeat(
			auto-fill,
			minmax(min(100%, calc(2 * var(--s-8) + var(--s-6) + var(--s-4))), 1fr)
		);
		gap: 0 var(--s-4);
		margin: 0 0 var(--s-2);
		padding: 0;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: var(--s-5);
		color: var(--ink-3);
	}
	.tiers__legend li {
		display: grid;
		grid-template-columns: var(--s-3) minmax(0, 1fr) auto;
		align-items: center;
		gap: var(--s-2);
	}
	.tiers__name {
		min-width: 0;
		overflow: hidden;
		white-space: nowrap;
		text-overflow: ellipsis;
		color: var(--ink-2);
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

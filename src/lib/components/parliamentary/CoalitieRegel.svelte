<script lang="ts">
	// What the coalition did on a vote of the Tweede Kamer, as a line under its row (concept 24,
	// variant A; Thijs, 10 Oct): "Coalitie tegen" where it voted as one, "Coalitie verdeeld" with
	// its fracties per side where it did not (their seats where the fracties are not known), and
	// the source's own words for a wisselmeerderheid and a coalition that decided the outcome
	// (`pattern`, `decisive`, API 0.79.45, #546). The line itself is coalitionLine (coalitie.ts).
	import type { Schema } from '$lib/api/types';
	import Uitkomst from './Uitkomst.svelte';
	import { coalitionLine } from './coalitie';

	let {
		coalitie,
		fracties = []
	}: {
		coalitie: Schema<'CoalitionVoteDTO'>;
		fracties?: Schema<'CoalitionFactionDTO'>[];
	} = $props();

	const line = $derived(coalitionLine(coalitie, fracties));
</script>

{#if line}
	<dl class="coal" class:coal--eensgezind={!!line.together}>
		{#if line.together}
			{@const kant = line.together.choice.toLowerCase()}
			<div class="regel">
				<dt class="kop"><Uitkomst tone={line.together.outcome} title="" />Coalitie</dt>
				<dd>{kant}</dd>
				{#each line.labels as l (l)}<dd class="label">{l}</dd>{/each}
			</div>
		{:else}
			<div class="regel">
				<dt class="kop">Coalitie</dt>
				<dd class="kop">verdeeld</dd>
				{#each line.labels as l (l)}<dd class="label">{l}</dd>{/each}
			</div>
			{#each line.sides as z (z.choice)}
				<div class="zijde">
					<dt><Uitkomst tone={z.outcome} title={z.choice.toLowerCase()} /></dt>
					<dd>{z.names.length ? z.names.join(', ') : `${z.seats} zetels`}</dd>
				</div>
			{/each}
			{#if line.splitFactions.length}
				<div class="zijde">
					<dt>{line.splitFactions.join(', ')}</dt>
					<dd>verdeeld</dd>
				</div>
			{/if}
		{/if}
	</dl>
{/if}

<style>
	.coal {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.kop {
		font-weight: 600;
		color: var(--ink);
	}
	/* As one: the line says it in the plain weight; a split is what the eye looks for. */
	.coal--eensgezind .kop {
		font-weight: 400;
		color: var(--ink-2);
	}
	.coal--eensgezind :global(.uk) {
		margin-right: var(--s-2);
	}
	.coal dt,
	.coal dd {
		display: inline;
		margin: 0;
	}
	.regel {
		display: inline;
	}
	.zijde {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
	}
	.zijde dt,
	.zijde dd {
		display: block;
	}
	.coal .label {
		margin-left: var(--s-3);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

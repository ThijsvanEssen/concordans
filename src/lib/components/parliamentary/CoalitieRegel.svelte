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
	<p class="coal" class:coal--eensgezind={!!line.together}>
		{#if line.together}
			{@const kant = line.together.choice.toLowerCase()}
			<Uitkomst soort={line.together.outcome} title={kant} /><span class="kop">Coalitie {kant}</span
			>
		{:else}
			<span class="kop">Coalitie verdeeld</span>
			{#each line.sides as z (z.choice)}
				<span class="zijde"
					><Uitkomst soort={z.outcome} title={z.choice.toLowerCase()} />{z.names.length
						? z.names.join(', ')
						: `${z.seats} zetels`}</span
				>
			{/each}
			{#if line.splitFactions.length}<span class="zijde"
					>{line.splitFactions.join(', ')} verdeeld</span
				>{/if}
		{/if}
		{#each line.labels as l (l)}<span class="label">{l}</span>{/each}
	</p>
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
		margin-right: calc(-1 * var(--s-1));
	}
	.zijde {
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-1);
	}
	.label {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

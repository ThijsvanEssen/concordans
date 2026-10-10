<script lang="ts">
	// What the coalition did on a vote of the Tweede Kamer, as a line under its row (concept 24,
	// variant A; Thijs, 10 Oct): "Coalitie tegen" where it voted as one, "Coalitie verdeeld" with
	// its fracties per side where it did not, and the source's own words for a wisselmeerderheid
	// and a coalition that decided the outcome (`pattern`, `decisive`, API 0.79.45, #546). Where
	// the feed has no fracties yet (older votes until the weekly run) the line says the pattern.
	import type { Schema } from '$lib/api/types';
	import Uitkomst from './Uitkomst.svelte';
	import { naamVanId } from '$lib/bron/menselijk';

	let {
		coalitie,
		fracties = []
	}: {
		coalitie: Schema<'CoalitionVoteDTO'>;
		fracties?: Schema<'FeedCoalitionFactionDTO'>[];
	} = $props();

	const eensgezind = $derived(coalitie.pattern === 'together');
	const kant = $derived(coalitie.coalition_for > 0 ? 'voor' : 'tegen');
	const naam = (f: Schema<'FeedCoalitionFactionDTO'>) => f.short ?? naamVanId(`factions/${f.key}`);
	const zijden = $derived(
		(
			[
				['ja', 'Voor'],
				['nee', 'Tegen']
			] as const
		)
			.map(([soort, keuze]) => ({
				soort,
				keuze,
				namen: fracties.filter((f) => f.choice === keuze).map(naam)
			}))
			.filter((z) => z.namen.length > 0)
	);
	/** A fractie whose seats went both ways (a roll call). */
	const gesplitst = $derived(fracties.filter((f) => f.choice == null).map(naam));
	const labels = $derived(
		[
			coalitie.pattern === 'wissel' ? 'wisselmeerderheid' : null,
			coalitie.decisive ? 'doorslaggevend' : null
		].filter((l): l is string => !!l)
	);
</script>

<p class="coal" class:coal--eensgezind={eensgezind}>
	{#if eensgezind}
		<Uitkomst soort={kant === 'voor' ? 'ja' : 'nee'} titel={kant} /><span class="kop"
			>Coalitie {kant}</span
		>
	{:else}
		<span class="kop">Coalitie verdeeld</span>
		{#each zijden as z (z.keuze)}
			<span class="zijde"
				><Uitkomst soort={z.soort} titel={z.keuze.toLowerCase()} />{z.namen.join(', ')}</span
			>
		{/each}
		{#if gesplitst.length}<span class="zijde">{gesplitst.join(', ')} verdeeld</span>{/if}
	{/if}
	{#each labels as l (l)}<span class="label">{l}</span>{/each}
</p>

<style>
	.coal {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 2px var(--s-3);
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
		gap: 6px;
	}
	.label {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

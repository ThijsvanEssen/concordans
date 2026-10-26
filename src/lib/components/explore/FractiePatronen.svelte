<script lang="ts">
	// The patterns of the fracties in one hall, as SVG <defs>: the colour of the fractie with
	// white hatching, dots or lines over it (partijkleuren: patroonVan). A seat takes one with
	// `fill="url(#…)"`, through `vullingVan`.
	import { fractieKleuren, patroonVan, patroonId } from './partijkleuren.svelte';

	let { prefix, namen }: { prefix: string; namen: readonly string[] } = $props();
	const met = $derived(
		[...new Set(namen)]
			.map((naam) => ({ naam, patroon: patroonVan(naam), kleur: fractieKleuren(naam)?.[0] }))
			.filter((p) => p.patroon !== 'vol' && p.kleur)
	);
</script>

<defs>
	{#each met as p (p.naam)}
		<pattern id={patroonId(prefix, p.naam)} patternUnits="userSpaceOnUse" width="4" height="4">
			<rect width="4" height="4" fill={p.kleur} />
			{#if p.patroon === 'arcering'}
				<path
					d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
					stroke="var(--paper)"
					stroke-opacity="0.75"
					stroke-width="1"
				/>
			{:else if p.patroon === 'stippen'}
				<circle cx="2" cy="2" r="0.9" fill="var(--paper)" fill-opacity="0.85" />
			{:else}
				<path d="M0,2 h4" stroke="var(--paper)" stroke-opacity="0.75" stroke-width="1" />
			{/if}
		</pattern>
	{/each}
</defs>

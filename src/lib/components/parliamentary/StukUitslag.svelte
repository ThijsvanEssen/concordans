<script lang="ts">
	// The outcome of a motie or amendement on its row, the same on every list of Kamerstukken
	// (Verbonden, Bronnen, Gemarkeerd): "aangenomen 150–0 op 31 mrt. 2026", a link to the
	// stemming; "vervangen door nr. 31", a link to that stuk. Only "verworpen" in red, as every
	// "nee" at rest (Thijs, 10 Oct). Words from stuk-uitslag.ts.
	import BronLink from '$lib/bron/BronLink.svelte';
	import { nrWoord, tussen } from './vervanging';
	import { uitslagTekst, type StukUitslag } from './stuk-uitslag';

	let { uitslag: u }: { uitslag: StukUitslag } = $props();

	const woorden = $derived(uitslagTekst(u));
</script>

<span class="uitslag" class:uitslag--nee={u.uitkomst === 'verworpen'}
	>{#if u.uitkomst === 'vervangen' && u.vervangers.length}vervangen door {nrWoord(u.vervangers)}
		{#each u.vervangers as v, i (v.key)}{tussen(i, u.vervangers.length)}<BronLink
				ref={{ collection: 'documents', key: v.key }}>{v.nummer}</BronLink
			>{/each}{:else if u.besluit}<BronLink ref={{ collection: 'decisions', key: u.besluit }}
			>{woorden}</BronLink
		>{:else}{woorden}{/if}</span
>

<style>
	.uitslag :global(a) {
		color: inherit;
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.uitslag :global(a:hover) {
		color: var(--ink);
		border-bottom-color: currentColor;
	}
	.uitslag--nee,
	.uitslag--nee :global(a),
	.uitslag--nee :global(a:hover) {
		color: var(--uitkomst-nee);
	}
</style>

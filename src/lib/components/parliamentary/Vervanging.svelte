<script lang="ts">
	// The chain of an amended amendment or motion in the status line of its reader, in the
	// source's own words: "Vervangt nr. 10.", "Vervangen door nr. 47." Each number is a BronLink,
	// so it opens in place (vervanging.ts).
	import BronLink from '$lib/bron/BronLink.svelte';
	import { nrWoord, tussen, type Zin } from './vervanging';

	let { zinnen }: { zinnen: Zin[] } = $props();
</script>

{#each zinnen as z (z.woord)}<span class="vervanging"
		>{z.woord}
		{nrWoord(z.nrs)}
		{#each z.nrs as n, i (n.key)}{tussen(i, z.nrs.length)}<BronLink
				ref={{ collection: 'documents', key: n.key }}>{n.nummer}</BronLink
			>{/each}.</span
	>
{/each}

<style>
	/* A number is a link, marked as the indieners above it are: a rule under it, on touch too. */
	.vervanging :global(a) {
		color: var(--ink);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}
	.vervanging :global(a:hover) {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>

<script lang="ts">
	import { separatorBefore } from '$lib/text/words';
	// The chain of an amended amendment or motion in the status line of its reader, in the
	// source's own words: "Vervangt nr. 10.", "Vervangen door nr. 47." Each number is a BronLink,
	// so it opens in place (vervanging.ts).
	import BronLink from '$lib/bron/BronLink.svelte';
	import { numberWord, type Replacement } from '$lib/text/vervanging';

	let { zinnen }: { zinnen: Replacement[] } = $props();
</script>

{#each zinnen as z (z.woord)}<span class="vervanging"
		>{z.woord}
		{numberWord(z.nrs)}
		{#each z.nrs as n, i (n.key)}{separatorBefore(i, z.nrs.length)}<BronLink
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

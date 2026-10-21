<script lang="ts">
	// A law a transposition table names by its title: plain text first, a link once the API
	// knows it by that name (`named-law.ts`); a name it does not know stays text.
	import BronLink from '$lib/bron/BronLink.svelte';
	import { bronHref } from '$lib/bron/href';
	import { namedLaw } from './named-law';

	let { name }: { name: string } = $props();
</script>

{#await namedLaw(name)}{name}{:then law}{#if law}<BronLink ref={law.id} href={bronHref(law.id)}
			>{name}</BronLink
		>{:else}{name}{/if}{/await}

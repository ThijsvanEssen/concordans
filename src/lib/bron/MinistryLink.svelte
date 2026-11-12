<script lang="ts">
	// The ministry a wet, a dossier or a toezegging names, as a link to its page: the one form
	// on all three (guards/ministerie.test.ts). The name comes with the record
	// (`ministry_name`); where it is missing, the list of ministries gives it.
	import BronLink from './BronLink.svelte';
	import { ministryName } from '$lib/components/explore/index/ministries.svelte';

	let {
		ministry,
		name = null,
		class: className = ''
	}: {
		/** The key of the ministry: `fin`. */
		ministry: string | null | undefined;
		/** Its name as the record gives it: `Financiën`. */
		name?: string | null;
		/** `raak-rij` in a line of a list: a finger's 44 px, as NameLink there. */
		class?: string;
	} = $props();
</script>

{#if ministry}<BronLink ref={`ministries/${ministry}`} class={className}
		>{name ?? ministryName(ministry)}</BronLink
	>{/if}

<script lang="ts">
	// Running text of the procedure in which the terms that have a definition (a hamerstuk, a nota
	// naar aanleiding van het verslag) stand dotted, with the definition on hover.
	import { splitTerms } from '$lib/glossary';
	import GlossaryPill from './GlossaryPill.svelte';

	let { tekst }: { tekst: string } = $props();
	const delen = $derived(splitTerms(tekst));
</script>

{#each parts as d, i (i)}{#if d.term}<GlossaryPill
			term={d.term}
			label={d.text}
		/>{:else}{d.text}{/if}{/each}

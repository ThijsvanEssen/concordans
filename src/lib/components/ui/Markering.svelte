<script lang="ts">
	// A text with the words a reader follows or searched for marked, as $lib/text/treffer finds
	// them: the wash of a passage's cited words (RowOpen, MapInhoud), in the text's own colour.
	import type { Deel } from '$lib/text/treffer';

	let { delen }: { delen: readonly Deel[] } = $props();
</script>

{#each delen as d, n (n)}{#if d.mark}<mark>{d.tekst}</mark>{:else}{d.tekst}{/if}{/each}

<style>
	mark {
		background: var(--wassing);
		color: inherit;
	}
</style>

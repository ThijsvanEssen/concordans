<script lang="ts">
	// The passage of a citing text with the words that name the bron marked: one way to show it
	// under a row (Verbonden), in a row opened (RowOpen) and on the card Verbinding.
	import type { Passage } from './passage';

	let { passage, class: klasse = '' }: { passage: Passage; class?: string } = $props();
</script>

<span class="aanhaling {klasse}"
	>{passage.before}{#if passage.mark}<mark>{passage.mark}</mark>{/if}{passage.after}</span
>

<style>
	.aanhaling mark {
		background: var(--wassing);
		color: var(--ink);
	}
</style>

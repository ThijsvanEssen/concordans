<script lang="ts">
	// The passage of a citing text with the words that name the bron marked: one way to show it
	// under a row (Verbonden), in a row opened (RowOpen) and on the card Verbinding.
	import type { PassageParts } from './passage';

	let { passage }: { passage: PassageParts } = $props();
</script>

<span class="aanhaling"
	>{passage.before}{#if passage.mark}<mark>{passage.mark}</mark>{/if}{passage.after}</span
>

<style>
	.aanhaling mark {
		background: var(--wassing);
		color: var(--ink);
	}
</style>

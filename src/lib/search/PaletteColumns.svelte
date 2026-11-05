<script lang="ts">
	// The list of ⌘K, and on a wide screen beside it the row the keys are on (PalettePreview); one column on a phone and in a field that picks.
	import type { Snippet } from 'svelte';

	let { two, children, aside }: { two: boolean; children: Snippet; aside?: Snippet } = $props();
</script>

<div class="columns" class:columns--two={two}>
	{@render children()}
	{#if two && aside}<div class="aside">{@render aside()}</div>{/if}
</div>

<style>
	.columns {
		display: flex;
		flex-direction: column;
		flex: 1;
		min-height: 0;
	}
	.aside {
		display: none;
	}
	@media (min-width: 1024px) {
		.columns--two {
			/* One height, whatever the list holds or the right column reads: nothing moves. */
			flex: 1 1 26rem;
			display: grid;
			grid-template-columns: minmax(0, 1fr) 17rem;
			grid-template-rows: minmax(0, 1fr);
		}
		.columns--two .aside {
			display: flex;
			min-height: 0;
		}
	}
</style>

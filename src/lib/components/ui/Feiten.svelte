<script lang="ts">
	// The facts of a bron as a list of label and value: the labels on one edge, the values on
	// another. Each row is a Veld, which drops out when its value is missing.
	import type { Snippet } from 'svelte';

	let {
		klein = false,
		children
	}: {
		/** Labels as wide as their text and values in the sans, for a short list beside a portrait. */
		klein?: boolean;
		children: Snippet;
	} = $props();
</script>

<dl class="feiten" class:klein>
	{@render children()}
</dl>

<style>
	.feiten {
		display: grid;
		grid-template-columns: 10em minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
	}
	.feiten :global(dt) {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.feiten :global(dd) {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.klein {
		grid-template-columns: max-content minmax(0, 1fr);
		line-height: var(--lh-snug);
	}
	.klein :global(dd) {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
</style>

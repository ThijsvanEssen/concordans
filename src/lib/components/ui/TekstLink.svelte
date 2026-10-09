<script lang="ts">
	// Going somewhere, in the text's own letter: Alle 244 uitspraken, Wis alle filters, Vorige
	// (docs/bediening.md). Ink, underlined on hover; red only on hover and focus. A link where
	// it leads to an address, a button where it acts on the page.
	import type { Snippet } from 'svelte';

	let {
		href,
		onclick,
		class: className = '',
		children
	}: {
		href?: string;
		onclick?: (e: MouseEvent) => void;
		class?: string;
		children: Snippet;
	} = $props();
</script>

{#if href}
	<a class="tekstlink {className}" {href} data-sveltekit-noscroll {onclick}>{@render children()}</a>
{:else}
	<button type="button" class="tekstlink {className}" {onclick}>{@render children()}</button>
{/if}

<style>
	.tekstlink {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
		text-align: left;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.tekstlink:hover,
	.tekstlink:focus-visible {
		color: var(--accent);
		text-decoration-color: currentColor;
	}
</style>

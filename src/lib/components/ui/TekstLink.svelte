<script lang="ts">
	// Going somewhere, in the text's own letter: Alle 244 uitspraken, Wis alle filters, Vorige
	// (docs/bediening.md). Ink, underlined; red only on hover and focus; the size of the text
	// around it. A link where it leads to an address, a button where it acts on the page. On a
	// touch screen it has the shared target (.raakvlak, lib/styles/basis.css).
	import type { Snippet } from 'svelte';

	let {
		href,
		onclick,
		class: className = '',
		children,
		...rest
	}: {
		href?: string;
		onclick?: (e: MouseEvent) => void;
		class?: string;
		children: Snippet;
		/** What else the element carries: `aria-expanded`, `disabled`, `rel`. */
		[attr: string]: unknown;
	} = $props();
</script>

{#if href}
	<a class="tekstlink raakvlak {className}" {href} data-sveltekit-noscroll {onclick} {...rest}
		>{@render children()}</a
	>
{:else}
	<button type="button" class="tekstlink raakvlak {className}" {onclick} {...rest}
		>{@render children()}</button
	>
{/if}

<style>
	.tekstlink {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-family: var(--font-serif);
		color: var(--ink);
		text-align: left;
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.tekstlink:disabled {
		color: var(--ink-3);
		text-decoration: none;
		cursor: default;
	}
	.tekstlink:hover:not(:disabled),
	.tekstlink:focus-visible {
		color: var(--ink);
		text-decoration-color: currentColor;
	}
</style>

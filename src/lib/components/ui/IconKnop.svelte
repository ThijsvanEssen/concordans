<script lang="ts">
	// The one icon button: 24 px, a frame, for +, ×, zoom and ⋯ (docs/bediening.md). It always
	// names what it does, for a screen reader and on hover.
	import type { Snippet } from 'svelte';

	let {
		label,
		onclick,
		aan = false,
		disabled = false,
		class: className = '',
		children
	}: {
		/** What it does: `Aan het netwerk toevoegen`. */
		label: string;
		onclick?: (e: MouseEvent) => void;
		/** A switch that is on (the bron is in the network): filled in ink. */
		aan?: boolean;
		disabled?: boolean;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class="iconknop {className}"
	class:aan
	aria-label={label}
	aria-pressed={aan || undefined}
	title={label}
	{disabled}
	{onclick}>{@render children()}</button
>

<style>
	.iconknop {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: var(--veld-h-klein);
		height: var(--veld-h-klein);
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		line-height: 1;
		color: var(--ink-2);
		cursor: pointer;
	}
	.iconknop:hover:not(:disabled),
	.iconknop:focus-visible {
		border-color: var(--ink);
		color: var(--ink);
	}
	.iconknop.aan {
		border-color: var(--ink);
		background: var(--ink);
		color: var(--paper);
	}
	.iconknop:disabled {
		color: var(--rule);
		cursor: default;
	}
</style>

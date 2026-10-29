<script lang="ts">
	// The one icon button: 32 px (a finger's 44), a frame, for +, ×, zoom and ⋯ (docs/bediening.md). It always
	// names what it does, for a screen reader and on hover.
	import type { Snippet } from 'svelte';

	let {
		label,
		onclick,
		disabled = false,
		keys = null,
		class: className = '',
		children
	}: {
		/** What it does: `Aan het netwerk toevoegen`. */
		label: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		/** Its key, as the page shows it and as aria-keyshortcuts names it: `['Esc', 'Escape']`. */
		keys?: readonly [cap: string, aria: string] | null;
		class?: string;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class="iconknop {className}"
	aria-label={label}
	aria-keyshortcuts={keys?.[1]}
	title={keys ? `${label} (${keys[0]})` : label}
	{disabled}
	{onclick}>{@render children()}</button
>

<style>
	.iconknop {
		flex: none;
		display: inline-grid;
		place-items: center;
		width: var(--veld-h);
		height: var(--veld-h);
		padding: 0;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-ui);
		font-size: var(--t-teken);
		line-height: 1;
		color: var(--ink-2);
		cursor: pointer;
	}
	.iconknop:hover:not(:disabled),
	.iconknop:focus-visible {
		border-color: var(--ink);
		color: var(--ink);
	}
	.iconknop:disabled {
		color: var(--rule);
		cursor: default;
	}
	@media (pointer: coarse), (max-width: 768px) {
		.iconknop {
			width: var(--veld-h-raak);
			height: var(--veld-h-raak);
			font-size: var(--t-teken-raak);
		}
	}
</style>

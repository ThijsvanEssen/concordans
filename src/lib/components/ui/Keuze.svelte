<script lang="ts" generics="T extends string">
	// One choice among a few, as a joined row of buttons: the chosen one filled in ink, the
	// others with a border. The one form for every segmented choice in Concordans (the
	// Netwerk and Tekst switch, the Kamer, the depth of a network).
	import type { Snippet } from 'svelte';

	type Optie = { waarde: T; label: string; titel?: string; uit?: boolean };

	let {
		opties,
		waarde,
		onKies,
		label,
		klein = false,
		voor
	}: {
		opties: Optie[];
		waarde: T | null;
		onKies: (w: T) => void;
		/** What is chosen, for a screen reader: `Weergave`, `Kamer`. */
		label: string;
		/** In a bar (the status bar): a step smaller. */
		klein?: boolean;
		/** Something before the label of an option, such as a Picto. */
		voor?: Snippet<[T]>;
	} = $props();
</script>

<div class="keuze" class:klein role="group" aria-label={label}>
	{#each opties as o (o.waarde)}
		<button
			type="button"
			aria-pressed={waarde === o.waarde}
			disabled={o.uit}
			title={o.titel}
			onclick={() => waarde !== o.waarde && onKies(o.waarde)}
			>{@render voor?.(o.waarde)}{o.label}</button
		>
	{/each}
</div>

<style>
	.keuze {
		display: inline-flex;
		border: 1px solid var(--ink);
		border-radius: var(--r-1);
		overflow: hidden;
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 0;
		background: var(--paper);
		font: inherit;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	.klein button {
		height: var(--veld-h-klein);
		padding: 0 var(--s-2);
		font-size: var(--t-micro);
	}
	button + button {
		border-left: 1px solid var(--ink);
	}
	button:hover:not(:disabled):not([aria-pressed='true']) {
		background: var(--paper-2);
	}
	button[aria-pressed='true'] {
		background: var(--ink);
		color: var(--paper);
		cursor: default;
	}
	button:disabled {
		color: var(--ink-3);
		cursor: default;
	}
	button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>

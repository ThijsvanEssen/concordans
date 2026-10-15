<script lang="ts" generics="T extends string">
	// One choice among a few, as a joined row of buttons: the chosen one filled in ink, the
	// others with a border. The one form for every segmented choice in Concordans (the
	// Netwerk and Tekst switch, the Kamer, the depth of a network).
	import type { Option } from './option';
	import type { Snippet } from 'svelte';

	let {
		opties,
		waarde,
		onKies,
		label,
		klein = false,
		vol = false,
		voor
	}: {
		opties: Option<T>[];
		waarde: T | null;
		onKies: (w: T) => void;
		/** What is chosen, for a screen reader: `Weergave`, `Kamer`. */
		label: string;
		/** In a tight spot (the switch beside the band): a step smaller. */
		klein?: boolean;
		/** The full width of its column, every option as wide as the others (a period). */
		vol?: boolean;
		/** Something before the label of an option, such as a Picto. */
		voor?: Snippet<[T]>;
	} = $props();
</script>

<div class="keuze" class:klein class:vol role="group" aria-label={label}>
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
	/* The frame counts in the height: a Keuze stands as high as a field beside it. */
	.keuze {
		box-sizing: border-box;
		display: inline-flex;
		height: var(--veld-h);
		border: 1px solid var(--ink);
		border-radius: var(--r-1);
		overflow: hidden;
	}
	button {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
		padding: 0 var(--s-3);
		border: 0;
		background: var(--paper);
		font: inherit;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		font-weight: 500;
		color: var(--ink);
		cursor: pointer;
	}
	/* A mark in an option (a KindGlyph) is in the option's own colour: paper on the chosen
	   one, which is filled in ink (Thijs, 10 Oct: the marks vanished there). */
	button :global(.kind-glyph),
	button :global(.picto) {
		color: currentColor;
	}
	.keuze.klein {
		height: var(--veld-h-klein);
	}
	.klein button {
		padding: 0 var(--s-2);
		font-size: var(--t-ui-micro);
	}
	/* Equal where the words fit, a word that needs more takes it: no empty tail, no word
	   cut (Kwartaal in a 240px column). */
	.vol {
		display: flex;
		width: 100%;
	}
	.vol button {
		flex: 1 1 0;
		min-width: max-content;
		justify-content: center;
		padding: 0 var(--s-1);
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
	/* An option that does not apply here (Tekst for a dossier): plainly out of reach, word
	   and picture alike, not a third shade of ink that reads as a button that does nothing. */
	button:disabled {
		color: var(--rule);
		cursor: not-allowed;
	}
	button:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: 2px;
	}
</style>

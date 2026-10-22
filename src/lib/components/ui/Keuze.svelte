<script lang="ts" generics="T extends string">
	// One choice among a few, as a joined row of buttons: the chosen one on paper-2 with an ink
	// line under it, the others on paper (ink is filled only for a screen's one action). The
	// one form for every segmented choice in Concordans (the Netwerk and Tekst switch, the Kamer,
	// the depth of a network).
	import type { Option } from './option';
	import type { Snippet } from 'svelte';

	let {
		opties,
		waarde,
		onSelect,
		label,
		vol = false,
		voor
	}: {
		opties: Option<T>[];
		waarde: T | null;
		onSelect: (w: T) => void;
		/** What is chosen, for a screen reader: `Weergave`, `Kamer`. */
		label: string;
		/** The full width of its column, every option as wide as the others (a period). */
		vol?: boolean;
		/** Something before the label of an option, such as a Picto. */
		voor?: Snippet<[T]>;
	} = $props();
</script>

<div class="keuze" class:vol role="group" aria-label={label}>
	{#each opties as o (o.waarde)}
		<button
			type="button"
			class="raakvlak-knop"
			aria-pressed={waarde === o.waarde}
			disabled={o.uit}
			title={o.titel}
			onclick={() => waarde !== o.waarde && onSelect(o.waarde)}
			>{@render voor?.(o.waarde)}{o.label}</button
		>
	{/each}
</div>

<style>
	/* A segment wears the frame of a Knop (basis.css): the frame counts in the height, so a Keuze
	   stands as high as a field beside it. */
	.keuze {
		box-sizing: border-box;
		display: inline-flex;
		height: var(--veld-h);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
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
	/* A mark in an option (a KindGlyph) is in the option's own colour. */
	button :global(.kind-glyph),
	button :global(.picto) {
		color: currentColor;
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
		border-left: 1px solid var(--rule-strong);
	}
	/* The ends follow the frame's corners: no overflow to clip them, so a finger's target
	   (.raakvlak-knop) reaches out of the frame. */
	button:first-child {
		border-radius: var(--r-1) 0 0 var(--r-1);
	}
	button:last-child {
		border-radius: 0 var(--r-1) var(--r-1) 0;
	}
	button:only-child {
		border-radius: var(--r-1);
	}
	button:hover:not(:disabled):not([aria-pressed='true']) {
		background: var(--paper-2);
	}
	/* The chosen one is not filled in ink (that is for the one action of a screen): paper-2
	   with an ink line under it. */
	button[aria-pressed='true'] {
		background: var(--paper-2);
		box-shadow: inset 0 -2px 0 var(--ink);
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

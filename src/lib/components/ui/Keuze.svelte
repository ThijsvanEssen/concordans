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
		rijen = false,
		voor
	}: {
		opties: Option<T>[];
		waarde: T | null;
		onSelect: (w: T) => void;
		/** What is chosen, for a screen reader: `Weergave`, `Kamer`. */
		label: string;
		/** The full width of its column, every option as wide as the others (a period). */
		vol?: boolean;
		/** On a phone the options in rows of two (Verband: the pairs of three bronnen). */
		rijen?: boolean;
		/** Something before the label of an option, such as a Picto. */
		voor?: Snippet<[T]>;
	} = $props();
</script>

<div class="keuze" class:vol class:rijen role="group" aria-label={label}>
	{#each opties as o (o.waarde)}
		<button
			type="button"
			aria-pressed={waarde === o.waarde}
			disabled={o.uit}
			title={o.titel}
			aria-label={o.name}
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
	   cut (Kwartaal in a 240px column). Where the row is too narrow for all of them in one line
	   (Aantal stappen in the 260px column of a netwerk), a label breaks between its words
	   rather than the row reaching past its column. */
	.vol {
		display: flex;
		width: 100%;
	}
	.vol button {
		flex: 1 1 auto;
		min-width: 0;
		justify-content: center;
		text-align: center;
		line-height: 1.1;
		padding: 0 var(--s-1);
	}
	button + button {
		border-left: 1px solid var(--rule-strong);
	}
	/* The ends follow the frame's corners: no overflow to clip them. */
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
	/* On a touch screen the segments are a finger's 44 px themselves, no hidden target. */
	@media (pointer: coarse), (max-width: 768px) {
		/* The frame is drawn inside as an outline, so it takes no room: the segments are 44 px
		   themselves, not 42 inside a border. */
		.keuze {
			height: var(--veld-h-raak);
			border: 0;
			outline: 1px solid var(--rule-strong);
			outline-offset: -1px;
		}
		button {
			font-size: var(--t-ui-raak);
		}
		button[aria-pressed='true'] {
			box-shadow: inset 0 -3px 0 var(--ink);
		}
		/* A row the width of its column keeps the desktop letter, so its words still fit
		   (six scopes on the start page at 375). */
		.vol button {
			font-size: var(--t-ui);
		}
		/* In rows of two: equal cells, a rule between the cells and between the rows. */
		.rijen {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			height: auto;
		}
		.rijen button {
			min-height: var(--veld-h-raak);
			min-width: 0;
			border-left: 0;
			border-radius: 0;
		}
		.rijen button:nth-child(even) {
			border-left: 1px solid var(--rule-strong);
		}
		.rijen button:nth-child(n + 3) {
			border-top: 1px solid var(--rule-strong);
		}
	}
</style>

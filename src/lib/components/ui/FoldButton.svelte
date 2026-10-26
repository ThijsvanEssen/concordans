<script lang="ts">
	// The heading of a section or a group as the button that opens and closes it: its words,
	// then the caret pointing right while closed. What it opens is kept under `sleutel`
	// (dicht.svelte.ts), never under its words: a heading renamed keeps what opens it.
	import type { Snippet } from 'svelte';
	import Caret from './Caret.svelte';
	import { zetOpen } from './dicht.svelte';

	let {
		sleutel,
		open,
		controls,
		children
	}: {
		sleutel: string;
		/** Whether it stands open now: `isOpen(sleutel, default)`, as its section draws. */
		open: boolean;
		/** The id of what it opens. */
		controls?: string;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class="fold-knop raakvlak"
	aria-expanded={open}
	aria-controls={open ? controls : undefined}
	onclick={() => zetOpen(sleutel, !open)}>{@render children()}<Caret {open} side /></button
>

<style>
	/* The heading is the button: its own letter, no frame, its words aligned as the heading's. */
	.fold-knop {
		display: inline-flex;
		align-items: inherit;
		gap: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	/* On a touch screen its target (.raakvlak) reaches past the heading: over the row under it,
	   not under it. */
	@media (pointer: coarse), (max-width: 768px) {
		.fold-knop {
			z-index: 1;
		}
	}
	.fold-knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: var(--onderstreping);
	}
	/* The caret stands a gap (--s-2) after the count, level with the line, whole on hover. */
	.fold-knop :global(.caret) {
		align-self: center;
		margin-left: 0;
	}
	.fold-knop:hover :global(.caret) {
		opacity: 1;
	}
</style>

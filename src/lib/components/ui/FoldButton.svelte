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
		label,
		quiet = false,
		children
	}: {
		sleutel: string;
		/** Whether it stands open now: `isOpen(sleutel, default)`, as its section draws. */
		open: boolean;
		/** The id of what it opens. */
		controls?: string;
		/** For a screen reader, where the words are not the heading's (a count). */
		label?: string;
		/** The quiet form beside a name: a count in the letter of a control. */
		quiet?: boolean;
		children: Snippet;
	} = $props();
</script>

<button
	type="button"
	class="fold-knop"
	class:quiet
	aria-expanded={open}
	aria-controls={open ? controls : undefined}
	aria-label={label}
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
	.fold-knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.fold-knop.quiet {
		gap: 0;
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-3);
	}
	.fold-knop.quiet:hover {
		text-decoration-line: none;
	}
</style>

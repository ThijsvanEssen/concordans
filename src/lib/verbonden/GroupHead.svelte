<script lang="ts">
	// The head of a group of Verbonden: its heading opens and closes it (remembered per group,
	// Sectie's rule), its count follows, and in the network its layer control stands at the
	// right. Without `onToggle` it is the head of a group still to come, as it will stand.
	import type { Snippet } from 'svelte';
	import Caret from '$lib/components/ui/Caret.svelte';

	let {
		label,
		count,
		open,
		onToggle,
		actions
	}: {
		label: string;
		count: string;
		open: boolean;
		onToggle?: () => void;
		/** The network control of the group, at the right of the head. */
		actions?: Snippet;
	} = $props();

	// The last word keeps the caret with it: an SVG after text wraps alone (Thijs, 10 Oct: "de
	// nieuwe regel hier is niet mooi").
	const begin = $derived(label.replace(/\S+$/, ''));
	const slot = $derived(label.match(/\S+$/)?.[0] ?? '');
</script>

<!-- The count follows the heading; when the heading wraps, it stands on the first line's right,
     by the box. -->
<div class="group__head" data-rij={onToggle ? '' : undefined}>
	<h3 class="group__label">
		<button
			type="button"
			class="group__knop"
			tabindex={onToggle ? undefined : -1}
			aria-expanded={onToggle ? open : undefined}
			onclick={onToggle}>{begin}<span class="group__slot">{slot}<Caret {open} side /></span></button
		>
	</h3>
	<span class="group__count">{count}</span>
	{#if actions}
		<span class="group__laag">{@render actions()}</span>
	{/if}
</div>

<style>
	.group__head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding: var(--s-4) var(--s-4) var(--s-1);
	}
	.group__label {
		flex: 0 1 auto;
		min-width: 0;
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	/* A block, not inline: a button inline is an inline-block, whose baseline is its last
	   line, and the count and the box would follow a wrapped heading down to it. The caret
	   follows the last word in the slot. */
	.group__knop {
		display: block;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
		text-align: left;
	}
	.group__knop:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.group__slot {
		white-space: nowrap;
	}
	.group__count {
		flex: none;
		color: var(--ink-3);
	}
	/* The network glyph at the right of a group's heading (RijActies). */
	.group__laag {
		margin-left: auto;
		flex: none;
		/* Outside the line: the head keeps one height with or without it, so the rows below do
		   not move when it appears with the group's rows (UX-toets e7a2f95, #1: 9 px). */
		align-self: center;
		margin-block: calc(-1 * var(--s-2));
	}
</style>

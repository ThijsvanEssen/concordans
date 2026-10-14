<script lang="ts">
	// A card that floats by what it belongs to (a link, a formula): in the top layer, placed and
	// closed by actions/top-layer.ts, on paper with a rule and a shadow. A `glance` (the preview
	// of a bron) takes no pointer and scrolls nothing; a `list` (the regulations of a formula)
	// scrolls where it is long; a `text` (an r.o.) has a wider measure and scrolls within itself.
	import type { Snippet } from 'svelte';
	import type { HTMLAttributes } from 'svelte/elements';
	import { topLayer } from '$lib/actions/top-layer';

	let {
		anchor,
		onclose,
		detach = false,
		kind,
		tag = 'div',
		element = $bindable(null),
		class: className = '',
		children,
		...rest
	}: {
		/** What the card hangs from. */
		anchor: HTMLElement;
		/** Closes the card: its anchor has scrolled out of view. */
		onclose: () => void;
		/** Moved to the end of the body: out of a text whose style it would inherit. */
		detach?: boolean;
		kind: 'glance' | 'list' | 'text';
		/** `span` within a line of text, where a `div` may not stand. */
		tag?: 'div' | 'span';
		element?: HTMLElement | null;
		class?: string;
		children: Snippet;
	} & HTMLAttributes<HTMLElement> = $props();
</script>

<svelte:element
	this={tag}
	bind:this={element}
	class="floating-card is-{kind} {className}"
	use:topLayer={{ anchor, close: onclose, detach }}
	{...rest}>{@render children()}</svelte:element
>

<style>
	.floating-card {
		position: fixed;
		inset: auto;
		margin: 0;
		z-index: var(--z-float);
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		width: min(44ch, calc(100vw - 2 * var(--s-2)));
		max-height: var(--room);
		padding: var(--s-3);
		overflow-y: auto;
		overscroll-behavior: contain;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		color: var(--ink);
		font-family: var(--font-serif);
		font-style: normal;
		font-weight: normal;
		text-align: left;
		white-space: normal;
	}
	.is-glance {
		gap: var(--s-1);
		overflow: hidden;
		pointer-events: none;
	}
	.is-text {
		width: min(64ch, calc(100vw - 2 * var(--s-2)));
		max-height: min(60vh, 480px, var(--room));
		padding: var(--s-3) var(--s-4);
	}
</style>

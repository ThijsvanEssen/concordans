<script lang="ts">
	// The card of a footnote's marker (FootnoteLink): the note's text with its links, read where the
	// marker stands, and the way to the note under the text. It stands in the top layer by the
	// marker, outside the text that holds it (FloatingCard), and scrolls within itself where the
	// note is long.
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
	import type { Note } from '$lib/text/voetnoten';
	import CitedText from './CitedText.svelte';

	let {
		note,
		href,
		anchor,
		element = $bindable(null),
		onpointerenter,
		onpointerleave,
		onfocusout,
		onclose,
		ongo
	}: {
		note: Note;
		/** The note under the text: `#fn-1`. */
		href: string;
		anchor: HTMLElement;
		element?: HTMLElement | null;
		onpointerenter?: () => void;
		onpointerleave?: () => void;
		onfocusout?: (e: FocusEvent) => void;
		/** Closes the card: its marker has scrolled out of view. */
		onclose: () => void;
		/** Goes to the note under the text. */
		ongo: () => void;
	} = $props();

	/** The link goes to the note in place. Its own listener: the card stands outside the app
	 *  (detach), where a delegated onclick does not reach. */
	function go(link: HTMLElement) {
		const click = (e: MouseEvent) => {
			e.preventDefault();
			ongo();
		};
		link.addEventListener('click', click);
		return () => link.removeEventListener('click', click);
	}
</script>

<FloatingCard
	kind="text"
	detach
	{anchor}
	{onclose}
	bind:element
	role="dialog"
	tabindex={-1}
	aria-label="Voetnoot {note.label}"
	{onpointerenter}
	{onpointerleave}
	{onfocusout}
>
	<p class="text">
		<span class="number">{note.label}</span><CitedText
			text={note.text}
			citations={note.citations}
		/>
	</p>
	<p class="onward">
		<a {href} {@attach go}>Naar de voetnoot</a>
	</p>
</FloatingCard>

<style>
	.text {
		margin: 0;
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
		white-space: pre-line;
	}
	.number {
		margin-right: var(--s-1);
		color: var(--ink-3);
	}
	.onward {
		margin: 0;
		font-size: var(--t-meta);
	}
	.onward a {
		color: var(--ink);
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: var(--underline-offset);
	}
	.onward a:hover,
	.onward a:focus-visible {
		text-decoration-color: currentColor;
	}
</style>

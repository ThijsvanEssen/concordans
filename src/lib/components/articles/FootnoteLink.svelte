<script lang="ts" module>
	import { Lazy } from '$lib/util/lazy.svelte';

	// The card comes in a chunk of its own, asked when the pointer or the focus reaches a marker.
	const footnoteCard = new Lazy(() => import('./FootnoteCard.svelte'), 'Kaart');
</script>

<script lang="ts">
	// The marker of a footnote of an article or a bijlage: the note comes to the reader. Hover
	// or focus shows its card after a moment (HoverCard, as a reference's card), the note's text
	// with its links; a click goes to the note under the text, in place. On touch the first tap
	// shows the card and the second goes; the card's own link goes too. Escape, a scroll or a
	// tap outside close it (cardCloser).
	import { HoverCard, cardCloser } from '$lib/actions/hover-card.svelte';
	import { plainClick } from '$lib/actions/klik';
	import { noteJump } from '$lib/text/voetnoten.svelte';
	import type { NoteMarker } from '$lib/text/voetnoten';

	let { marker }: { marker: NoteMarker & { href: string } } = $props();

	const jump = noteJump();
	const target = $derived(
		marker.href.startsWith('#') ? decodeURIComponent(marker.href.slice(1)) : ''
	);
	// A card only where the note is known; the marker goes to it all the same.
	const hover = new HoverCard(() => !!marker.note);
	let anchorEl = $state<HTMLElement | null>(null);
	let cardEl = $state<HTMLElement | null>(null);
	const inside = (t: EventTarget | null) =>
		t instanceof Node && (!!anchorEl?.contains(t) || !!cardEl?.contains(t));

	$effect(() => {
		if (!hover.open) return;
		return cardCloser({
			anchor: () => anchorEl,
			card: () => cardEl,
			close: () => hover.close(),
			readable: true
		});
	});

	function enter() {
		if (!marker.note) return;
		footnoteCard.load();
		hover.enter();
	}

	/** To the note under the text, in place: the reader lands there. */
	function toNote() {
		hover.close();
		if (target && jump) jump(target);
	}

	/** On touch the first tap shows the note; the second, or a click, goes to it. */
	function onclick(e: MouseEvent) {
		if (marker.note) footnoteCard.load();
		if (hover.tap()) return e.preventDefault();
		if (!target || !jump || !plainClick(e)) return;
		e.preventDefault();
		jump(target);
	}
</script>

<a
	class="noot-ref__knop"
	class:is-open={hover.open}
	href={marker.href}
	aria-label="Voetnoot {marker.label}"
	aria-expanded={marker.note ? hover.open : undefined}
	bind:this={anchorEl}
	onpointerenter={(e) => {
		hover.pointer(e.pointerType);
		enter();
	}}
	onpointerleave={() => hover.leave()}
	onpointerdown={(e) => hover.pointer(e.pointerType)}
	onfocus={enter}
	onblur={(e) => {
		// Focus that leaves for the card stays; for nowhere (a tap elsewhere) too.
		if (e.relatedTarget === null || inside(e.relatedTarget)) return;
		hover.close();
	}}
	{onclick}
	onkeydown={() => hover.keys()}>{marker.label}</a
>{#if hover.open && anchorEl && marker.note && footnoteCard.component}{@const FootnoteCard =
		footnoteCard.component}<FootnoteCard
		note={marker.note}
		href={marker.href}
		anchor={anchorEl}
		bind:element={cardEl}
		onpointerenter={() => hover.enter()}
		onpointerleave={() => hover.leave()}
		onfocusout={(e: FocusEvent) => {
			if (e.relatedTarget !== null && !inside(e.relatedTarget)) hover.close();
		}}
		onclose={() => hover.close()}
		ongo={toNote}
	/>{/if}

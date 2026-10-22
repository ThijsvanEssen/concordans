<script lang="ts" module>
	import { Lazy } from '$lib/util/lazy.svelte';

	// The cards come in a chunk of their own, asked when the pointer or the focus reaches a
	// link: the moment before a card shows covers it, and a page of links loads without them.
	const overwegingCard = new Lazy(() => import('./OverwegingKaart.svelte'), 'Kaart');
	const previewCard = new Lazy(() => import('./PreviewCard.svelte'), 'Kaart');
</script>

<script lang="ts">
	// A reference to a bron, the same everywhere. A click opens the bron in Tekst, its reader
	// with Verbonden beside it (besluit 32, openHref); its network is one step further.
	// Hover or focus shows its card after a moment (HoverCard): a glance (PreviewCard), or for a
	// judgment at an r.o. (`at` rov-…) the overweging itself, a card to read (OverwegingKaart,
	// Thijs 14 Oct). Escape closes either; a tap outside closes the card to read, a focus that
	// leaves for nowhere does not (actions/menu.ts).
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { focusIn } from './address';
	import { focusOf, openHref, type BronRef } from './href';
	import type { Preview } from './preview';
	import { HoverCard, cardCloser } from '$lib/actions/hover-card.svelte';
	import { isOverwegingRef } from '$lib/text/anchor';
	import { zetMarkering, type Markering } from './markering.svelte';

	let {
		ref,
		at = null,
		preview = true,
		voorbeeld = null,
		extra = null,
		doel = null,
		noot = null,
		markering = null,
		href: naar = null,
		class: className = '',
		title,
		children
	}: {
		ref: BronRef | string;
		/** A position in the bron: `lid-2`, `rov-4.2`. */
		at?: string | null;
		/** No card on hover where the reference itself already says all (a list of names). */
		preview?: boolean;
		/** The card itself, where the reference is not a bron's own (a defined term). */
		voorbeeld?: Preview | null;
		/** One line more on the card: the definition a citation's words name. */
		extra?: string | null;
		/** The bron an r.o.'s card is read for: its citations in the overweging marked. */
		doel?: string | null;
		/** The note at the r.o. the citation stands in (`fn-35`): open in its card. */
		noot?: string | null;
		/** What the reader marks where the link opens it (markering.svelte.ts). */
		markering?: Markering | null;
		/** Where the link goes, where not to the bron's own reader: beside the article. */
		href?: string | null;
		class?: string;
		title?: string;
		children: Snippet;
	} = $props();

	const uid = $props.id();
	let anker = $state<HTMLElement | null>(null);
	let kaart = $state<HTMLElement | null>(null);

	// A reference into the bron on screen is a jump within the page.
	const id = $derived(focusOf(ref));
	const inPage = $derived(!!at && !!id && focusIn(page.url) === id);
	const href = $derived(naar ?? (inPage ? `#${at}` : openHref(ref, { at })));

	// The card of an r.o.: the overweging, a card to read rather than a glance.
	const ro = $derived(preview && !voorbeeld && isOverwegingRef(id, at));
	const hover = new HoverCard(() => ro);
	const binnen = (t: EventTarget | null) =>
		t instanceof Node && (!!anker?.contains(t) || !!kaart?.contains(t));

	// Open: what closes a card closes it (cardCloser), a tap outside only a card to read.
	$effect(() => {
		if (!hover.open) return;
		return cardCloser({
			anchor: () => anker,
			card: () => kaart,
			close: () => hover.close(),
			readable: ro
		});
	});

	const loadCard = () => (ro ? overwegingCard : previewCard).load();
	function enter() {
		if (!preview) return;
		loadCard();
		hover.enter();
	}

	/** Focus that leaves for the card to read stays; for nowhere (a tap on the canvas) too. */
	function onblur(e: FocusEvent) {
		if (ro && (e.relatedTarget === null || binnen(e.relatedTarget))) return;
		hover.close();
	}

	/** On touch the first tap shows the r.o.; the second, or one on the card's link, goes. */
	function onclick(e: MouseEvent) {
		if (preview) loadCard();
		if (hover.tap()) return e.preventDefault();
		if (markering) zetMarkering(markering);
	}
</script>

<a
	class={className}
	{href}
	{title}
	data-sveltekit-noscroll
	aria-describedby={hover.open && !ro ? `${uid}-card` : undefined}
	aria-expanded={ro ? hover.open : undefined}
	bind:this={anker}
	onpointerenter={(e) => {
		hover.pointer(e.pointerType);
		enter();
	}}
	onpointerleave={() => hover.leave()}
	onpointerdown={(e) => hover.pointer(e.pointerType)}
	onfocus={enter}
	{onblur}
	{onclick}
	onkeydown={() => hover.keys()}>{@render children()}</a
>{#if hover.open && anker}{#if ro && id}{#if overwegingCard.component}{@const OverwegingKaart =
				overwegingCard.component}<OverwegingKaart
				judgment={id.slice('judgments/'.length)}
				at={at!}
				{doel}
				{noot}
				{markering}
				{href}
				anchor={anker}
				bind:element={kaart}
				onpointerenter={() => hover.enter()}
				onpointerleave={() => hover.leave()}
				onclose={() => hover.close()}
				onfocusout={(e) => {
					if (e.relatedTarget !== null && !binnen(e.relatedTarget)) hover.close();
				}}
			/>{/if}{:else if previewCard.component}{@const PreviewCard =
			previewCard.component}<PreviewCard
			{ref}
			{at}
			{voorbeeld}
			{extra}
			anchor={anker}
			bind:element={kaart}
			id="{uid}-card"
			onclose={() => hover.close()}
		/>{/if}{/if}

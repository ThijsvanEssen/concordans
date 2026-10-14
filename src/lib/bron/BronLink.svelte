<script lang="ts">
	// A reference to a bron, the same everywhere. A click opens the bron in the Verkenner with
	// its network (Thijs, 10 Oct: "laten we standaard navigeren naar Netwerk"), a Kamerstuk on
	// its text (12 Oct); the other is one step from there, the Netwerk/Tekst switch (openHref). Hover or focus shows a card after a moment: the
	// kind, the name, a date and what places the bron (its dossier, its indieners, the vote,
	// a first sentence or lid). The card has no buttons and stands in the top layer, placed
	// below the link or above it where the screen ends, so no column clips it. On touch a tap
	// opens the bron at once, without a card. Escape closes the card.
	// A reference to a judgment at an r.o. (`at` rov-…) shows the overweging itself instead
	// (OverwegingKaart, Thijs 14 Oct): a card to read, with its words that cite `doel` marked
	// and the way on, Open de uitspraak bij r.o. N. It stays while the pointer is on it; on
	// touch the first tap shows it and the second follows the link; a tap outside closes it
	// (capture phase, as a menu), a focus that leaves for nowhere does not (actions/menu.ts).
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { focusIn } from './leesbaar';
	import { focusOf, openHref, type BronRef } from './href';
	import { loadPreview, type Preview } from './preview';
	import { report } from '$lib/api/errors';
	import { isEscape } from '$lib/actions/keys';
	import { clickOutside, HOVER_MS, LEAVE_MS, topLayer } from '$lib/actions/top-layer';
	import { isOverwegingRef } from './overweging';
	import OverwegingKaart from './OverwegingKaart.svelte';
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
	let card = $state<Preview | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let anker = $state<HTMLElement | null>(null);
	/** The last pointer was a finger: its focus and its emulated hover show no card. */
	let tast = false;

	// A reference into the bron on screen is a jump within the page.
	const id = $derived(focusOf(ref));
	const inPage = $derived(!!at && !!id && focusIn(page.url) === id);
	const href = $derived(naar ?? (inPage ? `#${at}` : openHref(ref, { at })));

	// The card of an r.o.: the overweging, a card to read rather than a glance.
	const ro = $derived(preview && !voorbeeld && isOverwegingRef(id, at));
	let roOpen = $state(false);
	let roKaart = $state<HTMLElement | null>(null);
	let sluitTimer: ReturnType<typeof setTimeout> | null = null;
	function roToon(direct = false) {
		if (sluitTimer) clearTimeout(sluitTimer);
		sluitTimer = null;
		if (roOpen) return;
		if (timer) clearTimeout(timer);
		if (direct) {
			roOpen = true;
			return;
		}
		timer = setTimeout(() => {
			timer = null;
			roOpen = true;
		}, HOVER_MS);
	}
	function roSluitStraks() {
		if (timer) clearTimeout(timer);
		timer = null;
		if (sluitTimer) clearTimeout(sluitTimer);
		sluitTimer = setTimeout(() => (roOpen = false), LEAVE_MS);
	}
	function roSluit() {
		if (timer) clearTimeout(timer);
		if (sluitTimer) clearTimeout(sluitTimer);
		timer = sluitTimer = null;
		roOpen = false;
	}
	const binnen = (t: EventTarget | null) =>
		t instanceof Node && (!!anker?.contains(t) || !!roKaart?.contains(t));

	// Open: a tap or click outside closes it, before what was hit reacts (capture phase); a
	// scroll of the page moves the link away, one within the card does not.
	$effect(() => {
		if (!roOpen) return;
		const stop = clickOutside(() => [anker, roKaart], roSluit);
		const weg = (e: Event) => {
			if (!binnen(e.target)) roSluit();
		};
		// Escape closes it wherever the focus is: after a tap it is on neither link nor card.
		const esc = (e: KeyboardEvent) => {
			if (!isEscape(e)) return;
			e.preventDefault();
			e.stopPropagation();
			roSluit();
		};
		document.addEventListener('keydown', esc);
		addEventListener('scroll', weg, { capture: true, passive: true });
		addEventListener('resize', roSluit);
		return () => {
			stop();
			document.removeEventListener('keydown', esc);
			removeEventListener('scroll', weg, { capture: true });
			removeEventListener('resize', roSluit);
		};
	});

	function show() {
		if (ro) {
			if (!tast) roToon();
			return;
		}
		if (!preview || tast) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(async () => {
			// A card that cannot be loaded is not shown; the next hover asks again.
			const loaded =
				voorbeeld ?? (await loadPreview(ref, at).catch((e) => (report('Kaart', e), null)));
			if (timer) card = loaded && extra ? { ...loaded, extra } : loaded;
		}, HOVER_MS);
	}

	function hide() {
		if (timer) clearTimeout(timer);
		timer = null;
		card = null;
	}

	function onpointerenter(e: PointerEvent) {
		tast = e.pointerType === 'touch';
		show();
	}

	function onpointerleave() {
		if (ro) {
			if (!tast) roSluitStraks();
			return;
		}
		hide();
	}

	/** Focus that leaves for the card stays; for nowhere (a tap on the canvas) too. */
	function onblur(e: FocusEvent) {
		if (!ro) return hide();
		if (e.relatedTarget === null || binnen(e.relatedTarget)) return;
		roSluit();
	}

	/** On touch the first tap shows the r.o.; the second, or one on the card's link, goes. */
	function onclick(e: MouseEvent) {
		if (ro && tast && !roOpen) {
			e.preventDefault();
			roToon(true);
			return;
		}
		if (markering) zetMarkering(markering);
		if (ro) roSluit();
		hide();
	}

	function onkeydown(e: KeyboardEvent) {
		tast = false;
		if (ro && roOpen && isEscape(e)) {
			e.preventDefault();
			e.stopPropagation();
			roSluit();
			return;
		}
		if (card && isEscape(e)) {
			e.preventDefault();
			e.stopPropagation();
			hide();
		}
	}

	/** Escape in the card closes it and puts the focus back on the link. */
	function kaartToets(e: KeyboardEvent) {
		if (!isEscape(e)) return;
		e.preventDefault();
		e.stopPropagation();
		roSluit();
		anker?.focus();
	}

	// The card in the top layer while it shows (actions/top-layer.ts); a scroll moves the link
	// away, so it closes.
	$effect(() => {
		if (!card) return;
		addEventListener('scroll', hide, { capture: true, passive: true });
		addEventListener('resize', hide);
		return () => {
			removeEventListener('scroll', hide, { capture: true });
			removeEventListener('resize', hide);
		};
	});
</script>

<a
	class={className}
	{href}
	{title}
	data-sveltekit-noscroll
	aria-describedby={card ? `${uid}-card` : undefined}
	aria-expanded={ro ? roOpen : undefined}
	bind:this={anker}
	{onpointerenter}
	{onpointerleave}
	onpointerdown={(e) => (tast = e.pointerType === 'touch')}
	onfocus={show}
	{onblur}
	{onclick}
	{onkeydown}>{@render children()}</a
>{#if ro && roOpen && anker && id}<OverwegingKaart
		judgment={id.slice('judgments/'.length)}
		at={at!}
		{doel}
		{noot}
		{markering}
		{href}
		{anker}
		bind:kaart={roKaart}
		onpointerenter={() => roToon(true)}
		onpointerleave={() => roSluitStraks()}
		onkeydown={kaartToets}
		onfocusout={(e) => {
			if (e.relatedTarget !== null && !binnen(e.relatedTarget)) roSluit();
		}}
	/>{/if}{#if card && anker}<span
		class="card"
		id="{uid}-card"
		role="tooltip"
		use:topLayer={{ anchor: anker }}
		><span class="card__kicker">{card.kicker}{card.date ? `, ${card.date}` : ''}</span><span
			class="card__title">{card.title}</span
		>{#if card.dossier}<span class="card__regel">{card.dossier}</span>{/if}{#if card.wie}<span
				class="card__regel">{card.wie}</span
			>{/if}{#if card.uitslag}<span class="card__uitslag">{card.uitslag}</span
			>{/if}{#if card.extra}<span class="card__regel card__extra">{card.extra}</span
			>{/if}{#if card.lines}<span class="card__lines">{card.lines}</span>{/if}</span
	>{/if}

<style>
	.card {
		position: fixed;
		inset: auto;
		margin: 0;
		z-index: var(--z-float);
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		width: min(44ch, calc(100vw - 16px));
		max-height: var(--room);
		overflow: hidden;
		padding: var(--s-3);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		color: var(--ink);
		text-align: left;
		white-space: normal;
		pointer-events: none;
	}
	.card__kicker {
		font-family: var(--font-serif);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.card__title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: var(--lh-snug);
		color: var(--ink);
		display: -webkit-box;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card__regel,
	.card__uitslag {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.card__regel {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.card__uitslag {
		color: var(--ink);
	}
	.card__lines {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: 1.45;
		color: var(--ink-2);
		white-space: pre-line;
		display: -webkit-box;
		-webkit-line-clamp: 6;
		line-clamp: 6;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
</style>

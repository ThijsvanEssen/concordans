<script lang="ts">
	// A reference to a bron, the same everywhere. A click opens the bron in the Verkenner with
	// its network (Thijs, 10 Oct: "laten we standaard navigeren naar Netwerk"); Lees is one
	// step from there (1, or the Tekst switch). Hover or focus shows a card after a moment: the
	// kind, the name, a date and what places the bron (its dossier, its indieners, the vote,
	// a first sentence or lid). The card has no buttons and stands in the top layer, placed
	// below the link or above it where the screen ends, so no column clips it. On touch a tap
	// opens the bron at once, without a card. Escape closes the card.
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { focusIn } from './leesbaar';
	import { bronHref, focusOf, type BronRef } from './href';
	import { loadPreview, type Preview } from './preview';
	import { isEscape } from '$lib/actions/keys';

	let {
		ref,
		at = null,
		preview = true,
		class: className = '',
		title,
		children
	}: {
		ref: BronRef | string;
		/** A position in the bron: `lid-2`, `rov-4.2`. */
		at?: string | null;
		/** No card on hover where the reference itself already says all (a list of names). */
		preview?: boolean;
		class?: string;
		title?: string;
		children: Snippet;
	} = $props();

	const HOVER_MS = 350;
	/** Space between the link and the card, and between the card and the screen's edge. */
	const AFSTAND = 4;
	const RAND = 8;
	const uid = $props.id();
	let card = $state<Preview | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let anker = $state<HTMLElement | null>(null);
	let kaart = $state<HTMLElement | null>(null);
	/** The last pointer was a finger: its focus and its emulated hover show no card. */
	let tast = false;

	// A reference into the bron on screen is a jump within the page.
	const id = $derived(focusOf(ref));
	const inPage = $derived(!!at && !!id && focusIn(page.url) === id);
	const href = $derived(inPage ? `#${at}` : bronHref(ref, { at, keepMode: false, mode: 'graph' }));

	function show() {
		if (!preview || tast) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(async () => {
			const loaded = await loadPreview(ref, at);
			if (timer) card = loaded;
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

	function onkeydown(e: KeyboardEvent) {
		tast = false;
		if (card && isEscape(e)) {
			e.preventDefault();
			e.stopPropagation();
			hide();
		}
	}

	/** Below the link, or above it where the screen ends below; never past a side. */
	function plaats() {
		if (!anker || !kaart) return;
		const a = anker.getBoundingClientRect();
		const k = kaart.getBoundingClientRect();
		const onder = a.bottom + AFSTAND;
		const boven = a.top - AFSTAND - k.height;
		const top = onder + k.height > innerHeight - RAND && boven >= RAND ? boven : onder;
		const left = Math.max(RAND, Math.min(a.left, innerWidth - RAND - k.width));
		kaart.style.top = `${Math.round(top)}px`;
		kaart.style.left = `${Math.round(left)}px`;
	}

	// The card in the top layer while it shows; a scroll moves the link away, so it closes.
	$effect(() => {
		if (!card || !kaart) return;
		const el = kaart;
		try {
			el.showPopover();
		} catch {
			// Without the popover API the card stands fixed above the page by its z-index.
		}
		plaats();
		const weg = () => hide();
		addEventListener('scroll', weg, { capture: true, passive: true });
		addEventListener('resize', weg);
		return () => {
			removeEventListener('scroll', weg, { capture: true });
			removeEventListener('resize', weg);
			try {
				el.hidePopover();
			} catch {
				// Already closed, or no popover API.
			}
		};
	});
</script>

<a
	class={className}
	{href}
	{title}
	data-sveltekit-noscroll
	aria-describedby={card ? `${uid}-card` : undefined}
	bind:this={anker}
	{onpointerenter}
	onpointerleave={hide}
	onpointerdown={(e) => (tast = e.pointerType === 'touch')}
	onfocus={show}
	onblur={hide}
	onclick={hide}
	{onkeydown}>{@render children()}</a
>{#if card}<span class="card" id="{uid}-card" role="tooltip" popover="manual" bind:this={kaart}
		><span class="card__kicker">{card.kicker}{card.date ? `, ${card.date}` : ''}</span><span
			class="card__title">{card.title}</span
		>{#if card.dossier}<span class="card__regel">{card.dossier}</span>{/if}{#if card.wie}<span
				class="card__regel">{card.wie}</span
			>{/if}{#if card.uitslag}<span class="card__uitslag">{card.uitslag}</span
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

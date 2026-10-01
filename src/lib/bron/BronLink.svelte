<script lang="ts">
	import { gewoneKlik } from '$lib/actions/klik';
	import { focusIn } from './leesbaar';
	// A reference to a bron, the same everywhere. One click opens it in place: a card beside
	// it with the kind, the name, a date and the first lines, and the ways on to the bron
	// itself (Lees, In het netwerk). Cmd-click, ctrl-click and a middle click go to the bron
	// at once, as a link does. Hover or focus shows the same card without the buttons, after
	// a moment. Escape or a click elsewhere closes it.
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
	import { bronHref, focusOf, type BronRef } from './href';
	import { loadPreview, type Preview } from './preview';
	import { isEscape } from '$lib/actions/keys';
	import Picto from '$lib/components/ui/Picto.svelte';

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
	const uid = $props.id();
	let card = $state<Preview | null>(null);
	/** Opened by a click: it stays, with its buttons, until it is closed. */
	let vast = $state(false);
	let timer: ReturnType<typeof setTimeout> | null = null;
	let wrap = $state<HTMLElement | null>(null);

	// A reference into the bron on screen is a jump within the page.
	const id = $derived(focusOf(ref));
	const inPage = $derived(!!at && !!id && focusIn(page.url) === id);
	const href = $derived(inPage ? `#${at}` : bronHref(ref, { at }));
	const lees = $derived(bronHref(ref, { at, keepMode: false, mode: 'read' }));
	const netwerk = $derived(bronHref(ref, { keepMode: false, mode: 'graph' }));

	function show() {
		if (!preview || vast) return;
		if (timer) clearTimeout(timer);
		timer = setTimeout(async () => {
			const loaded = await loadPreview(ref, at);
			if (timer) card = loaded;
		}, HOVER_MS);
	}

	function hide() {
		if (vast) return;
		if (timer) clearTimeout(timer);
		timer = null;
		card = null;
	}

	function sluit() {
		vast = false;
		hide();
	}

	async function onclick(e: MouseEvent) {
		// A jump within the page, or a click that asks for the bron itself, is the link's.
		if (inPage || !gewoneKlik(e)) return;
		e.preventDefault();
		e.stopPropagation();
		if (vast) return sluit();
		if (timer) clearTimeout(timer);
		timer = null;
		vast = true;
		card = card ?? (await loadPreview(ref, at));
	}

	function onkeydown(e: KeyboardEvent) {
		if (card && isEscape(e)) {
			e.preventDefault();
			e.stopPropagation();
			sluit();
		}
	}

	// A click anywhere else closes a card opened by a click.
	$effect(() => {
		if (!vast) return;
		const away = (e: PointerEvent) => {
			if (wrap && e.target instanceof Node && !wrap.contains(e.target)) sluit();
		};
		document.addEventListener('pointerdown', away, true);
		return () => document.removeEventListener('pointerdown', away, true);
	});
</script>

<span class="bronlink" bind:this={wrap}
	><a
		class={className}
		{href}
		{title}
		data-sveltekit-noscroll
		aria-expanded={vast}
		aria-describedby={card ? `${uid}-card` : undefined}
		onmouseenter={show}
		onmouseleave={hide}
		onfocus={show}
		onblur={hide}
		{onclick}
		{onkeydown}>{@render children()}</a
	>{#if card}<span
			class="card"
			class:vast
			id="{uid}-card"
			role={vast ? 'dialog' : 'tooltip'}
			aria-label={vast ? card.title : undefined}
			><span class="card__kicker">{card.kicker}{card.date ? ` · ${card.date}` : ''}</span><span
				class="card__title">{card.title}</span
			>{#if card.lines}<span class="card__lines">{card.lines}</span>{/if}{#if vast}<span
					class="card__acts"
					><a class="act act--pri" href={lees} data-sveltekit-noscroll
						><Picto naam="tekst" size={13} />Lees</a
					><a class="act" href={netwerk} data-sveltekit-noscroll
						><Picto naam="netwerk" size={13} />In het netwerk</a
					></span
				>{/if}</span
		>{/if}</span
>

<style>
	.bronlink {
		position: relative;
	}
	.card {
		position: absolute;
		left: 0;
		top: 100%;
		z-index: var(--z-float);
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		width: min(44ch, 80vw);
		margin-top: var(--s-1);
		padding: var(--s-3);
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-modal);
		text-align: left;
		white-space: normal;
		pointer-events: none;
	}
	/* Opened by a click: it can be clicked, and its buttons lead on. */
	.card.vast {
		pointer-events: auto;
		border-color: var(--ink);
	}
	.card__acts {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2);
		margin-top: var(--s-2);
	}
	.act {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		height: var(--veld-h);
		padding: 0 var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink);
		text-decoration: none;
	}
	.act:hover {
		border-color: var(--ink);
	}
	.act--pri {
		background: var(--ink);
		border-color: var(--ink);
		color: var(--paper);
	}
	.card__kicker {
		font-family: var(--font-sans);
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.card__title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 500;
		line-height: var(--lh-snug);
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

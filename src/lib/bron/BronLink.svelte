<script lang="ts">
	// A reference to a bron, the same everywhere: a link (a click goes there, a middle
	// click opens a tab), and after a moment of hover or focus a card beside it with the
	// kind, the name, a date and the first lines. Escape closes the card.
	import { page } from '$app/state';
	import type { Snippet } from 'svelte';
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
		/** Off where the reference itself already says all (a list of names). */
		preview?: boolean;
		class?: string;
		title?: string;
		children: Snippet;
	} = $props();

	const HOVER_MS = 350;
	const uid = $props.id();
	let card = $state<Preview | null>(null);
	let timer: ReturnType<typeof setTimeout> | null = null;

	// A reference into the bron on screen is a jump within the page.
	const id = $derived(focusOf(ref));
	const href = $derived(
		at && id && page.url.searchParams.get('focus') === id ? `#${at}` : bronHref(ref, { at })
	);

	function show() {
		if (!preview) return;
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

	function onkeydown(e: KeyboardEvent) {
		if (card && isEscape(e)) {
			e.preventDefault();
			hide();
		}
	}
</script>

<span class="bronlink"
	><a
		class={className}
		{href}
		{title}
		data-sveltekit-noscroll
		aria-describedby={card ? `${uid}-card` : undefined}
		onmouseenter={show}
		onmouseleave={hide}
		onfocus={show}
		onblur={hide}
		{onkeydown}>{@render children()}</a
	>{#if card}<span class="card" id="{uid}-card" role="tooltip"
			><span class="card__kicker">{card.kicker}{card.date ? ` · ${card.date}` : ''}</span><span
				class="card__title">{card.title}</span
			>{#if card.lines}<span class="card__lines">{card.lines}</span>{/if}</span
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

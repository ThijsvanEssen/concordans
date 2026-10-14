<script lang="ts">
	// The card of a reference, a glance: the kind, the name, a date and what places the bron
	// (its dossier, its indieners, the vote, a first sentence or lid). It has no buttons and
	// shows once it is loaded; a card that cannot be loaded is not shown, and the next hover
	// asks again.
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
	import { report } from '$lib/api/errors';
	import type { BronRef } from './href';
	import { loadPreview, type Preview } from './preview';

	let {
		ref,
		at,
		voorbeeld,
		extra,
		anchor,
		id,
		onclose,
		element = $bindable(null)
	}: {
		ref: BronRef | string;
		at: string | null;
		/** The card itself, where the reference is not a bron's own (a defined term). */
		voorbeeld: Preview | null;
		/** One line more: the definition a citation's words name. */
		extra: string | null;
		anchor: HTMLElement;
		id: string;
		onclose: () => void;
		/** The card while it shows. */
		element?: HTMLElement | null;
	} = $props();

	let card = $state<Preview | null>(null);
	$effect(() => {
		let stale = false;
		const asked = voorbeeld ? Promise.resolve(voorbeeld) : loadPreview(ref, at);
		asked
			.then((loaded) => {
				if (!stale) card = loaded && extra ? { ...loaded, extra } : loaded;
			})
			.catch((e) => report('Kaart', e));
		return () => (stale = true);
	});
</script>

{#if card}<FloatingCard kind="glance" tag="span" bind:element {anchor} {onclose} {id} role="tooltip"
		><span class="kicker">{card.kicker}{card.date ? `, ${card.date}` : ''}</span><span class="title"
			>{card.title}</span
		>{#if card.dossier}<span class="line">{card.dossier}</span>{/if}{#if card.wie}<span class="line"
				>{card.wie}</span
			>{/if}{#if card.uitslag}<span class="outcome">{card.uitslag}</span>{/if}{#if card.extra}<span
				class="line">{card.extra}</span
			>{/if}{#if card.lines}<span class="lines">{card.lines}</span>{/if}</FloatingCard
	>{/if}

<style>
	.kicker {
		font-size: var(--t-label);
		color: var(--ink-3);
	}
	.title {
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
	.line,
	.outcome {
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.line {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.outcome {
		color: var(--ink);
	}
	.lines {
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

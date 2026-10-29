<script lang="ts">
	// Inline term that shows a popover with the full name and a plain explanation on
	// hover or focus: the kind of a kamerstuk in the document reader (MvT, Motie). A dotted
	// underline marks the term.
	import { clickOutside } from '$lib/actions/top-layer';
	import FloatingCard from '$lib/components/ui/FloatingCard.svelte';
	import { GLOSSARY, type GlossaryTerm } from '$lib/glossary';

	let { term, label }: { term: GlossaryTerm; label?: string } = $props();
	const entry = $derived(GLOSSARY[term]);
	const display = $derived(label ?? term);

	let open = $state(false);
	/** The last press was a finger's: its tap toggles the card, a mouse's hover has opened it. */
	let touch = false;
	let pillEl: HTMLButtonElement | null = $state(null);

	// The card floats in the top layer by the term (FloatingCard), as every card does.
	$effect(() => {
		if (!open) return;
		// A tap outside closes it (capture phase, as every card does); a tap on the term is its own.
		return clickOutside(
			() => [pillEl],
			() => (open = false)
		);
	});

	// Set after mount so the random suffix never differs between SSR and hydration.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let uid = $state('');
	$effect(() => {
		uid = `gp-${term.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;
	});
</script>

<button
	type="button"
	class="glossary-pill raakvlak"
	bind:this={pillEl}
	onpointerenter={(e) => {
		if (e.pointerType === 'mouse') open = true;
	}}
	onpointerleave={(e) => {
		if (e.pointerType === 'mouse') open = false;
	}}
	onfocus={() => (open = true)}
	onfocusout={(e) => {
		// Closed when the focus goes to another element, never on a focus that goes nowhere
		// (a tap on the canvas): a tap outside closes (clickOutside).
		const to = e.relatedTarget;
		if (to instanceof Node && !pillEl?.contains(to)) open = false;
	}}
	onpointerdown={(e) => (touch = e.pointerType !== 'mouse')}
	onclick={(e) => {
		// A mouse has opened it by hovering; a finger's first tap opens it, the next closes it.
		open = touch || e.detail === 0 ? !open : true;
	}}
	onkeydown={(e) => {
		if (e.key === 'Escape') open = false;
	}}
	aria-describedby={uid}
	aria-expanded={open}>{display}</button
>{#if open && pillEl}<FloatingCard
		kind="glance"
		tag="span"
		detach
		anchor={pillEl}
		onclose={() => (open = false)}
		id={uid}
		role="tooltip"
		><span class="glossary-pop__full">{entry.full}</span><span class="glossary-pop__plain"
			>{entry.plain}</span
		></FloatingCard
	>{/if}

<style>
	.glossary-pill {
		position: relative;
		display: inline;
		margin: 0;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		text-align: inherit;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		text-decoration-color: var(--rule-strong);
		cursor: help;
		color: var(--ink-3);
	}

	.glossary-pop__full {
		font-weight: 600;
		font-size: var(--t-micro);
	}
	.glossary-pop__plain {
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
</style>

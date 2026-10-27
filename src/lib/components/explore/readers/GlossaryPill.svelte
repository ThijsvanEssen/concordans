<script lang="ts">
	// Inline term that shows a popover with the full name and a plain explanation on
	// hover or focus: the kind of a kamerstuk in the document reader (MvT, Motie). A dotted
	// underline marks the term.
	import { clickOutside, placement, topOf } from '$lib/actions/top-layer';
	import { GLOSSARY, type GlossaryTerm } from '$lib/glossary';

	let { term, label }: { term: GlossaryTerm; label?: string } = $props();
	const entry = $derived(GLOSSARY[term]);
	const display = $derived(label ?? term);

	let open = $state(false);
	/** The last press was a finger's: its tap toggles the card, a mouse's hover has opened it. */
	let touch = false;
	let pillEl: HTMLButtonElement | null = $state(null);
	let popEl: HTMLSpanElement | null = $state(null);

	// The readers scroll inside containers that clip their overflow, so the popover is
	// placed against the viewport as every card is (placement): below the term, above it only
	// where there is no room below, so it never covers the title above its own row.
	let pos = $state({ top: 0, left: 0 });
	function place() {
		if (!pillEl || !popEl) return;
		const r = pillEl.getBoundingClientRect();
		const box = { width: popEl.offsetWidth, height: popEl.offsetHeight };
		const { up, left } = placement(r, box, { width: innerWidth, height: innerHeight });
		pos = { top: topOf(r, up, box.height), left };
	}
	$effect(() => {
		if (!open) return;
		place();
		// A fixed popover does not follow the term; scrolling closes it.
		const close = () => (open = false);
		window.addEventListener('scroll', close, { capture: true, passive: true });
		window.addEventListener('resize', close);
		// A tap outside closes it (capture phase, as every card does); a tap on the term is its own.
		const stop = clickOutside(() => [pillEl], close);
		return () => {
			stop();
			window.removeEventListener('scroll', close, { capture: true });
			window.removeEventListener('resize', close);
		};
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
	aria-expanded={open}
	>{display}<span
		id={uid}
		class="glossary-pop"
		class:is-open={open}
		bind:this={popEl}
		style:top="{pos.top}px"
		style:left="{pos.left}px"
	>
		<span class="glossary-pop__full">{entry.full}</span>
		<span class="glossary-pop__plain">{entry.plain}</span>
	</span>
</button>

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

	.glossary-pop {
		position: fixed;
		z-index: var(--z-float);
		width: max-content;
		max-width: 280px;
		padding: var(--s-2) var(--s-3);
		background: var(--ink);
		color: var(--paper);
		border-radius: var(--r-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		line-height: 1.4;
		box-shadow: var(--shadow-pop);
		opacity: 0;
		transform: translateY(2px);
		pointer-events: none;
		transition:
			opacity var(--dur-1) var(--ease),
			transform var(--dur-1) var(--ease);
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		text-decoration: none;
		text-align: left;
	}
	.glossary-pop.is-open {
		opacity: 1;
		transform: translateY(0);
	}
	.glossary-pop__full {
		font-weight: 600;
		font-size: var(--t-micro);
	}
	.glossary-pop__plain {
		color: color-mix(in srgb, var(--paper) 80%, transparent);
	}
</style>

<script lang="ts">
	// Inline term that shows a popover with the full name and a plain explanation on
	// hover or focus. Used in the parliamentary readers around acronyms (MvT, RvS, ECLI,
	// BWB) and procedural terms (Toezegging, Motie). A dotted underline marks the term.
	import { lookupGlossary } from '$lib/glossary';

	let { term, label }: { term: string; label?: string } = $props();
	const entry = $derived(lookupGlossary(term));
	const display = $derived(label ?? term);

	let open = $state(false);
	let pillEl: HTMLSpanElement | null = $state(null);

	// Set after mount so the random suffix never differs between SSR and hydration.
	// eslint-disable-next-line svelte/prefer-writable-derived
	let uid = $state('');
	$effect(() => {
		uid = `gp-${term.replace(/\s+/g, '-').toLowerCase()}-${Math.random().toString(36).slice(2, 7)}`;
	});
</script>

{#if entry}
	<span
		class="glossary-pill"
		bind:this={pillEl}
		onmouseenter={() => (open = true)}
		onmouseleave={() => (open = false)}
		onfocusin={() => (open = true)}
		onfocusout={() => (open = false)}
		onkeydown={(e) => {
			if (e.key === 'Escape') open = false;
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				open = !open;
			}
		}}
		role="button"
		tabindex="0"
		aria-describedby={uid}
		>{display}<span id={uid} class="glossary-pop" class:is-open={open} role="tooltip">
			<span class="glossary-pop__full">{entry.full}</span>
			<span class="glossary-pop__plain">{entry.plain}</span>
		</span>
	</span>
{:else}
	<span>{display}</span>
{/if}

<style>
	.glossary-pill {
		position: relative;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
		text-decoration-color: var(--rule-strong);
		cursor: help;
		color: var(--ink-3);
	}

	.glossary-pop {
		position: absolute;
		z-index: var(--z-float);
		bottom: calc(100% + 4px);
		left: 0;
		width: max-content;
		max-width: 280px;
		padding: 8px 10px;
		background: var(--ink);
		color: var(--paper);
		border-radius: var(--r-1);
		font-family: var(--font-sans);
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
		gap: 3px;
		text-decoration: none;
		text-align: left;
	}
	.glossary-pop.is-open {
		opacity: 1;
		transform: translateY(0);
	}
	.glossary-pop__full {
		font-weight: 500;
		font-size: var(--t-micro);
	}
	.glossary-pop__plain {
		color: color-mix(in srgb, var(--paper) 80%, transparent);
	}
</style>

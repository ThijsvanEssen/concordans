<script lang="ts">
	// A card over the network: Netwerk, the Legenda, a cluster's card (Thijs, 10 Oct: "Deze
	// mogen even breed zijn en hetzelfde soort component zijn"). One frame, one width in every
	// state (--zijkolom, folded or open), a head row (the title, what it holds while folded,
	// the caret, an action at the right) and its content. Where it stands is its user's
	// (`class`, `style`); what it looks like is this.
	import type { Snippet } from 'svelte';
	import Caret from '$lib/components/ui/Caret.svelte';

	let {
		title,
		open = true,
		onToggle,
		samenvatting,
		kop,
		actie,
		children,
		class: className = '',
		style = '',
		label,
		el = $bindable(null),
		...rest
	}: {
		title: string;
		/** Open: the content shows. A card without `onToggle` is always open. */
		open?: boolean;
		onToggle?: () => void;
		/** What it holds, beside the title while folded (a count, the signs of the legend). */
		samenvatting?: Snippet;
		/** A head of its own instead of the title (a cluster: its sign and name). */
		kop?: Snippet;
		/** At the right of the head (Deel, Wissen, Meer). */
		actie?: Snippet;
		children?: Snippet;
		class?: string;
		style?: string;
		label?: string;
		el?: HTMLElement | null;
		/** What the frame carries besides (a dialog's role, its key handler). */
		[attribuut: string]: unknown;
	} = $props();
</script>

<section
	{...rest}
	class="canvas-kaart {className}"
	{style}
	aria-label={label ?? title}
	bind:this={el}
>
	<div class="canvas-kaart__kop">
		{#if kop}
			{@render kop()}
		{:else if onToggle}
			<button
				type="button"
				class="canvas-kaart__knop raakvlak-knop"
				aria-expanded={open}
				onclick={onToggle}
			>
				<span class="canvas-kaart__titel">{title}</span>
				{#if samenvatting}{@render samenvatting()}{/if}
				<Caret {open} />
			</button>
		{:else}
			<h2 class="canvas-kaart__titel">{title}</h2>
			{#if samenvatting}{@render samenvatting()}{/if}
		{/if}
		{#if actie}<span class="canvas-kaart__actie">{@render actie()}</span>{/if}
	</div>
	{#if open && children}
		<div class="canvas-kaart__inhoud">{@render children()}</div>
	{/if}
</section>

<style>
	.canvas-kaart {
		position: absolute;
		z-index: var(--z-float);
		box-sizing: border-box;
		width: var(--zijkolom);
		max-width: calc(100% - 2 * var(--s-3));
		display: flex;
		flex-direction: column;
		background: var(--paper);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		box-shadow: var(--shadow-pop);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.canvas-kaart__kop {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		min-height: var(--veld-h);
		padding: var(--s-1) var(--s-3);
	}
	.canvas-kaart__knop {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
		cursor: pointer;
	}
	/* On a touch screen and below 768 the head is a finger's 44 px high and its button fills it: the
	   targets of two cards above each other do not meet. */
	@media (pointer: coarse), (max-width: 768px) {
		.canvas-kaart__kop {
			min-height: var(--veld-h-raak);
		}
		.canvas-kaart__knop {
			align-self: stretch;
		}
	}
	.canvas-kaart__knop:hover {
		color: var(--ink);
	}
	.canvas-kaart__titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
	}
	.canvas-kaart__actie {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		margin-left: auto;
	}
	.canvas-kaart__actie :global(.tekstlink) {
		font-size: var(--t-micro);
	}
	.canvas-kaart__inhoud {
		min-height: 0;
		overflow-y: auto;
		padding: 0 var(--s-3) var(--s-3);
	}
</style>

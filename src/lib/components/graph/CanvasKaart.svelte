<script lang="ts">
	// A card of the werkplek: Netwerk, Weergave, a cluster's card. They stand in a strip on its
	// paper (GraphView), each a head row (the title, what it holds beside it, an action at the
	// right) and its content. Where it stands is its user's (`class`); what it looks like is this.
	import type { Snippet } from 'svelte';

	let {
		title,
		samenvatting,
		kop,
		actie,
		children,
		class: className = '',
		label,
		el = $bindable(null),
		...rest
	}: {
		title: string;
		/** What it holds, beside the title (a count, a loader). */
		samenvatting?: Snippet;
		/** A head of its own instead of the title (a cluster: its sign and name). */
		kop?: Snippet;
		/** At the right of the head (Wis alles). */
		actie?: Snippet;
		children?: Snippet;
		class?: string;
		label?: string;
		el?: HTMLElement | null;
		/** What the frame carries besides (a dialog's role, its key handler). */
		[attribuut: string]: unknown;
	} = $props();
</script>

<section {...rest} class="canvas-kaart {className}" aria-label={label ?? title} bind:this={el}>
	<div class="canvas-kaart__kop">
		{#if kop}
			{@render kop()}
		{:else}
			<h2 class="canvas-kaart__titel">{title}</h2>
			{#if samenvatting}{@render samenvatting()}{/if}
		{/if}
		{#if actie}<span class="canvas-kaart__actie">{@render actie()}</span>{/if}
	</div>
	{#if children}
		<div class="canvas-kaart__inhoud">{@render children()}</div>
	{/if}
</section>

<style>
	.canvas-kaart {
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
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
	@media (pointer: coarse), (max-width: 768px) {
		.canvas-kaart__kop {
			min-height: var(--veld-h-raak);
		}
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
		/* A safety net behind the fit of what is inside, not instead of it. */
		overflow-x: clip;
		padding: 0 var(--s-3) var(--s-3);
	}
</style>

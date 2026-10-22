<script lang="ts">
	// The status line of the ritual (bevestig.svelte.ts), drawn once for the whole site: a live
	// region that is always there, so a screen reader hears what is put in it. Seen only where
	// there is a destination to link to; a copy is heard, its button says it.
	import { confirmation } from '$lib/bevestig/bevestig.svelte';

	const nu = $derived(confirmation.now);
</script>

<div
	class:bevestiging={!!nu?.to}
	class:sr-only={!nu?.to}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	{#if nu}{nu.text}{#if nu.to}&nbsp;<a href={nu.to.href}>{nu.to.label}</a>{/if}{/if}
</div>

<style>
	.bevestiging {
		position: fixed;
		left: var(--s-4);
		bottom: var(--s-4);
		z-index: 50;
		max-width: calc(100vw - 2 * var(--s-4));
		padding: var(--s-2) var(--s-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: var(--paper);
		font-size: var(--t-ui);
		color: var(--ink);
	}
	.bevestiging a {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
</style>

<script lang="ts">
	// The status line of the ritual (bevestig.svelte.ts), drawn once for the whole site: a live
	// region that is always there, so a screen reader hears what is put in it, and seen for the
	// two seconds, whatever it says: Bewaard in, Gekopieerd: art. 6:162 BW. At the foot of the
	// page, in the middle: the table of contents on the left is never covered.
	import { confirmation } from '$lib/bevestig/bevestig.svelte';

	const nu = $derived(confirmation.now);
</script>

<div
	class:bevestiging={!!nu}
	class:sr-only={!nu}
	role="status"
	aria-live="polite"
	aria-atomic="true"
>
	{#if nu}{nu.text}{#if nu.to}&nbsp;<a href={nu.to.href}>{nu.to.label}</a>{/if}{/if}
</div>

<style>
	.bevestiging {
		position: fixed;
		inset-inline: var(--s-4);
		bottom: var(--s-4);
		z-index: 50;
		width: fit-content;
		max-width: calc(100vw - 2 * var(--s-4));
		margin-inline: auto;
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

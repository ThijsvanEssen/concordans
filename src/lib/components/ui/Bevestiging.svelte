<script lang="ts">
	// The status line of the ritual (bevestig.svelte.ts), drawn once for the whole site: a live
	// region that is always there, so a screen reader hears what is put in it, and seen for the
	// two seconds, whatever it says: Bewaard in, Gekopieerd: art. 6:162 BW; longer with a way
	// back, and not while the pointer or the focus is in it. At the foot of the
	// page, in the middle: the table of contents on the left is never covered.
	import { confirmation, hold, undo } from '$lib/bevestig/bevestig.svelte';
	import TextLink from './TekstLink.svelte';

	const nu = $derived(confirmation.now);
</script>

<div
	class:bevestiging={!!nu}
	class:sr-only={!nu}
	role="status"
	aria-live="polite"
	aria-atomic="true"
	onpointerenter={() => hold(true)}
	onpointerleave={() => hold(false)}
	onfocusin={() => hold(true)}
	onfocusout={() => hold(false)}
>
	{#if nu}{nu.text}{#if nu.to}&nbsp;<a href={nu.to.href}>{nu.to.label}</a>{/if}{#if nu.undo}.
			<TextLink onclick={undo}>Ongedaan maken</TextLink>{/if}{/if}
</div>

<style>
	.bevestiging {
		position: fixed;
		inset-inline: var(--s-4);
		bottom: calc(var(--s-4) + var(--tabbar-h));
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

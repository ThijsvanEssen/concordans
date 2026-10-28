<script lang="ts">
	// On a phone the bronnen and the weergave of the werkplek stand in a Blad from below, behind
	// the button "Weergave" at the foot of the canvas, so the canvas has the screen
	// (Design System, Netwerkkeuze: Telefoon). Wider it is no frame at all: the strip stays where
	// it stands. Esc, a tap outside and Sluiten close it, the page behind it stands still, and the
	// focus goes back to the button.
	import { MediaQuery } from 'svelte/reactivity';
	import type { Snippet } from 'svelte';
	import Blad from '$lib/components/ui/Blad.svelte';

	let {
		open,
		onClose,
		opener,
		children
	}: {
		open: boolean;
		onClose: () => void;
		/** The button that opened it, where the focus goes back to. */
		opener: () => HTMLElement | null;
		children: Snippet;
	} = $props();

	const phone = new MediaQuery('max-width: 768px');
</script>

{#if !phone.current}
	{@render children()}
{:else if open}
	<Blad title="Weergave" showTitle={false} aboveTabbar {opener} {onClose}>
		{@render children()}
	</Blad>
{/if}

<script lang="ts">
	// A panel of the Verkenner that failed to draw (an answer of a shape it did not expect):
	// said in its place, with Opnieuw, while the other panels stay. Reported once, here. The
	// next bron (`resetOn`) draws the panel again.
	import { untrack, type Snippet } from 'svelte';
	import { report } from '$lib/api/errors';
	import LoadState from './LoadState.svelte';

	let {
		what,
		resetOn,
		children
	}: {
		/** What failed, as the subject of the sentence: "De tekst", "Het netwerk". */
		what: string;
		/** The bron the panel shows: another one tries again. */
		resetOn?: unknown;
		children: Snippet;
	} = $props();

	let reset: (() => void) | null = null;
	$effect(() => {
		void resetOn;
		untrack(() => {
			reset?.();
			reset = null;
		});
	});
</script>

<svelte:boundary
	onerror={(error, again) => {
		report(what, error);
		reset = again;
	}}
>
	{@render children()}
	{#snippet failed(error, again)}
		<LoadState state={{ status: 'error', error }} {what} retry={again} form="block" />
	{/snippet}
</svelte:boundary>

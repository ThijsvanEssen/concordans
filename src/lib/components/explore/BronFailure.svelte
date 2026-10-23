<script lang="ts">
	// A bron that did not come, in the column of its text under a heading as a bron has, and
	// not loose in a corner of the page (E8, C1): the frame of a reader with its failure.
	import type { LoadFailure } from '$lib/util/load.svelte';
	import ReaderFrame from './readers/ReaderFrame.svelte';

	let { failure }: { failure: LoadFailure } = $props();
</script>

<ReaderFrame
	state={{ status: 'error', error: failure.error }}
	what={failure.what}
	retry={failure.retry}
>
	{#snippet head()}<h1 class="fout-kop">Er ging iets mis</h1>{/snippet}
</ReaderFrame>

<style>
	/* The type of a reader's title. */
	.fout-kop {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: var(--t-h1);
		line-height: 1.15;
		color: var(--ink);
	}
</style>

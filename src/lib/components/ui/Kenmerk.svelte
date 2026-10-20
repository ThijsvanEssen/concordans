<script lang="ts">
	// The kenmerk of a failure the API logged (a 500), small after its sentence, for a reader
	// to pass on: the key to its line in the log ($lib/api/errors.ts, kenmerkOf). Nothing
	// for any other failure.
	import { kenmerkOf } from '$lib/api/errors';

	let { error }: { error: unknown } = $props();

	const kenmerk = $derived(kenmerkOf(error));
</script>

{#if kenmerk}<span class="kenmerk">kenmerk {kenmerk}</span>{/if}

<style>
	.kenmerk {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
		user-select: all;
	}
</style>

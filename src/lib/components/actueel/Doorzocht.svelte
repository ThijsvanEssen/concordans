<script lang="ts">
	// The API searched words or a fractie for a while and answered with what it found, from the
	// day it reached (0.79.28): that day, and further back as the same question up to the day
	// before. One line on Actueel and on Gevolgd alike.
	import { fromDate } from '$lib/text/datum';
	import AlleN from '$lib/components/ui/AlleN.svelte';

	let {
		vanaf,
		loading,
		onVerder
	}: {
		/** The first day searched. */
		vanaf: string;
		loading: boolean;
		onVerder: () => void;
	} = $props();
</script>

<p class="doorzocht">
	Doorzocht {fromDate(vanaf)}.
	<AlleN volgende woord="Eerdere" noun="dagen" laden={loading} onclick={onVerder} />
</p>

<style>
	.doorzocht {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2) var(--s-3);
		margin: var(--s-3) 0;
		color: var(--ink-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
</style>

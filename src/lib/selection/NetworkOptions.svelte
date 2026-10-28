<script lang="ts">
	// The netwerk's own filter, the last row of Tonen in the strip at the left: Alleen verbonden
	// bronnen (key O, besluit 37).
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';

	let {
		around = null,
		aroundOn = false,
		onAround
	}: {
		/** The bron whose surroundings alone the filter shows, by its name. */
		around?: string | null;
		/** The filter Alleen verbonden bronnen is on. */
		aroundOn?: boolean;
		onAround?: () => void;
	} = $props();
</script>

{#if (around || aroundOn) && onAround}
	<!-- A filter, on and off; the chosen bronnen stay. The bron's name and the key on hover. -->
	<p class="optie">
		<FilterOptie
			inline
			on={aroundOn}
			onToggle={onAround}
			label="Alleen verbonden bronnen"
			title={around
				? `Alleen ${around} met verbonden bronnen (toets O)`
				: 'Alleen verbonden bronnen (toets O)'}
		/>
	</p>
{/if}

<style>
	.optie {
		margin: 0;
		font-size: var(--t-micro);
	}
</style>

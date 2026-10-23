<script lang="ts">
	// The netwerk's own filters, under Meer in the strip at the left (mockup A197-b): Alleen
	// verbonden bronnen (key O, besluit 37), and whether the bronnen between two chosen ones are
	// drawn, with what the paths could not find in time.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import { count } from '$lib/text/words';

	let {
		around = null,
		aroundOn = false,
		onAround,
		chosen,
		between,
		betweenCount,
		partial = false,
		onBetween
	}: {
		/** The bron whose surroundings alone the filter shows, by its name. */
		around?: string | null;
		/** The filter Alleen verbonden bronnen is on. */
		aroundOn?: boolean;
		onAround?: () => void;
		/** How many bronnen are chosen: the bronnen between need two. */
		chosen: number;
		between: boolean;
		betweenCount: number;
		/** The API ran out of time looking for paths: these are the ones it found (`partial`). */
		partial?: boolean;
		onBetween: () => void;
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
{#if chosen > 1}
	<p class="optie">
		<FilterOptie
			inline
			on={between}
			onToggle={onBetween}
			label={between
				? `${count(betweenCount, 'bron', 'bronnen')} ertussen`
				: 'Toon de bronnen ertussen'}
		/>
	</p>
	{#if between && partial}
		<p class="deels">Niet alle verbindingen gevonden: het zoeken duurde te lang.</p>
	{/if}
{/if}

<style>
	.optie {
		margin: 0;
		font-size: var(--t-micro);
	}
	.deels {
		margin: var(--s-1) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

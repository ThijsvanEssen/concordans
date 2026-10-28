<script lang="ts">
	// The vinkje Voorstellen in Tonen (besluit 37): the lopende voorstellen of the bronnen on the
	// canvas drawn beside them. It stands there only where a bron on the canvas has one.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';

	let {
		on,
		count,
		onToggle
	}: {
		on: boolean;
		/** The bronnen on the canvas with a lopend voorstel. */
		count: number;
		onToggle: () => void;
	} = $props();
</script>

{#if count > 0 || on}
	<p class="optie">
		<FilterOptie
			inline
			{on}
			{onToggle}
			label="Voorstellen"
			title="Lopende wetsvoorstellen die de bronnen op het canvas willen wijzigen"
		/>
	</p>
{/if}

<style>
	.optie {
		margin: 0;
		font-size: var(--t-micro);
	}
</style>

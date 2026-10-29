<script lang="ts">
	// The vinkje Voorstellen in Tonen (besluit 37): the lopende voorstellen of the bronnen on the
	// canvas drawn beside them. It stands there only where a bron on the canvas has one.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Stip from './Stip.svelte';

	let {
		on,
		available,
		count = null,
		loading = false,
		onToggle
	}: {
		on: boolean;
		/** The bronnen on the canvas with a lopend voorstel. */
		available: number;
		/** The voorstellen it draws, each bill once; null while not yet known. */
		count?: number | null;
		/** The count is on its way. */
		loading?: boolean;
		onToggle: () => void;
	} = $props();
</script>

{#if available > 0 || on}
	<p class="optie">
		<FilterOptie
			{on}
			{onToggle}
			{count}
			{loading}
			label="Voorstellen"
			title="Lopende wetsvoorstellen die de bronnen op het canvas willen wijzigen"
		/>
	</p>
{/if}
<!-- What the dot on a bron means: in Tonen while one stands on the canvas (live-toets B4). -->
{#if available > 0}
	<p class="legenda"><Stip />Lopend wetsvoorstel</p>
{/if}

<style>
	.optie {
		margin: 0;
		font-size: var(--t-micro);
	}
	/* In the columns of a Filteroptie: the dot where its box stands, the words where its name. */
	.legenda {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: var(--s-1) 0 0;
		padding-left: 3px;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
</style>

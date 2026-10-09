<script lang="ts">
	// Kept in the map, or not: the box of a choice (FilterOptie, docs/bediening.md) beside a lid,
	// an overweging, a row of Verbonden or in the head of a reader. "Bewaar lid 3" where it
	// names a place; "Bewaard" once kept.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Vinkje from '$lib/components/ui/Vinkje.svelte';
	import { kaart } from './map.svelte';
	import type { MapItem } from './map';

	let {
		item,
		wat = '',
		kaal = false
	}: {
		item: MapItem;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
		/** The box alone, its words as its name: a narrow column (the numbers of a judgment). */
		kaal?: boolean;
	} = $props();

	const aan = $derived(kaart.heeft(item));
</script>

{#if kaal}
	<button
		type="button"
		class="kaal"
		aria-pressed={aan}
		aria-label="{aan ? 'Bewaard' : 'Bewaar'} {item.kort}"
		title={aan ? `${item.kort}: uit Gemarkeerd halen` : `${item.kort}: in Gemarkeerd bewaren`}
		onclick={() => kaart.wissel(item)}><Vinkje {aan} /></button
	>
{:else}
	<FilterOptie
		inline
		on={aan}
		label="{aan ? 'Bewaard' : 'Bewaar'}{wat ? ` ${wat}` : ''}"
		title={aan ? `${item.kort}: uit Gemarkeerd halen` : `${item.kort}: in Gemarkeerd bewaren`}
		onToggle={() => kaart.wissel(item)}
	/>
{/if}

<style>
	.kaal {
		display: inline-grid;
		place-items: center;
		padding: 2px;
		border: 0;
		background: none;
		cursor: pointer;
	}
	.kaal:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>

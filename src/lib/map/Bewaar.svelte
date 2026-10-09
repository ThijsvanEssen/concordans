<script lang="ts">
	// Kept in the map, or not: the box of a choice (FilterOptie, docs/bediening.md) beside a lid,
	// an overweging, a row of Verbonden or in the head of a reader. "Bewaar lid 3" where it
	// names a place; "Bewaard" once kept. In a reader's head `in …` names the map it goes to,
	// a menu to keep it in another map or a new one.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Vinkje from '$lib/components/ui/Vinkje.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { kaart } from './map.svelte';
	import type { MapItem } from './map';

	let {
		item,
		wat = '',
		kaal = false,
		metMap = false
	}: {
		item: MapItem;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
		/** The box alone, its words as its name: a narrow column (the numbers of a judgment). */
		kaal?: boolean;
		/** With `in …`: the map it goes to, and a choice of another. */
		metMap?: boolean;
	} = $props();

	const aan = $derived(kaart.heeft(item));
	const titel = $derived(
		aan
			? `${item.kort}: uit ${kaart.actief.naam} halen`
			: `${item.kort}: in ${kaart.actief.naam} bewaren`
	);
</script>

{#if kaal}
	<button
		type="button"
		class="kaal"
		aria-pressed={aan}
		aria-label="{aan ? 'Bewaard' : 'Bewaar'} {item.kort}"
		title={titel}
		onclick={() => kaart.wissel(item)}><Vinkje {aan} /></button
	>
{:else}
	<FilterOptie
		inline
		on={aan}
		label="{aan ? 'Bewaard' : 'Bewaar'}{wat ? ` ${wat}` : ''}"
		title={titel}
		onToggle={() => kaart.wissel(item)}
	/>
	{#if metMap}
		<span class="in">
			<TekstMenu
				klein
				label="Bewaar in map"
				tekst="in {kaart.actief.naam}"
				opties={kaart.mappen.map((m) => ({ waarde: m.id, label: m.naam }))}
				waarde={kaart.actief.id}
				onKies={(id) => kaart.bewaarIn(id, item)}
			>
				{#snippet onder(dicht)}
					<button
						type="button"
						role="menuitem"
						class="tekstmenu__item"
						onclick={() => {
							dicht();
							kaart.nieuw(undefined, [item]);
							kaart.naamgeven = true;
							kaart.open = true;
						}}>Nieuwe map</button
					>
				{/snippet}
			</TekstMenu>
		</span>
	{/if}
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
	/* The map's name as quiet as the box's words beside it. */
	.in :global(.tekstmenu__knop) {
		color: var(--ink-3);
		font-weight: 400;
	}
	.in :global(.tekstmenu__knop:hover) {
		color: var(--accent);
	}
	.kaal:focus-visible {
		outline: 2px solid var(--accent);
		outline-offset: 1px;
	}
</style>

<script lang="ts">
	// Kept in the map, or not. As a button (the head of a reader, `knop`; an overweging, `kaal`)
	// its glyph is the bookmark of RijActies, open or filled: an action, not a box (Thijs, 10
	// Oct). "Bewaar lid 3" where it names a place; "Bewaard" once kept. In a reader's head
	// (`metMap`) one control: the button keeps it at once, the caret beside it the choice of
	// map (Thijs, 10 Oct: not a second menu beside it). As a word among words (`tekst`) the
	// word alone.
	import FilterOptie from '$lib/components/ui/FilterOptie.svelte';
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { kaart } from './map.svelte';
	import type { MapItem } from './map';

	let {
		item,
		wat = '',
		kaal = false,
		metMap = false,
		tekst = false,
		knop = false
	}: {
		item: MapItem;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
		/** The box alone, its words as its name: a narrow column (the numbers of a judgment). */
		kaal?: boolean;
		/** With the choice of map behind a caret beside the box. */
		metMap?: boolean;
		/** The word alone, as a link among words: "Bewaar", "Bewaard". */
		tekst?: boolean;
		/** A framed button, as Citeer beside it in a reader's head (Thijs, 10 Oct: "een kader"). */
		knop?: boolean;
	} = $props();

	const aan = $derived(kaart.heeft(item));
	const titel = $derived(
		aan
			? `${item.kort}: uit ${kaart.actief.naam} halen`
			: `${item.kort}: in ${kaart.actief.naam} bewaren`
	);
</script>

{#if tekst}
	<button
		type="button"
		class="plaats-woord"
		aria-pressed={aan}
		aria-label="{aan ? 'Bewaard' : 'Bewaar'} {item.kort}"
		title={titel}
		onclick={() => kaart.wissel(item)}>{aan ? 'Bewaard' : 'Bewaar'}</button
	>
{:else if knop}
	<span class="splits">
		<button
			type="button"
			class="btn"
			aria-pressed={aan}
			title={titel}
			onclick={() => kaart.wissel(item)}
			><Picto naam={aan ? 'bewaard' : 'bewaar'} />{aan ? 'Bewaard' : 'Bewaar'}{wat
				? ` ${wat}`
				: ''}</button
		>
		{#if metMap}
			<TekstMenu
				klein
				rechts
				label="Bewaar {item.kort} in map"
				tekst=""
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
						}}>Nieuwe map</button
					>
				{/snippet}
			</TekstMenu>
		{/if}
	</span>
{:else if kaal}
	<button
		type="button"
		class="kaal"
		aria-pressed={aan}
		aria-label="{aan ? 'Bewaard' : 'Bewaar'} {item.kort}"
		title={titel}
		onclick={() => kaart.wissel(item)}><Picto naam={aan ? 'bewaard' : 'bewaar'} /></button
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
		<span class="kies">
			<TekstMenu
				klein
				label="Bewaar {item.kort} in map"
				tekst=""
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
							// A new map with the item, active from now on; named on Gemarkeerd.
							kaart.nieuw(undefined, [item]);
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
	/* The framed pair: the box and its word, the caret of the map's choice joined to it. */
	.splits {
		display: inline-flex;
		align-items: stretch;
	}
	.splits > .btn {
		gap: var(--s-2);
	}
	.splits:has(:global(.tekstmenu)) > .btn {
		border-top-right-radius: 0;
		border-bottom-right-radius: 0;
	}
	.splits :global(.tekstmenu__knop) {
		box-sizing: border-box;
		height: var(--veld-h-klein);
		padding: 0 var(--s-1);
		border: 1px solid var(--rule-strong);
		border-left: 0;
		border-radius: 0 var(--r-1) var(--r-1) 0;
		color: var(--ink-2);
	}
	.splits :global(.tekstmenu__knop:hover) {
		background: var(--paper-2);
		color: var(--ink);
	}
	/* The caret of the map's choice, close to the box's words. */
	.kies {
		margin-left: -2px;
	}
	.kies :global(.tekstmenu__knop) {
		color: var(--ink-3);
	}
	.kies :global(.tekstmenu__knop:hover) {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	.kaal:focus-visible {
		outline: 2px solid var(--focus);
		outline-offset: 1px;
	}
</style>

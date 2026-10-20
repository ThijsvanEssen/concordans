<script lang="ts">
	// Kept in the map, or not: a framed button in a reader's head, as Citeer beside it (Thijs, 10
	// Oct: "een kader"). Its glyph is the bookmark of RijActies, open or filled: an action, not a
	// box. "Bewaar lid 3" where it names a place; "Bewaard" once kept. One control: the button
	// keeps it at once, in the bundel chosen last (a tick in its menu); the caret beside it the choice
	// of bundel (Thijs, 10 Oct: not a second menu beside it).
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import { kaart } from './map.svelte';
	import type { MapItem } from './map';

	let {
		item,
		wat = ''
	}: {
		item: MapItem;
		/** The place it names: `lid 3`, `r.o. 5.7.1`. */
		wat?: string;
	} = $props();

	const aan = $derived(kaart.heeft(item));
	const titel = $derived(
		aan
			? `${item.kort}: uit ${kaart.actief.naam} halen`
			: `${item.kort}: in ${kaart.actief.naam} bewaren`
	);
</script>

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
	<TekstMenu klein rechts label="Bewaar {item.kort} in bundel" tekst="">
		<!-- The bundels, Losse markeringen first; a tick where Bewaar keeps (no words "actieve bundel"). -->
		{#snippet inhoud(dicht)}
			{#each kaart.listed as m (m.id)}
				{@const here = m.id === kaart.actief.id}
				<button
					type="button"
					role="menuitemradio"
					class="tekstmenu__item tekstmenu__item--paar"
					aria-checked={here}
					title={here ? 'Bewaren gaat hierheen' : undefined}
					onclick={() => {
						dicht();
						kaart.bewaarIn(m.id, item);
					}}
					><span>{m.naam}</span><span class="vink"
						>{#if here}<Picto naam="tick" size={12} />{/if}</span
					></button
				>
			{/each}
		{/snippet}
		{#snippet onder(dicht)}
			<button
				type="button"
				role="menuitem"
				class="tekstmenu__item"
				onclick={() => {
					dicht();
					// A new bundel with the item, where Bewaar keeps from now on; named on its page.
					kaart.nieuw(undefined, [item]);
				}}>Nieuwe bundel</button
			>
		{/snippet}
	</TekstMenu>
</span>

<style>
	.vink {
		display: inline-flex;
		align-items: center;
		color: var(--ink);
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
</style>

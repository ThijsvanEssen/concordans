<script lang="ts">
	// The actions of a list row: Bewaar and In netwerk, two icon buttons that say what they do
	// (Thijs, 10 Oct: "Vinkje en +-je zijn niet intuïtief"). A box stays for a choice in a
	// filter (Vinkje). At rest only the state shows: a filled bookmark when kept, the network
	// when in the network. Both buttons appear on hover or focus of the row (the nearest
	// [data-rij]); on a touch screen they are always there, at a finger's size.
	import IconKnop from './IconKnop.svelte';
	import Picto from './Picto.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import type { MapItem } from '$lib/map/map';

	let {
		naam,
		item = null,
		netwerk = null
	}: {
		/** The bron as the row names it, for the buttons' names. */
		naam: string;
		/** What Bewaar keeps; without it no Bewaar. */
		item?: MapItem | null;
		/** Whether the bron is in the network, and how to add it; without it no button. */
		netwerk?: { aan: boolean; voegToe: () => void } | null;
	} = $props();

	const bewaard = $derived(!!item && kaart.heeft(item));
</script>

<span class="rij-acties">
	{#if item}
		{@const kept = item}
		<span class="actie" class:aan={bewaard}>
			<IconKnop
				aan={bewaard}
				label={bewaard
					? `${naam}: uit ${kaart.actief.naam} halen`
					: `${naam}: bewaren in ${kaart.actief.naam}`}
				onclick={() => kaart.wissel(kept)}><Picto naam={bewaard ? 'bewaard' : 'bewaar'} /></IconKnop
			>
		</span>
	{/if}
	{#if netwerk}
		{@const n = netwerk}
		<span class="actie" class:aan={n.aan}>
			<IconKnop
				aan={n.aan}
				label={n.aan ? `${naam} staat in het netwerk` : `${naam} aan het netwerk toevoegen`}
				onclick={() => !n.aan && n.voegToe()}
				><Picto naam={n.aan ? 'netwerk' : 'netwerk-plus'} /></IconKnop
			>
		</span>
	{/if}
</span>

<style>
	.rij-acties {
		flex: none;
		display: inline-flex;
		align-items: flex-start;
		gap: var(--s-1);
	}
	.actie {
		display: inline-grid;
		opacity: 0;
	}
	.actie.aan,
	:global([data-rij]:hover) .actie,
	:global([data-rij]:focus-within) .actie {
		opacity: 1;
	}
	/* At rest a state, not a button: the glyph alone, in ink. */
	@media (hover: hover) {
		:global([data-rij]:not(:hover, :focus-within)) .actie.aan :global(.iconknop) {
			border-color: transparent;
			background: none;
			color: var(--ink);
		}
	}
	@media (hover: none) {
		.actie {
			opacity: 1;
		}
	}
	@media (pointer: coarse) {
		.actie :global(.iconknop) {
			width: var(--veld-h);
			height: var(--veld-h);
		}
	}
</style>

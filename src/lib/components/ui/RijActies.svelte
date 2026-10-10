<script lang="ts">
	// The actions of a list row: Bewaar and In netwerk (Thijs, 10 Oct: "Vinkje en +-je zijn niet
	// intuïtief"). One look in every state (Thijs, 10 Oct: "toch wat raar met de verschillen in
	// hoe ze weergegeven worden"): two fixed places, Bewaar then In netwerk, so nothing moves from
	// row to row; a glyph without a frame, open in ink-3 when off, filled in ink when on. Off they
	// show on the row's hover or focus (always on a touch screen), on always. A hover on the glyph
	// gives it ink and a wash behind it; the keyboard's focus the ink ring.
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
		/** What Bewaar keeps; without it its place stays empty. */
		item?: MapItem | null;
		/** Whether it is in the network, how to add it and, for a group, to take it out again;
		 * without it its place stays empty. */
		netwerk?: { aan: boolean; voegToe: () => void; haalWeg?: () => void } | null;
	} = $props();

	const bewaard = $derived(!!item && kaart.heeft(item));
</script>

<span class="rij-acties">
	<span class="plek">
		{#if item}
			{@const kept = item}
			<button
				type="button"
				class="rij-knop"
				class:aan={bewaard}
				aria-pressed={bewaard}
				aria-label={bewaard
					? `${naam}: uit ${kaart.actief.naam} halen`
					: `${naam}: bewaren in ${kaart.actief.naam}`}
				title={bewaard ? `Uit ${kaart.actief.naam} halen` : `Bewaar in ${kaart.actief.naam}`}
				onclick={() => kaart.wissel(kept)}><Picto naam={bewaard ? 'bewaard' : 'bewaar'} /></button
			>
		{/if}
	</span>
	<span class="plek">
		{#if netwerk}
			{@const n = netwerk}
			<button
				type="button"
				class="rij-knop"
				class:aan={n.aan}
				aria-pressed={n.aan}
				aria-label={n.aan
					? n.haalWeg
						? `${naam} uit het netwerk halen`
						: `${naam} staat in het netwerk`
					: `${naam} aan het netwerk toevoegen`}
				title={n.aan ? (n.haalWeg ? 'Uit het netwerk halen' : 'In het netwerk') : 'In het netwerk'}
				onclick={() => (n.aan ? n.haalWeg?.() : n.voegToe())}
				><Picto naam={n.aan ? 'netwerk' : 'netwerk-o'} /></button
			>
		{/if}
	</span>
</span>

<style>
	.rij-acties {
		flex: none;
		display: inline-flex;
		align-items: flex-start;
		gap: var(--s-1);
	}
	/* Two places of one size, filled or not: the glyphs of all rows stand in two columns. */
	.plek {
		display: inline-grid;
		width: var(--veld-h-klein);
		height: var(--veld-h-klein);
	}
	.rij-knop {
		display: inline-grid;
		place-items: center;
		width: 100%;
		height: 100%;
		padding: 0;
		border: 0;
		border-radius: var(--r-1);
		background: none;
		color: var(--ink-3);
		cursor: pointer;
		opacity: 0;
	}
	.rij-knop.aan {
		color: var(--ink);
		opacity: 1;
	}
	:global([data-rij]:hover) .rij-knop,
	:global([data-rij]:focus-within) .rij-knop {
		opacity: 1;
	}
	.rij-knop:hover {
		color: var(--ink);
		background: var(--wassing);
	}
	.rij-knop:focus-visible {
		opacity: 1;
	}
	@media (hover: none) {
		.rij-knop {
			opacity: 1;
		}
	}
	@media (pointer: coarse) {
		.plek {
			width: var(--veld-h);
			height: var(--veld-h);
		}
	}
</style>

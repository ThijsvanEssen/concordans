<script lang="ts">
	// The actions of a list row: Bewaar and Aan het netwerk toevoegen (Thijs, 10 Oct: "Vinkje en +-je zijn niet
	// intuïtief"). One look in every state (Thijs, 10 Oct: "toch wat raar met de verschillen in
	// hoe ze weergegeven worden"): two fixed places, Bewaar then the network, so nothing moves from
	// row to row; a glyph without a frame, open in ink-3 when off, filled in ink when on. Off they
	// show on the row's hover or focus (always on a touch screen), on always. A hover on the glyph
	// gives it ink and a wash behind it; the keyboard's focus the ink ring. A row with more to do
	// (a bundel's: Aantekening, Omhoog, Haal uit) has one ⋯ after them, a menu of its own; it
	// shows as they do, and closes on a tap outside (actions/menu.ts).
	import type { Snippet } from 'svelte';
	import { menu as menuAction } from '$lib/actions/menu';
	import MenuList from './MenuList.svelte';
	import TekstMenu from './TekstMenu.svelte';
	import Picto from './Picto.svelte';
	import { kaart } from '$lib/map/map.svelte';
	import { namesOf, type MapItem } from '$lib/map/map';
	import BundleChecklist from '$lib/map/BundleChecklist.svelte';

	let {
		naam,
		item = null,
		netwerk = null,
		menu,
		onClose
	}: {
		/** The bron as the row names it, for the buttons' names. */
		naam: string;
		/** What Bewaar keeps; without it its place stays empty. */
		item?: MapItem | null;
		/** Whether it is in the network, how to add it and, for a group, to take it out again;
		 * without it its place stays empty. */
		netwerk?: { aan: boolean; voegToe: () => void; haalWeg?: () => void } | null;
		/** What the ⋯ holds, with the function that closes it; without it no ⋯. A row with a ⋯
		 *  alone has no places for Bewaar and the network. */
		menu?: Snippet<[() => void]>;
		/** After the ⋯ closes, however: a menu that changed what it shows goes back. */
		onClose?: () => void;
	} = $props();

	/** The bundels that hold the item: Bewaar keeps it in Mijn markeringen; Bewaard opens the
	 *  bundels with their ticks (BundleChecklist), and takes nothing out itself. */
	const held = $derived(item ? kaart.holding(item) : []);
	const bewaard = $derived(held.length > 0);
	const into = $derived(kaart.keepsIn);
	let open = $state(false);
	let bundlesOpen = $state(false);
	let keptButton = $state<HTMLElement | null>(null);
	const closeBundles = () => (bundlesOpen = false);
</script>

<span class="rij-acties">
	{#if !menu || item || netwerk}{@render places()}{/if}
	{#if menu}
		<span class="plek plek--menu">
			<TekstMenu
				label="{naam}: meer"
				title="Meer"
				buttonClass="rij-knop"
				caret={false}
				rechts
				ownClick
				{onClose}
				bind:open
			>
				{#snippet knop()}⋯{/snippet}
				{#snippet inhoud(close)}{@render menu(close)}{/snippet}
			</TekstMenu>
		</span>
	{/if}
</span>

{#snippet places()}
	<span class="plek" use:menuAction={{ open: bundlesOpen, close: closeBundles }}>
		{#if item}
			{@const kept = item}
			<button
				type="button"
				class="rij-knop"
				class:is-active={bewaard}
				bind:this={keptButton}
				aria-pressed={bewaard}
				aria-haspopup={bewaard ? 'menu' : undefined}
				aria-expanded={bewaard ? bundlesOpen : undefined}
				aria-label={bewaard
					? `${naam}: bewaard in ${namesOf(held)}`
					: `${naam}: bewaren in ${into.naam}`}
				title={bewaard ? `Bewaard in ${namesOf(held)}` : `Bewaar in ${into.naam}`}
				onclick={() => (bewaard ? (bundlesOpen = !bundlesOpen) : kaart.keep(kept, into.id))}
				><Picto naam={bewaard ? 'bewaard' : 'bewaar'} /></button
			>
			{#if bundlesOpen && keptButton}
				<MenuList
					anchor={keptButton}
					label="{naam}: bundels"
					close={closeBundles}
					align="right"
					ownClick
				>
					<BundleChecklist item={kept} close={closeBundles} />
				</MenuList>
			{/if}
		{/if}
	</span>
	<span class="plek">
		{#if netwerk}
			{@const n = netwerk}
			<button
				type="button"
				class="rij-knop"
				class:is-active={n.aan}
				aria-pressed={n.aan}
				aria-label={n.aan
					? n.haalWeg
						? `${naam} uit het netwerk weghalen`
						: `${naam} staat in het netwerk`
					: `${naam} aan het netwerk toevoegen`}
				title={n.aan
					? n.haalWeg
						? 'Uit het netwerk weghalen'
						: 'Staat in het netwerk'
					: 'Aan het netwerk toevoegen'}
				onclick={() => (n.aan ? n.haalWeg?.() : n.voegToe())}
				><Picto naam={n.aan ? 'netwerk' : 'netwerk-o'} /></button
			>
		{/if}
	</span>
{/snippet}

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
		width: var(--tik-h);
		height: var(--tik-h);
	}
	.rij-acties .plek--menu :global(.tekstmenu) {
		display: grid;
		width: 100%;
		height: 100%;
	}
	.rij-acties :global(.rij-knop) {
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
	.rij-acties :global(.rij-knop.is-active) {
		color: var(--ink);
		opacity: 1;
	}
	:global([data-rij]:hover) .rij-acties :global(.rij-knop),
	:global([data-rij]:focus-within) .rij-acties :global(.rij-knop) {
		opacity: 1;
	}
	.rij-acties :global(.rij-knop:hover) {
		color: var(--ink);
		background: var(--wassing);
	}
	.rij-acties :global(.rij-knop:focus-visible),
	.rij-acties :global(.rij-knop[aria-expanded='true']) {
		opacity: 1;
	}
	.rij-acties .plek--menu :global(.rij-knop) {
		font-family: var(--font-ui);
		font-size: var(--t-body-2);
		line-height: 1;
	}
	@media (hover: none) {
		.rij-acties :global(.rij-knop) {
			opacity: 1;
		}
	}
	/* A finger's target for each: 44 px. */
	@media (pointer: coarse), (max-width: 768px) {
		.plek {
			width: calc(var(--s-6) + var(--s-3));
			height: calc(var(--s-6) + var(--s-3));
		}
	}
</style>

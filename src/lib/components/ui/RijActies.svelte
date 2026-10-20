<script lang="ts">
	// The actions of a list row: Bewaar and In netwerk (Thijs, 10 Oct: "Vinkje en +-je zijn niet
	// intuïtief"). One look in every state (Thijs, 10 Oct: "toch wat raar met de verschillen in
	// hoe ze weergegeven worden"): two fixed places, Bewaar then In netwerk, so nothing moves from
	// row to row; a glyph without a frame, open in ink-3 when off, filled in ink when on. Off they
	// show on the row's hover or focus (always on a touch screen), on always. A hover on the glyph
	// gives it ink and a wash behind it; the keyboard's focus the ink ring. A row with more to do
	// (a bundel's: Aantekening, Omhoog, Haal uit) has one ⋯ after them, a menu of its own; it
	// shows as they do, and closes on a tap outside (actions/menu.ts).
	import type { Snippet } from 'svelte';
	import { menu as menuAction } from '$lib/actions/menu';
	import { topLayer } from '$lib/actions/top-layer';
	import Picto from './Picto.svelte';
	import { page } from '$app/state';
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
		 *  alone has no places for Bewaar and In netwerk. */
		menu?: Snippet<[() => void]>;
		/** After the ⋯ closes, however: a menu that changed what it shows goes back. */
		onClose?: () => void;
	} = $props();

	/** The bundels that hold the item: Bewaar keeps it in Losse markeringen; Bewaard opens the
	 *  bundels with their ticks (BundleChecklist), and takes nothing out itself. */
	const held = $derived(item ? kaart.holding(item) : []);
	const bewaard = $derived(held.length > 0);
	const into = $derived(kaart.keepsIn(page.url));
	let open = $state(false);
	let button = $state<HTMLElement | null>(null);
	const close = () => {
		open = false;
		onClose?.();
	};
	let bundlesOpen = $state(false);
	let keptButton = $state<HTMLElement | null>(null);
	const closeBundles = () => (bundlesOpen = false);
</script>

<span class="rij-acties">
	{#if !menu || item || netwerk}{@render places()}{/if}
	{#if menu}
		<span class="plek plek--menu" use:menuAction={{ open, close }}>
			<button
				type="button"
				class="rij-knop"
				class:is-open={open}
				bind:this={button}
				aria-haspopup="menu"
				aria-expanded={open}
				aria-label="{naam}: meer"
				title="Meer"
				onclick={() => (open ? close() : (open = true))}>⋯</button
			>
			{#if open && button}
				<!-- A click in the list is the menu's, not the row's under it. -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="tekstmenu__lijst"
					role="menu"
					tabindex="-1"
					aria-label="{naam}: meer"
					use:topLayer={{ anchor: button, close, align: 'right' }}
					onclick={(e) => e.stopPropagation()}
				>
					{@render menu(close)}
				</div>
			{/if}
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
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="tekstmenu__lijst"
					role="menu"
					tabindex="-1"
					aria-label="{naam}: bundels"
					use:topLayer={{ anchor: keptButton, close: closeBundles, align: 'right' }}
					onclick={(e) => e.stopPropagation()}
				>
					<BundleChecklist item={kept} close={closeBundles} />
				</div>
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
						? `${naam} uit het netwerk halen`
						: `${naam} staat in het netwerk`
					: `${naam} aan het netwerk toevoegen`}
				title={n.aan ? (n.haalWeg ? 'Uit het netwerk halen' : 'In het netwerk') : 'In het netwerk'}
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
	.rij-knop.is-active {
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
	.rij-knop:focus-visible,
	.rij-knop.is-open {
		opacity: 1;
	}
	.plek--menu .rij-knop {
		font-family: var(--font-ui);
		font-size: var(--t-body-2);
		line-height: 1;
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
		/* A finger's target for the ⋯: 44 px. */
		.plek--menu {
			width: calc(var(--s-6) + var(--s-3));
			height: calc(var(--s-6) + var(--s-3));
		}
	}
</style>

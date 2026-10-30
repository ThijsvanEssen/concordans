<script lang="ts">
	import CanvasKaart from '$lib/components/graph/CanvasKaart.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	// The netwerk of chosen bronnen, in the strip at the left of the werkplek, in three blocks:
	// Gekozen (each bron on or off, or taken out), Aangeklikt op het canvas (the selected bron,
	// added with Toevoegen) and the button Bron toevoegen, which opens the search. The context
	// around them is cleared from the head. On an empty Verkenner it is the same panel, empty
	// (one werkplek, one panel).
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import BronToevoegen from './BronToevoegen.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import Vinkje from '$lib/components/ui/Vinkje.svelte';
	import { GROUP_LABEL } from '$lib/graph/collection-role';
	import type { NetwerkEntry } from './netwerk';
	import { formatCount } from '$lib/text/getal';
	import { bronLabel } from '$lib/vocabulary';
	import { bronKind } from '$lib/components/graph/bron-kind';

	/** What a chosen bron is, in a word: a publication is no wet. */
	const soortVan = (e: NetwerkEntry) =>
		(e.node?.raw?.props?.kind === 'publicatie'
			? bronKind(e.collection, e.node.raw.props)
			: bronLabel(e.collection)
		).toLowerCase();

	let {
		entries,
		loading = false,
		expected = 0,
		selection = null,
		onSelect,
		onToggle,
		onRemove,
		onGroepAan,
		onAdd,
		onClear,
		telefoon = false,
		searching = $bindable(false),
		searchingWhy = null
	}: {
		entries: NetwerkEntry[];
		loading?: boolean;
		/** The bronnen of the netwerk asked and not yet in: their rows hold their place. */
		expected?: number;
		/** The selected bron when it is not chosen yet. */
		selection?: { label: string } | null;
		/** Adds a bron found by the search, by the name a link uses. */
		onSelect: (id: string) => void;
		onToggle: (id: string) => void;
		onRemove: (id: string) => void;
		/** A chip greyed with its grouping: switch that grouping on again. */
		onGroepAan?: (kind: NonNullable<NetwerkEntry['verborgenMet']>) => void;
		onAdd: () => void;
		onClear: () => void;
		/** A phone: Gekozen folds after two, Wis alles stands under the list. */
		telefoon?: boolean;
		/** The search for a bron to add is open; the page opens it too, from the empty canvas. */
		searching?: boolean;
		/** Why the page opened it (Alt V with one bron). */
		searchingWhy?: string | null;
	} = $props();

	// A long netwerk (the start page's band opens with fifteen) folds after a few, so it
	// does not cover the canvas.
	// On a phone two, so the werkplek keeps its room for the drawing.
	const FOLD_AT = $derived(telefoon ? 2 : 5);
	let showAll = $state(false);
	const folded = $derived(!showAll && entries.length > FOLD_AT + 1);
	const shown = $derived(folded ? entries.slice(0, FOLD_AT) : entries);
	/** Rows of bronnen still on their way, so Weergave under them does not drop when they arrive. */
	const pending = $derived(
		entries.length < expected ? Math.min(expected, FOLD_AT) - Math.min(entries.length, FOLD_AT) : 0
	);
</script>

<!-- Three blocks under a rule, one task each (NetwerkPaneel in the design system): Gekozen,
	     Aangeklikt op het canvas, Bron toevoegen. Wis alles is one click, and Terug sets it back. -->
<CanvasKaart title="Bronnen" label="Netwerk" class="netwerk">
	{#snippet samenvatting()}
		{#if folded}<span class="tel"
				>{formatCount(shown.length)} van {formatCount(entries.length)}</span
			>{/if}
		{#if loading}<span class="laden punt" role="status" aria-label="Laden" title="Laden"
			></span>{/if}
	{/snippet}
	{#snippet actie()}
		{#if entries.length > 0 && !telefoon}
			<TekstLink onclick={onClear} title="Leeg het netwerk en het canvas; Terug zet het terug"
				>Wis alles</TekstLink
			>
		{/if}
	{/snippet}
	{#if entries.length > 0 || pending > 0}
		<Sectie title="Gekozen" niveau={3} inklapbaar={false}>
			<ul class="rijen">
				{#each shown as e (e.id)}
					<li class="rij" class:uit={!e.on} class:mist={e.missing} class:is-dim={!!e.verborgenMet}>
						<button
							type="button"
							class="rij__naam"
							aria-pressed={e.on}
							disabled={e.missing}
							title={e.missing
								? 'Niet gevonden'
								: e.verborgenMet
									? `Aan met ${GROUP_LABEL[e.verborgenMet]}`
									: e.on
										? `${e.titel ?? e.label}: verbergen`
										: `${e.titel ?? e.label}: tonen`}
							onclick={() => (e.verborgenMet ? onGroepAan?.(e.verborgenMet) : onToggle(e.id))}
						>
							<span class="rij__vink"
								><Vinkje aan={e.on && !e.verborgenMet} gedimd={!!e.verborgenMet} /></span
							>
							<span class="rij__glyph"><KindGlyph collection={e.collection} size={11} /></span>
							<span class="rij__tekst">
								<span class="rij__label">{e.label}</span>
								{#if e.alone}
									<span class="rij__staat" title="Geen verbinding met de andere gekozen bronnen"
										>{soortVan(e)}, zonder verbinding</span
									>
								{:else}
									<span class="rij__staat">{soortVan(e)}</span>
								{/if}
							</span>
						</button>
						<IconButton label="{e.label} uit het netwerk weghalen" onclick={() => onRemove(e.id)}
							>×</IconButton
						>
					</li>
				{/each}
				{#each { length: pending } as _, i (i)}
					<li class="rij rij--wacht" aria-hidden="true"></li>
				{/each}
			</ul>
			{#if folded}
				<p class="verder">
					<TekstLink onclick={() => (showAll = true)}
						>en {entries.length - FOLD_AT} andere</TekstLink
					>
				</p>
			{:else if entries.length > FOLD_AT + 1}
				<p class="verder"><TekstLink onclick={() => (showAll = false)}>minder</TekstLink></p>
			{/if}
		</Sectie>
	{/if}
	{#if selection}
		<Sectie title="Aangeklikt op het canvas" niveau={3} inklapbaar={false}>
			<div class="aangeklikt">
				<span class="aangeklikt__naam">{selection.label}</span>
				<button
					type="button"
					class="btn"
					onclick={onAdd}
					aria-label="{selection.label} toevoegen aan het netwerk">Toevoegen</button
				>
			</div>
		</Sectie>
	{/if}
	<section class="blok blok--toevoegen">
		<button type="button" class="btn toevoegen" onclick={() => (searching = true)}
			>+ Bron toevoegen</button
		>
	</section>
	{#if telefoon && entries.length > 0}
		<!-- On a phone under the list, as the Design System has it (NetwerkPaneel, Telefoon). -->
		<p class="netwerk-acties">
			<TekstLink onclick={onClear} title="Leeg het netwerk en het canvas; Terug zet het terug"
				>Wis alles</TekstLink
			>
		</p>
	{/if}
</CanvasKaart>
{#if searching}
	<BronToevoegen
		chosen={entries.map((e) => e.id)}
		why={searchingWhy}
		{onSelect}
		onClose={() => (searching = false)}
	/>
{/if}

<style>
	.netwerk-acties {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-2) var(--s-4);
		margin: var(--s-3) 0 0;
	}
	.tel {
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
		white-space: nowrap;
	}
	.laden {
		flex: none;
		white-space: nowrap;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* Open, the head has no room for a word beside the actions: a dot of its own, no shift. */
	.laden.punt {
		width: var(--s-2);
		height: var(--s-2);
		border-radius: var(--r-rond);
		background: var(--ink-3);
		animation: laden-puls 1s ease-in-out infinite alternate;
	}
	@keyframes laden-puls {
		from {
			opacity: 0.25;
		}
		to {
			opacity: 1;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.laden.punt {
			animation: none;
		}
	}

	.rijen {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.rij {
		display: flex;
		align-items: flex-start;
		gap: var(--s-1);
		padding: var(--s-1) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.rij--wacht {
		min-height: calc(var(--s-5) + var(--s-4) + 2 * var(--s-1));
	}
	.rij + .rij {
		border-top: 1px solid var(--paper-2);
	}
	.rij__naam {
		flex: 1;
		min-width: 0;
		display: grid;
		grid-template-columns: var(--s-3) var(--s-3) 1fr;
		align-items: start;
		gap: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.rij__naam:disabled {
		cursor: default;
	}
	.rij__vink,
	.rij__glyph {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		height: var(--s-5);
	}
	.rij__tekst {
		display: flex;
		flex-direction: column;
		min-width: 0;
	}
	.rij__label {
		font-weight: 600;
		line-height: var(--s-5);
		overflow-wrap: anywhere;
	}
	.rij__staat {
		font-size: var(--t-micro);
		line-height: var(--s-4);
		color: var(--ink-3);
	}
	.rij.uit .rij__label,
	.rij.mist .rij__label,
	.rij.is-dim .rij__label {
		color: var(--ink-3);
	}
	.rij.uit .rij__label,
	.rij.mist .rij__label {
		font-weight: 400;
	}
	.rij.is-dim .rij__glyph {
		opacity: 0.5;
	}
	.verder {
		margin: var(--s-1) 0 0;
		font-size: var(--t-micro);
	}
	.aangeklikt {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		font-size: var(--t-meta);
	}
	.aangeklikt__naam {
		flex: 1;
		min-width: 0;
		overflow-wrap: anywhere;
	}
	.btn.toevoegen {
		width: 100%;
	}

	@media (max-width: 768px) {
		.netwerk-acties :global(.tekstlink) {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
	@media (pointer: coarse), (max-width: 768px) {
		.rij__naam {
			min-height: var(--veld-h-raak);
		}
		.btn {
			min-height: var(--veld-h-raak);
		}
	}
</style>

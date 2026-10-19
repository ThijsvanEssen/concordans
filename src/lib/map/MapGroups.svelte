<script lang="ts">
	// What a bundel holds, as Gemarkeerd and the bundel's own page show it alike: per law,
	// dossier or judgment under its name (or in the reader's own order), each item a row of
	// Bladeren. A click on a row opens what it keeps in place (MapInhoud); the reader is a
	// step further. A law's name opens the regulations based on it. The reader's notes, an
	// item's and a group's, in the one form (Aantekening). A shared bundel (a link, a file)
	// is read only: no notes to change, no order, nothing to take out.
	import type { SvelteSet } from 'svelte/reactivity';
	import IconButton from '$lib/components/ui/IconButton.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import Caret from '$lib/components/ui/Caret.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { bronLabel, parseNodeId } from '$lib/vocabulary';
	import {
		groepen,
		itemHref,
		isExternal,
		itemKey,
		SOURCE_KINDS,
		type GroepNotities,
		type Map,
		type MapItem
	} from './map';
	import { kaart } from './map.svelte';
	import Aantekening from './Aantekening.svelte';
	import MapInhoud from './MapInhoud.svelte';
	import MapRegelingen from './MapRegelingen.svelte';
	import { onderWet, wetVanGroep } from './verbonden';

	let {
		map,
		items,
		order,
		notes,
		open
	}: {
		/** The bundel of this browser; null for a shared one, read only. */
		map: Map | null;
		items: MapItem[];
		order: Map['volgorde'];
		notes: GroepNotities;
		/** The rows and laws open, by the item's key or `law:<group>`: Alles uitklappen sets them. */
		open: SvelteSet<string>;
	} = $props();

	const groups = $derived(
		order === 'eigen' ? [{ groep: '', sleutel: '', items: [...items] }] : groepen(items)
	);
	function toggle(key: string) {
		if (!open.delete(key)) open.add(key);
	}
	/** A bundel's change: the store acts on the active bundel. */
	function inMap(change: () => void) {
		if (!map) return;
		if (kaart.actief.id !== map.id) kaart.kies(map.id);
		change();
	}

	/** The note open, by its item's or its group's key. */
	let noteOpen = $state<string | null>(null);
	let groupNoteOpen = $state<string | null>(null);
</script>

{#snippet row(i: MapItem)}
	{@const key = itemKey(i)}
	{@const collection = parseNodeId(i.id)?.collection}
	{@const external = isExternal(i)}
	<IndexRow
		title={i.kort}
		href={external ? undefined : itemHref(i)}
		open={open.has(key)}
		onToggle={external && !i.url ? undefined : () => toggle(key)}
	>
		{#snippet lead()}
			{#if collection}<span class="row-id-main"
					><KindGlyph {collection} size={12} />{bronLabel(collection)}</span
				>{:else if external}<span class="row-id-main">{SOURCE_KINDS[i.kind ?? 'other']}</span>{/if}
		{/snippet}
		{#snippet body()}
			{#if i.voluit && i.voluit !== i.kort}<span class="row-sub">{i.voluit}</span>{/if}
			{#if external && i.url}<span class="row-sub alleen-print">{i.url}</span>{/if}
			<Aantekening
				tekst={i.notitie}
				bij={i.kort}
				bind:open={() => noteOpen === key, (v) => (noteOpen = v ? key : null)}
				onBewaar={map ? (t) => inMap(() => kaart.notitie(i, t)) : undefined}
			/>
		{/snippet}
		{#snippet aside()}
			{#if map}
				<span class="knoppen">
					{#if !i.notitie && noteOpen !== key}
						<button type="button" class="notitie-knop raakvlak" onclick={() => (noteOpen = key)}
							>Aantekening</button
						>
					{/if}
					<IconButton
						label="{i.kort} een plaats omhoog"
						onclick={() => inMap(() => kaart.schuif(i, -1))}>↑</IconButton
					>
					<IconButton
						label="{i.kort} een plaats omlaag"
						onclick={() => inMap(() => kaart.schuif(i, 1))}>↓</IconButton
					>
					<IconButton
						label="{i.kort} uit {map.naam} halen"
						onclick={() => inMap(() => kaart.weg(i))}>×</IconButton
					>
				</span>
			{/if}
			{#if external}
				{#if i.url}<TekstLink
						href={i.url}
						target="_blank"
						rel="noopener noreferrer"
						class="naar-lezer"
						aria-label="{i.kort}, de bron">Bron ↗</TekstLink
					>{/if}
			{:else}
				<TekstLink href={itemHref(i)} class="naar-lezer" aria-label="{i.kort} in de lezer"
					>In de lezer</TekstLink
				>
			{/if}
		{/snippet}
		{#snippet detail()}
			{#if external}
				{#if i.url}<p class="adres">
						<TekstLink href={i.url} target="_blank" rel="noopener noreferrer">{i.url}</TekstLink>
					</p>{/if}
			{:else}
				<MapInhoud item={i} href={itemHref(i)} />
			{/if}
		{/snippet}
	</IndexRow>
{/snippet}

{#each groups as g (g.sleutel)}
	{@const note = notes[g.sleutel]}
	{#if g.groep}
		{@const law = wetVanGroep(g.items)}
		{@const lawOpen = !!law && open.has(`law:${g.sleutel}`)}
		<div class="groep-kop">
			<h3 class="groep">
				{#if law}<button
						type="button"
						class="groep-knop"
						aria-expanded={lawOpen}
						onclick={() => toggle(`law:${g.sleutel}`)}
						>{g.groep}<Caret open={lawOpen} side /></button
					>{:else}{g.groep}{/if}<span class="aantal">{g.items.length}</span>
			</h3>
			{#if map && !note && groupNoteOpen !== g.sleutel}
				<button
					type="button"
					class="notitie-knop raakvlak"
					onclick={() => (groupNoteOpen = g.sleutel)}>Aantekening</button
				>
			{/if}
		</div>
		{#if law && lawOpen}
			<div class="wet-open">
				<MapRegelingen laad={() => onderWet(law)} />
				<p class="verder">
					<TekstLink href={buildBronHref(null, `instruments/${law.toLowerCase()}`)}
						>Wet in de lezer</TekstLink
					>
				</p>
			</div>
		{/if}
		<Aantekening
			tekst={note}
			bij={g.groep}
			bind:open={() => groupNoteOpen === g.sleutel, (v) => (groupNoteOpen = v ? g.sleutel : null)}
			onBewaar={map ? (t) => inMap(() => kaart.groepNotitie(g.sleutel, t)) : undefined}
		/>
	{/if}
	<ul class="rijen">
		{#each g.items as i (itemKey(i))}{@render row(i)}{/each}
	</ul>
{/each}

<style>
	/* A law, dossier or judgment over its rows, as a day over Actueel's. */
	.groep {
		margin: 0;
		padding-bottom: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
	}
	/* The group's head with Aantekening at its right, on hover and focus; always on touch. */
	.groep-kop {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		margin: var(--s-3) 0 0;
		border-bottom: 1px solid var(--rule-strong);
	}
	.groep-kop .notitie-knop {
		margin-right: 0;
		opacity: 0;
	}
	.groep-kop:hover .notitie-knop,
	.groep-kop:focus-within .notitie-knop {
		opacity: 1;
	}
	@media (hover: none) {
		.groep-kop .notitie-knop {
			opacity: 1;
		}
	}
	/* A law's name opens what is connected to it, in place, as a row opens. */
	.groep-knop {
		display: inline-flex;
		align-items: baseline;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		text-align: left;
		cursor: pointer;
	}
	.groep-knop:hover {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
		text-underline-offset: 3px;
	}
	.wet-open {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-2) var(--s-2) var(--s-3);
		background: var(--paper-2);
	}
	.wet-open .verder {
		margin: 0;
		font-size: var(--t-meta);
	}
	.aantal {
		margin-left: var(--s-2);
		font-size: var(--t-micro);
		font-weight: 400;
		color: var(--ink-3);
	}
	/* Bladeren's rows: the kind in the lead, the place as the title, the citation under it. */
	.rijen {
		--row-aside: 280px;
		container-type: inline-size;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* Where the list is too narrow for the citation beside the ways on (802 px, UX-toets 14 Oct
	   #61: one word per line), the ways on go under the citation; on a phone the row stacks. */
	@media (min-width: 769px) {
		@container (max-width: 760px) {
			.rijen :global(.row) {
				grid-template-columns: var(--row-lead) minmax(0, 1fr);
			}
			.rijen :global(.row-aside) {
				grid-column: 2;
				justify-content: flex-start;
			}
		}
	}
	.row-id-main {
		display: inline-flex;
		align-items: center;
		gap: var(--s-1);
	}
	.row-sub {
		display: block;
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* Aantekening, up, down and out at the end of the row, on hover and focus; always on a
	   touch screen. */
	.knoppen {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		opacity: 0;
	}
	/* The way to the reader, always in sight: the row's click opens it here. */
	.rijen :global(.naar-lezer) {
		font-size: var(--t-micro);
		white-space: nowrap;
	}
	:global(.row-wrap:hover) .knoppen,
	:global(.row-wrap:focus-within) .knoppen {
		opacity: 1;
	}
	@media (hover: none) {
		.knoppen {
			opacity: 1;
		}
	}
	.notitie-knop {
		margin-right: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: underline;
		text-underline-offset: 2px;
		cursor: pointer;
	}
	.notitie-knop:hover {
		color: var(--ink);
	}
	.adres {
		margin: 0;
		font-size: var(--t-meta);
		overflow-wrap: anywhere;
	}
	.alleen-print {
		display: none;
	}
	/* On paper (the bundel's own page): the research as text. Each row and a group's head
	   with what follows; the ways on, the buttons and the hover's grey left out; the
	   citation in full under the short one, the address of a source outside it. */
	@media print {
		.groep-kop {
			break-after: avoid;
		}
		.rijen :global(.row-wrap) {
			break-inside: avoid;
		}
		.rijen :global(.row) {
			grid-template-columns: var(--row-lead) minmax(0, 1fr);
			background: none;
		}
		.rijen :global(.row-aside),
		.notitie-knop,
		.groep-knop :global(.caret) {
			display: none;
		}
		.rijen :global(.row-title) {
			color: inherit;
			text-decoration: none;
		}
		.row-sub {
			font-size: var(--t-meta);
			color: var(--ink-2);
		}
		.alleen-print {
			display: block;
			overflow-wrap: anywhere;
		}
		.wet-open {
			background: none;
		}
	}
</style>

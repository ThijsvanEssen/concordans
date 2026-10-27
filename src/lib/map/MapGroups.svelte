<script lang="ts">
	// What a bundel holds, on its own page and as a shared one: per law or dossier under its
	// name, the judgments together under Rechtspraak (an r.o. under its judgment), or in the
	// reader's own order; each item a row of Bladeren on one line of citation. A click on a
	// row opens what it keeps in place (MapInhoud); the reader is a step further, from there.
	// What else a row or a group's head does is in its ⋯ (RijActies, as Bladeren's rows):
	// Aantekening, Omhoog and Omlaag, Weghalen; a law the regulations based on it. The
	// reader's notes, an item's and a group's, in the one form (Aantekening). A shared bundel
	// (a link, a file) is read only: no notes to change, no order, nothing to take out.
	import type { SvelteSet } from 'svelte/reactivity';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import RijActies from '$lib/components/ui/RijActies.svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { buildBronHref } from '$lib/bron/href';
	import { lawNodeKey } from '$lib/text/enacted-law';
	import { bronLabel, parseNodeId } from '$lib/vocabulary';
	import {
		groepen,
		groupAnchor,
		itemHref,
		isExternal,
		itemKey,
		placeRows,
		rowTitle,
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
	import NewMark from '$lib/components/ui/NewMark.svelte';
	import FreshList from './FreshList.svelte';
	import type { Fresh } from './fresh.svelte';

	let {
		map,
		items,
		order,
		notes,
		open,
		fresh = null
	}: {
		/** The bundel of this browser; null for a shared one, read only. */
		map: Map | null;
		items: MapItem[];
		order: Map['volgorde'];
		notes: GroepNotities;
		/** The rows and laws open, by the item's key or `law:<group>`: Alles uitklappen sets them. */
		open: SvelteSet<string>;
		/** What is new since the visit before, as it comes in (the bundel's own page). */
		fresh?: Fresh | null;
	} = $props();

	const groups = $derived(
		order === 'eigen' ? [{ groep: '', sleutel: '', items: [...items] }] : groepen(items)
	);
	function toggle(key: string) {
		if (!open.delete(key)) open.add(key);
	}

	/** The note open, by its item's or its group's key. */
	let noteOpen = $state<string | null>(null);
	let groupNoteOpen = $state<string | null>(null);
</script>

<!-- A row: the kind in the lead, the citation as its title; `place` an r.o. under its
     judgment or an alinea under its Kamerstuk, `kept` false for a bron that only heads its
     places. -->
{#snippet row(i: MapItem, place = false, kept = true)}
	{@const key = itemKey(i)}
	{@const collection = parseNodeId(i.id)?.collection}
	{@const external = isExternal(i)}
	{@const cite = rowTitle(i, place)}
	<IndexRow
		title={cite.title}
		href={external ? undefined : itemHref(i)}
		open={open.has(key)}
		member={place}
		onToggle={external && !i.url ? undefined : () => toggle(key)}
	>
		{#snippet lead()}
			{#if place}<span class="row-id-main"></span>{:else if collection}<span class="row-id-main"
					><KindGlyph {collection} size={12} />{bronLabel(collection)}</span
				>{:else if external}<span class="row-id-main">{SOURCE_KINDS[i.kind ?? 'other']}</span
				>{/if}{#if fresh?.isNew(i)}<NewMark />{/if}
		{/snippet}
		{#snippet body()}
			{#if external && i.url}<span class="row-sub alleen-print">{i.url}</span>{/if}
			{#if kept}
				<Aantekening
					tekst={i.notitie}
					bij={i.kort}
					bundel={map?.naam}
					bind:open={() => noteOpen === key, (v) => (noteOpen = v ? key : null)}
					onBewaar={map ? (t) => kaart.notitie(i, t, map.id) : undefined}
				/>
			{/if}
		{/snippet}
		{#snippet aside()}
			{#if map && kept}
				{@const m = map}
				<RijActies naam={cite.title}>
					{#snippet menu(close)}
						{#if !i.notitie}
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									close();
									noteOpen = key;
								}}>Aantekening</button
							>
						{/if}
						{#if order === 'eigen'}
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									close();
									kaart.schuif(i, -1, m.id);
								}}>Omhoog</button
							>
							<button
								type="button"
								role="menuitem"
								class="tekstmenu__item"
								onclick={() => {
									close();
									kaart.schuif(i, 1, m.id);
								}}>Omlaag</button
							>
						{/if}
						<button
							type="button"
							role="menuitem"
							class="tekstmenu__item"
							aria-label="{cite.title} uit de bundel weghalen"
							onclick={() => {
								close();
								kaart.weg(i, m.id);
							}}>Weghalen</button
						>
					{/snippet}
				</RijActies>
			{/if}
		{/snippet}
		{#snippet detail()}
			{#if external}
				{#if i.url}<p class="adres">
						<TekstLink href={i.url} target="_blank" rel="noopener noreferrer">Bron ↗</TekstLink>
					</p>{/if}
			{:else}
				{#if fresh?.isNew(i)}<FreshList
						since={fresh.since}
						lines={fresh.linesOf(i)}
						citing={fresh.citingOf(i)}
					/>{/if}
				<MapInhoud item={i} href={itemHref(i)} />
			{/if}
		{/snippet}
	</IndexRow>
{/snippet}

{#snippet itemRows(items: MapItem[])}
	<ul class="rijen">
		{#each placeRows(items) as r (itemKey(r.head))}
			{@render row(r.head, false, r.kept)}
			{#each r.places as p (itemKey(p))}{@render row(p, true)}{/each}
		{/each}
	</ul>
{/snippet}

{#each groups as g (g.sleutel)}
	{@const note = notes[g.sleutel]}
	{#if g.groep}
		{@const law = wetVanGroep(g.items)}
		{@const lawOpen = !!law && open.has(`law:${g.sleutel}`)}
		{@const groupLines = fresh?.group(g.sleutel) ?? []}
		{@const linesOpen = groupLines.length > 0 && open.has(`new:${g.sleutel}`)}
		<div class="groep">
			<Sectie title={g.groep} niveau={3} inklapbaar={false} id={groupAnchor(g.sleutel)}>
				{#snippet mark()}
					{#if groupLines.length}<button
							type="button"
							class="nieuw-knop raakvlak"
							aria-expanded={linesOpen}
							aria-label="Nieuw in {g.groep}"
							onclick={() => toggle(`new:${g.sleutel}`)}><NewMark /></button
						>{:else if fresh && g.items.some((i) => fresh.isNew(i))}<NewMark />{/if}
				{/snippet}
				{#snippet naast()}
					{#if law || (map && !note)}
						<RijActies naam={g.groep}>
							{#snippet menu(close)}
								{#if law}
									<button
										type="button"
										role="menuitemcheckbox"
										class="tekstmenu__item"
										aria-checked={lawOpen}
										onclick={() => {
											close();
											toggle(`law:${g.sleutel}`);
										}}>Regelingen gebaseerd op</button
									>
								{/if}
								{#if map && !note}
									<button
										type="button"
										role="menuitem"
										class="tekstmenu__item"
										onclick={() => {
											close();
											groupNoteOpen = g.sleutel;
										}}>Aantekening</button
									>
								{/if}
							{/snippet}
						</RijActies>
					{/if}
				{/snippet}
				{#if linesOpen && fresh}
					<div class="wet-open"><FreshList since={fresh.since} lines={groupLines} /></div>
				{/if}
				{#if law && lawOpen}
					<div class="wet-open">
						<MapRegelingen laad={() => onderWet(law)} />
						<p class="verder">
							<TekstLink href={buildBronHref(null, `instruments/${lawNodeKey(law)}`)}
								>Wet in de lezer</TekstLink
							>
						</p>
					</div>
				{/if}
				<Aantekening
					tekst={note}
					bij={g.groep}
					bundel={map?.naam}
					bind:open={
						() => groupNoteOpen === g.sleutel, (v) => (groupNoteOpen = v ? g.sleutel : null)
					}
					onBewaar={map ? (t) => kaart.groepNotitie(g.sleutel, t, map.id) : undefined}
				/>
				{@render itemRows(g.items)}
			</Sectie>
		</div>
	{:else}
		{@render itemRows(g.items)}
	{/if}
{/each}

<style>
	/* One group follows another at the step of a section's groups. */
	.groep {
		margin-top: var(--s-3);
	}
	/* The ⋯ of a group's head shows on its hover and focus, as a row's on the row's. */
	.groep :global(.kop:hover .rij-knop),
	.groep :global(.kop:focus-within .rij-knop) {
		opacity: 1;
	}
	/* The mark of a group with something new opens what came in, in place. */
	.nieuw-knop {
		margin-left: var(--s-2);
		padding: 0;
		border: 0;
		background: none;
		line-height: 1;
		cursor: pointer;
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
	/* Bladeren's rows: the kind in the lead, the citation as the title; the ⋯ at the end. */
	.rijen {
		--row-aside: var(--s-7);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	/* On a phone the row stacks: its ⋯ stays at the right, beside the citation. */
	@media (max-width: 768px) {
		.rijen :global(.row) {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.rijen :global(.row-id) {
			grid-column: 1 / -1;
		}
		.rijen :global(.row-aside) {
			grid-column: 2;
			grid-row: 2;
			padding-top: 0;
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
	.adres {
		margin: 0;
		padding: var(--s-2) 0 var(--s-4);
		font-size: var(--t-meta);
		overflow-wrap: anywhere;
	}
	.alleen-print {
		display: none;
	}
	/* On paper (the bundel's own page): the research as text. Each row and a group's head
	   with what follows; the ⋯ and the hover's grey left out; the address of a source
	   outside it. */
	@media print {
		.groep :global(.kop) {
			break-after: avoid;
		}
		.groep :global(.kop .rij-acties) {
			display: none;
		}
		.rijen :global(.row-wrap) {
			break-inside: avoid;
		}
		.rijen :global(.row) {
			grid-template-columns: var(--voorkolom) minmax(0, 1fr);
			background: none;
		}
		.rijen :global(.row-aside) {
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

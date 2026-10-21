<script lang="ts">
	// An overweging read in place, as the reader sets it: its number hanging in the margin,
	// its text with the citations as links, the paragraphs that continue it and its
	// sub-overwegingen; with `ruim`, the overwegingen around it, the kept one barred. The words
	// that cite `doel` are marked. One component for every place an r.o. is read without its
	// judgment: an opened item of a bundel (MapInhoud) and the card of a reference to an r.o.
	// (OverwegingKaart). With `bewaar`, a number is the overweging's menu, as in the reader:
	// Citeer, Kopieer tekst and Bewaar (overwegingCitaat).
	import PlaatsMenu, { placeMarker } from '$lib/components/articles/PlaatsMenu.svelte';
	import PlaceNumber, { placeColumn } from './PlaceNumber.svelte';
	import { blockClick } from '$lib/actions/klik';
	import TextBlocks from '$lib/components/articles/TextBlocks.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { overwegingVan } from '$lib/map/inhoud';
	import { overwegingCitaat } from '$lib/text/judgment-cite';
	import type { Uitspraak } from './overweging';
	import Voetnoten from '$lib/components/articles/Voetnoten.svelte';
	import type { NootMarker } from '$lib/text/voetnoten';
	import { zetNootStand } from '$lib/text/voetnoten.svelte';

	let {
		uitspraak,
		at,
		ruim = false,
		doel = null,
		bewaar = null,
		noot = null
	}: {
		uitspraak: Uitspraak;
		/** The overweging: `rov-5.1`. */
		at: string;
		/** The overwegingen around it too. */
		ruim?: boolean;
		/** The bron whose citations are marked: the article the r.o. is read for. */
		doel?: string | null;
		/** The menu of a number: the item's id it keeps under, and the link to a place. */
		bewaar?: { id: string; link: (anker: string) => string } | null;
		/** The note the citation stands in (`fn-35`): open, its words that cite `doel` marked. */
		noot?: string | null;
	} = $props();

	// Its own notes, under each overweging: a marker opens one; `noot` is open from the start.
	const noten = zetNootStand();
	$effect(() => noten.toon(noot, { doel }));
	const nootVan = (markers: NootMarker[] | undefined) =>
		(markers ?? []).flatMap((m) => uitspraak.noten.get(m.id) ?? []);

	const deel = $derived(overwegingVan(uitspraak.items, at, ruim));

	/** The overweging whose menu is open, and the number it hangs from. */
	let menu = $state<{ id: string; anker: HTMLElement } | null>(null);
	function openMenu(id: string, anker: HTMLElement) {
		menu = menu?.id === id ? null : { id, anker };
	}
	/** A click on an overweging's text opens its menu, as in the reader (blockClick). */
	const opTekst = (id: string) => (e: MouseEvent) => {
		const anker = placeMarker(e, '.rov');
		if (anker) openMenu(id, anker);
	};
</script>

{#if deel}
	<div class="overweging" use:placeColumn={deel.items}>
		{#each deel.items as b, k (k)}
			{#if b.kind === 'rov'}
				{@const forms = bewaar
					? overwegingCitaat(uitspraak.j, b.num, b.id, bewaar.link(b.id), bewaar.id)
					: null}
				<div
					class="rov plaats-blok"
					class:eigen={ruim && deel.eigen.has(k)}
					class:is-open={menu?.id === b.id}
				>
					<PlaceNumber
						number={b.num}
						label="Overweging {b.num}"
						open={menu?.id === b.id}
						onopen={forms ? (marker) => openMenu(b.id, marker) : null}
					/>
					<div class:is-klikbaar={!!forms} use:blockClick={forms ? opTekst(b.id) : null}>
						<TextBlocks
							text={b.body}
							tables={b.tables ?? []}
							citations={b.citations}
							target={doel}
							notes={b.noten}
						/>
						<Voetnoten noten={nootVan(b.noten)} ids={false} marge={false} />
					</div>
					{#if menu && menu.id === b.id && forms}
						<PlaatsMenu
							anker={menu.anker}
							title={forms.kort}
							cite={citeItems(forms, forms.link)}
							tekst={() => b.body}
							bewaar={forms.bewaar}
							onClose={() => (menu = null)}
						/>
					{/if}
				</div>
			{:else if b.kind === 'prose'}
				<div class="rov-verder" class:eigen={ruim && deel.eigen.has(k)}>
					<TextBlocks
						text={b.body}
						tables={b.tables ?? []}
						citations={b.citations}
						target={doel}
						notes={b.noten}
					/>
					<Voetnoten noten={nootVan(b.noten)} ids={false} marge={false} />
				</div>
			{:else}
				<p class="rov-kop">{b.text}</p>
			{/if}
		{/each}
	</div>
{/if}

<style>
	/* Its number in a column as wide as the widest (PlaceNumber, placeColumn). */
	.overweging {
		--rov-num: max(3em, var(--plaats-num, 0px));
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.overweging p {
		margin: 0;
	}
	.rov {
		position: relative;
		display: grid;
		grid-template-columns: var(--rov-num) minmax(0, 1fr);
		gap: 0 var(--s-3);
	}
	.rov:has(:global(.plaats-marker)):hover,
	.rov.is-open {
		background: var(--paper-2);
	}
	.is-klikbaar {
		cursor: pointer;
	}
	.rov-verder {
		position: relative;
		margin-left: calc(var(--rov-num) + var(--s-3));
	}
	.rov-kop {
		font-weight: 600;
	}
	/* The overweging kept, among those around it: the bar of a kept place. */
	.eigen::before {
		content: '';
		position: absolute;
		left: calc(-1 * var(--s-3));
		top: var(--s-1);
		bottom: var(--s-1);
		width: 3px;
		background: var(--ink);
	}
</style>

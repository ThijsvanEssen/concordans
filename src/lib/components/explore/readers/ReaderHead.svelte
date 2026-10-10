<script lang="ts">
	import { opsomming } from '$lib/text/opsomming';
	// The head of every reader, one form (Thijs, 10 Oct: "gelijke experience op gelijke
	// pagina's"): the line of the kind or the place of the bron, the title, what stands under
	// the title, and the status line with the actions at its right, in that order and with the
	// same steps between them. A reader passes data and its words: the actions come from
	// KopActies through `acties`, Bewaar always, Citeer where the kind is cited (KOP_ACTIES);
	// what only one kind has (Vergelijken, the peildatum) comes in `extra`, before them.
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import type { Snippet } from 'svelte';
	import KopActies from './KopActies.svelte';
	import { KOP_ACTIES, type Acties } from './kop-acties';

	let {
		collection,
		juris,
		kind = null,
		title,
		place = [],
		placeTitle = null,
		nav,
		soort,
		onderTitel,
		status,
		acties,
		extra,
		children
	}: {
		collection: Collection;
		juris?: string | null;
		/** The kind of the bron where it is more precise than its collection: `Conclusie`. */
		kind?: string | null;
		title: string;
		/** The place of the bron, printed above the title: `Wetboek van Strafrecht, Tweede Boek, Titel XX`. */
		place?: string[];
		/** The heading of the innermost layer, after the place: `Zorgvuldigheid en belangenafweging`. */
		placeTitle?: string | null;
		/** Links to the previous and next bron, at the end of the first line. */
		nav?: Snippet;
		/** The line above the title in a reader's own words (a mark, a date): else its kind. */
		soort?: Snippet;
		/** What stands under the title: the official title, the indieners, what a bill amends. */
		onderTitel?: Snippet;
		/** The words of the status line: `Geldend recht, tekst sinds 1 maart 2019`. */
		status?: Snippet;
		/** The actions of the head: Bewaar always, Citeer where the kind is cited. */
		acties: Acties;
		/** A control only this kind has, before the actions: Vergelijken. */
		extra?: Snippet;
		/** Rows under the status line: where the text came from, what is coming. */
		children?: Snippet;
	} = $props();

	const citeer = $derived(KOP_ACTIES[collection]?.citeer ?? false);
</script>

<div class="reader-head">
	<div class="reader-line">
		{#if soort}
			<div class="reader-kind">{@render soort()}</div>
		{:else if place.length > 0 || placeTitle}
			<!-- One line on a wide screen, the whole of it on hover; wrapped on a phone. A place
			     the band Behoort bij names already gives only its heading. -->
			<div class="reader-place" title={[place.join(', '), placeTitle].filter(Boolean).join('. ')}>
				{place.join(', ')}{#if place.length > 0 && placeTitle}.
				{/if}{#if placeTitle}<i>{placeTitle}</i>{/if}
			</div>
		{:else}
			<div class="reader-kind">
				<!-- One run of words: the kind as a link, the jurisdiction after its comma. -->
				<SoortLink {collection}><span>{kind ?? bronLabel(collection)}</span></SoortLink
				>{#if opsomming([juris])}<span class="reader-juris">, {opsomming([juris])}</span>{/if}
			</div>
		{/if}
		{@render nav?.()}
	</div>
	<!-- A break may fall after a colon (an ECLI); copying keeps the text as it is. -->
	<h2 class="reader-title">
		{#each title.split(/(?<=:)/) as part, i (i)}{#if i}<wbr />{/if}{part}{/each}
	</h2>
	{#if onderTitel}<div class="reader-onder">{@render onderTitel()}</div>{/if}
	<!-- The status at the left, the actions at its right: on every reader in this place. -->
	<div class="reader-status">
		<div class="reader-status__woorden">{@render status?.()}</div>
		<span class="reader-status__acties">
			{@render extra?.()}
			<KopActies
				bewaar={acties.bewaar}
				wat={acties.wat ?? ''}
				cite={citeer ? (acties.cite ?? []) : []}
				naam={acties.naam ?? ''}
				bron={acties.bron ?? null}
				tekst={acties.tekst}
			/>
		</span>
	</div>
	{#if children}<div class="reader-rijen">{@render children()}</div>{/if}
</div>

<style>
	/* One step from the head to what follows, on every reader: a reader that spaces its blocks
	   with a gap names it (--lezer-stap), and the head's margin makes up the rest. */
	.reader-head {
		margin-bottom: calc(var(--s-6) - var(--lezer-stap, 0px));
	}

	.reader-line {
		display: flex;
		align-items: baseline;
		gap: var(--s-4);
		margin-bottom: var(--s-2);
	}

	/* One run of words ("Uitspraak, Hoge Raad"): text, not a row of items with gaps; a mark
	   in it (KindGlyph) keeps a step to the word after it. */
	.reader-kind {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The place of an article in its law, in the letter of the law. */
	.reader-kind :global(.soort) {
		display: inline;
	}
	.reader-kind :global(.kind-glyph) {
		margin-right: var(--s-1);
		vertical-align: -1px;
	}
	.reader-place {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.reader-place i {
		color: var(--ink-2);
	}
	@media (max-width: 640px) {
		.reader-line {
			flex-wrap: wrap;
			row-gap: var(--s-2);
		}
		.reader-place {
			flex-basis: 100%;
			white-space: normal;
		}
	}

	.reader-title {
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-weight: 600;
		font-size: var(--t-h1);
		line-height: 1.15;
		color: var(--ink);
		text-wrap: pretty;
		/* An ECLI or a long number is one word; on a phone it breaks rather than run past the
		   column. */
		overflow-wrap: anywhere;
	}
	.reader-onder {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	/* The status line: its words in ink at meta size, the actions at its right; on a phone the
	   actions on a line of their own (KopActies). */
	.reader-status {
		/* A popup of the status (the versions of an article) hangs from the line's start. */
		position: relative;
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: var(--s-2) var(--s-4);
		min-height: var(--veld-h-klein);
	}
	.reader-status__woorden {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		flex: 1 1 16em;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	.reader-status__woorden :global(p) {
		margin: 0;
	}
	.reader-status__acties {
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
		margin-left: auto;
	}
	@media (max-width: 767px) {
		.reader-status__acties {
			margin-left: 0;
		}
	}
	.reader-rijen {
		display: grid;
		gap: var(--s-2);
		margin-top: var(--s-2);
	}
</style>

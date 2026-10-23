<script lang="ts">
	import { joinParts } from '$lib/text/words';
	import { titleParts } from '$lib/text/title-parts';
	// The head of every reader, one form (Thijs, 10 Oct: "gelijke experience op gelijke
	// pagina's"): the line of the kind or the place of the bron, the title, what stands under
	// the title, and the status line with the actions at its right, in that order and with the
	// same steps between them. A reader passes data and its words: the actions come from
	// KopActies through `acties`, Bewaar always, Citeer where the kind is cited (KOP_ACTIES);
	// what only one kind has (Vergelijken, the peildatum) comes in `extra`, before them.
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import GlossaryPill from './GlossaryPill.svelte';
	import type { GlossaryTerm } from '$lib/glossary';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import { getContext, type Snippet } from 'svelte';
	import KopActies from './KopActies.svelte';
	import SearchInText from '../SearchInText.svelte';
	import { FIND_KEY, type FindInText } from '../search-state.svelte';
	import { KOP_ACTIES, type Acties } from './kop-acties';

	let {
		collection,
		juris,
		kindLabel = null,
		kindTerm = null,
		kindParts = [],
		lijst,
		title,
		place = [],
		placeTitle = null,
		nav,
		onderTitel,
		statusLine,
		later,
		laterPlek = false,
		statusHeld = false,
		facts,
		acties,
		extra,
		children
	}: {
		collection: Collection;
		juris?: string | null;
		/** The kind of the bron where it is more precise than its collection: `Conclusie`. */
		kindLabel?: string | null;
		/** A kind with a plain explanation (Motie, MvT): the word becomes a term beside the glyph. */
		kindTerm?: GlossaryTerm | null;
		/** What follows the kind after a comma: a date, a court, a chamber. Data, never a line. */
		kindParts?: readonly (string | number | null | undefined | false)[];
		/** The list the kind leads to where that is not its collection: `ministers`. */
		lijst?: 'ministers' | Collection;
		title: string;
		/** The place of the bron, printed above the title: `Wetboek van Strafrecht, Tweede Boek, Titel XX`. */
		place?: string[];
		/** The heading of the innermost layer, after the place: `Zorgvuldigheid en belangenafweging`. */
		placeTitle?: string | null;
		/** Links to the previous and next bron, at the end of the first line. */
		nav?: Snippet;
		/** What stands under the title: the official title, the indieners, what a bill amends. */
		onderTitel?: Snippet;
		/** The words of the status line: `Geldend recht, tekst sinds 1 maart 2019`. */
		statusLine?: Snippet;
		/** A phrase that comes after the text (the bills that touch an article, from
		 * Verbonden): on a line of its own under the status. */
		later?: Snippet;
		/** That line kept from the start, empty or not, so its phrase moves nothing when it
		 * comes (Sv 147: 22 px, 10 Oct). */
		laterPlek?: boolean;
		/** The status line kept from the start, empty or not, for words that come with a later answer. */
		statusHeld?: boolean;
		/** The facts of the bron as a strip of label and value (Feiten `strip`): in force since,
		 * the text of which day, its articles, how often it is cited. */
		facts?: Snippet;
		/** The actions of the head: Bewaar always, Citeer where the kind is cited. */
		acties: Acties;
		/** A control only this kind has, before the actions: Vergelijken. */
		extra?: Snippet;
		/** Rows under the status line: where the text came from, what is coming. */
		children?: Snippet;
	} = $props();

	const kindRest = $derived(joinParts([juris, ...kindParts]));
	const cited = $derived(KOP_ACTIES[collection]?.citeer ?? false);
	// "Zoek in dit stuk" of the frame (ReaderFrame `find`), in the one row of the actions.
	const finder = getContext<FindInText | undefined>(FIND_KEY);
</script>

<div class="reader-head">
	<div class="reader-line" class:reader-line--plaats={collection === 'articles'}>
		{#if place.length > 0 || placeTitle}
			<!-- One line on a wide screen, the whole of it on hover; wrapped on a phone. A place
			     the band Behoort bij names already gives only its heading. -->
			<div class="reader-place" title={[place.join(', '), placeTitle].filter(Boolean).join('. ')}>
				<SoortLink {collection} {lijst} glyphOnly />{place.join(
					', '
				)}{#if place.length > 0 && placeTitle}.
				{/if}{#if placeTitle}<i>{placeTitle}</i>{/if}
			</div>
		{:else}
			<div class="reader-kind">
				<!-- One run of words, one form on every kind: glyph and kind as a link to its list,
				     the rest after its commas. A kind with a term keeps the link on the glyph. -->
				{#if kindTerm}<SoortLink {collection} {lijst} glyphOnly /><GlossaryPill
						term={kindTerm}
						label={kindLabel ?? kindTerm}
					/>{:else}<SoortLink {collection} {lijst}
						><span>{kindLabel ?? bronLabel(collection)}</span></SoortLink
					>{/if}{#if kindRest}<span class="reader-juris">, {kindRest}</span>{/if}
			</div>
		{/if}
		{@render nav?.()}
	</div>
	<!-- A break may fall after a colon (an ECLI); copying keeps the text as it is. -->
	<!-- The page's one h1: the bron (UX-toets 10 Oct, #21). -->
	<h1 class="reader-title">
		{#each titleParts(title) as part, i (i)}{#if i}<wbr />{/if}{part}{/each}
	</h1>
	{#if onderTitel}<div class="reader-onder">{@render onderTitel()}</div>{/if}
	<!-- The status, then the actions on a row of their own: the words have the column's width,
	     so a phrase that comes late (the memorie, the bill) does not push the actions or wrap
	     beside them (Thijs, 10 Oct, approved suggestion 5). On every reader in this place. -->
	<div class="reader-status">
		<div class="reader-status__woorden" class:plek={statusHeld}>{@render statusLine?.()}</div>
		{#if later || laterPlek}<div class="reader-status__later">{@render later?.()}</div>{/if}
		{#if facts}<div class="reader-facts">{@render facts()}</div>{/if}
		<!-- The actions of the stuk in one row (A190, E2: a frame for an action or a menu): what
		     only this kind has, Bewaar and Citeer, then Zoek in dit stuk. -->
		<span class="reader-status__acties">
			{@render extra?.()}
			<KopActies
				bewaar={acties.bewaar}
				wat={acties.wat ?? ''}
				cite={cited ? (acties.cite ?? []) : []}
				naam={acties.naam ?? ''}
				bron={acties.bron ?? null}
				tekst={acties.tekst}
				follow={acties.follow ?? null}
				atom={acties.atom ?? null}
			/>
			{#if finder?.find}
				<!-- A tool of the text, not an action on the bron: bare, with its glass, at the row's
				     right edge (E2: a frame for an action or a menu; Thijs chose variant x, 23 Oct). -->
				<button
					type="button"
					class="find-btn raakvlak"
					class:is-active={finder.search.open}
					aria-expanded={finder.search.open}
					onclick={() => finder.search.toggle()}
					><svg
						width="14"
						height="14"
						viewBox="0 0 16 16"
						fill="none"
						stroke="currentColor"
						stroke-width="1.6"
						aria-hidden="true"><circle cx="7" cy="7" r="4.8" /><path d="M10.6 10.6 14 14" /></svg
					>Zoek in dit stuk</button
				>
			{/if}
		</span>
	</div>
	{#if children}<div class="reader-rijen">{@render children()}</div>{/if}
</div>
<!-- The field under the head, beside it and not in it: it stays at the top of the text while
     the text scrolls (sticky in the reader's own block, which holds the text). -->
{#if finder?.find && finder.search.open}<SearchInText
		root={finder.search.column}
		onClose={() => finder.search.close()}
	/>{/if}

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

	/* An article's line becomes its place (Begunstiging, ← Vorig) when the list of its law
	   comes, which may be after its text: the line keeps that height from the start. */
	.reader-line--plaats {
		min-height: calc(var(--t-body-2) * var(--lh-snug));
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
		/* Its own height, whatever face stands in while the italic loads (1.5 px, Sv 147). */
		line-height: var(--lh-snug);
		color: var(--ink-3);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
	.reader-place :global(.kind-glyph) {
		margin-right: var(--s-1);
	}
	.reader-place i {
		color: var(--ink-2);
	}
	@media (max-width: 640px) {
		.reader-line {
			flex-wrap: wrap;
			row-gap: var(--s-2);
		}
		/* On a phone the place and Vorig, Volgend stand on two rows. */
		.reader-line--plaats {
			min-height: calc(
				var(--t-body-2) * var(--lh-snug) + var(--s-2) + var(--t-micro) * var(--lh-snug)
			);
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
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-2);
	}
	.reader-status__woorden {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-1) var(--s-3);
		align-self: stretch;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}
	/* A row, so an inline-flex phrase (a mark and its words) keeps the line's own height. */
	.reader-status__later {
		align-self: stretch;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-1) var(--s-3);
		min-height: calc(var(--t-meta) * var(--lh-snug));
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.reader-status__woorden.plek {
		min-height: calc(var(--t-meta) * var(--lh-snug));
	}
	.reader-status__woorden :global(p) {
		margin: 0;
	}
	.reader-status__acties {
		align-self: stretch;
		display: inline-flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--s-2);
	}
	/* On a touch screen and below 768 the lines of the status and of the actions stand apart enough that
	   the 44 px of their controls (.btn, .tekstmenu__knop) do not meet. */
	@media (pointer: coarse), (max-width: 768px) {
		.reader-status {
			gap: var(--s-4);
		}
		.reader-status__acties {
			row-gap: var(--s-5);
		}
	}
	/* Zoek in dit stuk: the quiet tool at the right of Bewaar and Citeer, in the letter of the
	   controls, underlined under the pointer and while the field is open. */
	.find-btn {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		height: var(--veld-h);
		margin-left: auto;
		padding: 0 var(--s-2);
		border: 0;
		background: none;
		font-family: var(--font-ui);
		font-size: var(--t-ui);
		color: var(--ink-2);
		cursor: pointer;
	}
	/* On a phone, where it wraps under Bewaar and Citeer, at the text's edge as they are. */
	@media (max-width: 640px) {
		.find-btn {
			margin-left: calc(-1 * var(--s-2));
		}
	}
	.find-btn:hover,
	.find-btn.is-active {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	/* The facts a block of their own between the words of the status and the actions, a
	   hairline over them; no rule under the actions, the text's own first rule follows. */
	.reader-facts {
		align-self: stretch;
		margin: var(--s-2) 0 var(--s-1);
		padding-top: var(--s-3);
		border-top: 1px solid var(--rule);
	}
	.reader-rijen {
		display: grid;
		gap: var(--s-2);
		margin-top: var(--s-2);
	}
</style>

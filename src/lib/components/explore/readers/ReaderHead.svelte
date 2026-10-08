<script lang="ts">
	// Running head of the text readers: one grey line with the place of the bron (for an
	// article: law, book, title; otherwise the kind), then the title. Reader-specific
	// rows go in the snippet. `nav` sits at the end of the first line, whose place does
	// not move from one bron to the next, so stepping through them keeps the pointer still.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import type { Snippet } from 'svelte';

	let {
		collection,
		juris,
		kind = null,
		title,
		place = [],
		placeTitle = null,
		nav,
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
		children?: Snippet;
	} = $props();
</script>

<div class="reader-head">
	<div class="reader-line">
		{#if place.length > 0 || placeTitle}
			<!-- One line on a wide screen, the whole of it on hover; wrapped on a phone. A place
			     the band Behoort bij names already gives only its heading. -->
			<div class="reader-place" title={[place.join(', '), placeTitle].filter(Boolean).join('. ')}>
				{place.join(', ')}{#if place.length > 0 && placeTitle}.{' '}{/if}{#if placeTitle}<i
						>{placeTitle}</i
					>{/if}
			</div>
		{:else}
			<div class="reader-kind">
				<KindGlyph {collection} />
				<span>{kind ?? bronLabel(collection)}</span>
				{#if juris}<span class="reader-juris komma">, {juris}</span>{/if}
			</div>
		{/if}
		{@render nav?.()}
	</div>
	<!-- A break may fall after a colon (an ECLI); copying keeps the text as it is. -->
	<h2 class="reader-title">
		{#each title.split(/(?<=:)/) as part, i (i)}{#if i}<wbr />{/if}{part}{/each}
	</h2>
	{@render children?.()}
</div>

<style>
	.reader-head {
		margin-bottom: var(--s-6);
	}

	.reader-line {
		display: flex;
		align-items: baseline;
		gap: var(--s-4);
		margin-bottom: 10px;
	}

	.reader-kind {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The place of an article in its law, in the letter of the law. */
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
		font-weight: 500;
		font-size: var(--t-h1);
		line-height: 1.15;
		color: var(--ink);
		text-wrap: pretty;
		/* An ECLI or a long number is one word; on a phone it breaks rather than run past the
		   column. */
		overflow-wrap: anywhere;
	}
	/* The jurisdiction after a comma, against the kind: the line's gap only after it. */
	.komma {
		margin-left: calc(-1 * var(--s-2));
	}
</style>

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
		title,
		place = [],
		placeTitle = null,
		nav,
		children
	}: {
		collection: Collection;
		juris?: string | null;
		title: string;
		/** The place of the bron, printed above the title: `Wetboek van Strafrecht · Tweede Boek · Titel XX`. */
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
		{#if place.length > 0}
			<!-- One line on a wide screen, the whole of it on hover; wrapped on a phone. -->
			<div
				class="reader-place"
				title={placeTitle ? `${place.join(', ')}. ${placeTitle}` : place.join(', ')}
			>
				{place.join(', ')}{#if placeTitle}. <i>{placeTitle}</i>{/if}
			</div>
		{:else}
			<div class="reader-kind">
				<KindGlyph {collection} />
				<span>{bronLabel(collection)}</span>
				{#if juris}<span class="reader-juris">· {juris}</span>{/if}
			</div>
		{/if}
		{@render nav?.()}
	</div>
	<h2 class="reader-title">{title}</h2>
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
	}
</style>

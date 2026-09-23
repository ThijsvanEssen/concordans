<script lang="ts">
	// Running head of the text readers: one grey line with the place of the bron (for an
	// article: law, book, title; otherwise the kind), then the title. Reader-specific
	// rows go in the snippet.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import type { Snippet } from 'svelte';

	let {
		collection,
		juris,
		title,
		place = [],
		children
	}: {
		collection: Collection;
		juris?: string | null;
		title: string;
		/** The place of the bron, printed above the title: `Wetboek van Strafrecht · Tweede Boek · Titel XX`. */
		place?: string[];
		children?: Snippet;
	} = $props();
</script>

<div class="reader-head">
	{#if place.length > 0}
		<div class="reader-place">{place.join(' · ')}</div>
	{:else}
		<div class="reader-kind">
			<KindGlyph {collection} />
			<span>{bronLabel(collection)}</span>
			{#if juris}<span class="reader-juris">· {juris}</span>{/if}
		</div>
	{/if}
	<h2 class="reader-title">{title}</h2>
	{@render children?.()}
</div>

<style>
	.reader-head {
		margin-bottom: var(--s-6);
	}

	.reader-place,
	.reader-kind {
		display: flex;
		align-items: baseline;
		gap: 8px;
		margin-bottom: 10px;
		font-family: var(--font-sans);
		font-size: 12.5px;
		color: var(--ink-3);
	}

	.reader-title {
		margin: 0 0 8px;
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: var(--t-h1);
		line-height: 1.15;
		color: var(--ink);
		text-wrap: pretty;
	}
</style>

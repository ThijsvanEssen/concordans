<script lang="ts">
	// Running head of the text readers: the glyph and name of the kind, then the title.
	// Reader-specific rows (citation, meta, in-flux count) go in the snippet.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel, type Collection } from '$lib/vocabulary';
	import type { Snippet } from 'svelte';

	let {
		collection,
		juris,
		title,
		children
	}: {
		collection: Collection;
		juris?: string | null;
		title: string;
		children?: Snippet;
	} = $props();
</script>

<div class="reader-head">
	<div class="reader-kind">
		<KindGlyph {collection} />
		<span>{bronLabel(collection)}</span>
		{#if juris}<span class="reader-juris">· {juris}</span>{/if}
	</div>
	<h2 class="reader-title">{title}</h2>
	{@render children?.()}
</div>

<style>
	.reader-head {
		margin-bottom: var(--s-6);
	}

	.reader-kind {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 18px;
	}

	.reader-juris {
		color: var(--fg-4);
		text-transform: none;
		letter-spacing: 0;
	}

	.reader-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 26px;
		line-height: 1.2;
		letter-spacing: -0.01em;
		margin: 0 0 8px;
		color: var(--ink);
		text-wrap: pretty;
	}
</style>

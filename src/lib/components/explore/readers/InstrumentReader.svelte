<script lang="ts">
	// Reader for instruments: the articles of the whole regulation in natural order. A
	// publication in the Staatsblad or Staatscourant has no articles of its own: it is
	// shown by its dates, and the articles it changes are in the panel Verbonden.
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { lawIdOf, type GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';
	import { formatLongDate, textProp } from './_shared';
	import { publicationName } from '../law-head';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const bwbId = $derived(lawIdOf(p) ?? node.key.toUpperCase());
	const publication = $derived(textProp(p.publication_kind));
</script>

<ReaderFrame>
	{#if publication}
		<ReaderHead
			collection="instruments"
			title={textProp(p.display_name) ?? node.label}
			place={[publicationName(publication)]}
		>
			<p class="publication">
				{#if textProp(p.date_signed)}Ondertekend {formatLongDate(textProp(p.date_signed))}.{/if}
				{#if textProp(p.date_published)}Gepubliceerd {formatLongDate(
						textProp(p.date_published)
					)}.{/if}
			</p>
		</ReaderHead>
	{:else}
		<WholeLawReader {bwbId} />
	{/if}
</ReaderFrame>

<style>
	.publication {
		margin: 0 0 var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
</style>

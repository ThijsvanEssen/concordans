<script lang="ts">
	import { textOf } from '$lib/text/words';
	import { langeDatum } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	// Reader for instruments: the articles of the whole regulation in natural order. A
	// publication in the Staatsblad or Staatscourant has no articles of its own: it is
	// shown by its dates, and the articles it changes are in the panel Verbonden.
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { instrumentLawId, type GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';
	import { publicationName } from '../law-head';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { permalink } from '$lib/bron/landing';
	import { page } from '$app/state';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const bwbId = $derived(instrumentLawId(p, node.key));
	const publication = $derived(textOf(p.publication_kind));
</script>

<ReaderFrame>
	{#if publication}
		{@const titel = textOf(p.display_name) ?? node.label}
		<ReaderHead
			collection="instruments"
			title={titel}
			place={[publicationName(publication)]}
			acties={{
				bewaar: bewaarItem(node.id, { kort: titel, voluit: titel }, { groep: titel }),
				cite: citeItems({ kort: titel, voluit: titel }, permalink(page.url, '')),
				naam: titel
			}}
		>
			{#snippet statusLine()}
				{#if textOf(p.date_signed)}<span>Ondertekend {langeDatum(textOf(p.date_signed))}.</span
					>{/if}
				{#if textOf(p.date_published)}<span
						>Gepubliceerd {langeDatum(textOf(p.date_published))}.</span
					>{/if}
			{/snippet}
		</ReaderHead>
	{:else}
		<WholeLawReader {bwbId} />
	{/if}
</ReaderFrame>

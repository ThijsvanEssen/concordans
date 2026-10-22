<script lang="ts">
	import { textOf } from '$lib/text/words';
	import { langeDatum } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	// Reader for instruments: the articles of the whole regulation in natural order. A
	// publication in the Staatsblad or Staatscourant has no articles of its own: it is
	// shown by its dates, and the articles it changes are in the panel Verbonden. Its text is
	// at its source (`completeness.text` not_fetched): the head says so, with the link.
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';
	import { instrumentLawId, type GraphNode } from '$lib/graph/types';
	import WholeLawReader from '../WholeLawReader.svelte';
	import { publicationName, publicationTitle, sourceName } from '../law-head';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import { getInstrumentDetail } from '$lib/api/instrument-cache';
	import { load } from '$lib/util/load.svelte';
	import { citeItems } from '$lib/components/ui/cite-items';
	import { permalink } from '$lib/bron/landing';
	import { page } from '$app/state';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const bwbId = $derived(instrumentLawId(p, node.key));
	const publication = $derived(textOf(p.publication_kind));
	// The node paints the head; its record adds what the source has (lui, after the first paint).
	const detail = load(
		() => (publication ? node.key.toUpperCase() : null),
		(key) => (key ? getInstrumentDetail(key) : Promise.resolve(null)),
		'Publicatie, gegevens'
	);
	const record = $derived(detail.state.status === 'ready' ? detail.state.data : null);
	const official = $derived(
		record?.official_url
			? { label: sourceName(record.official_url) ?? 'Officiële tekst', href: record.official_url }
			: null
	);
</script>

<ReaderFrame>
	{#if publication}
		{@const titel = textOf(p.display_name) ?? node.label}
		{@const fullTitle = publicationTitle(node.raw?.title, titel)}
		<ReaderHead
			collection="instruments"
			title={titel}
			place={[publicationName(publication)]}
			acties={{
				bewaar: bewaarItem(node.id, { kort: titel, voluit: titel }, { groep: titel }),
				cite: citeItems({ kort: titel, voluit: titel }, permalink(page.url, '')),
				naam: titel,
				bron: official
			}}
		>
			{#snippet onderTitel()}
				{#if fullTitle}<p class="publicatie-titel">{fullTitle}</p>{/if}
			{/snippet}
			{#snippet statusLine()}
				{#if textOf(p.date_signed)}<span>Ondertekend {langeDatum(textOf(p.date_signed))}.</span
					>{/if}
				{#if textOf(p.date_published)}<span
						>Gepubliceerd {langeDatum(textOf(p.date_published))}.</span
					>{/if}
				{#if record?.completeness?.text?.state === 'not_fetched'}
					<Coverage coverage={record.completeness} bron={official} />
				{/if}
			{/snippet}
		</ReaderHead>
	{:else}
		<WholeLawReader {bwbId} />
	{/if}
</ReaderFrame>

<style>
	/* The official title under the name, as a law's (WholeLawReader). */
	.publicatie-titel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-style: italic;
		color: var(--ink-2);
		max-width: 68ch;
	}
</style>

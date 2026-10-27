<script lang="ts">
	import { ownKind } from '$lib/text/document-kind';
	import { textOf } from '$lib/text/words';
	import { langeDatum } from '$lib/text/datum';
	import { report } from '$lib/api/errors';
	import { bewaarItem } from '$lib/map/map';
	import ReaderHead from './ReaderHead.svelte';
	// Reader for the kinds without a text of their own (toezegging, zaak, ...): what the
	// bron is, when, and where the source keeps it. Its verbindingen are in the panel.
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { menselijkeNaam } from '$lib/bron/menselijk';
	import { getInstrumentDetail } from '$lib/api/instrument-cache';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	// A version of a law is named by its law, asked by its BWB id (the cached head of the law).
	const bwb = $derived(textOf(p.bwb_id));
	let wet = $state<{ bwb: string; naam: string | null } | null>(null);
	$effect(() => {
		const b = bwb;
		if (!b || p.citation_title || p.instrument_citation_title) return;
		let stale = false;
		getInstrumentDetail(b)
			.then((d) => {
				if (!stale) wet = { bwb: b, naam: d.citation_title ?? d.display_name ?? d.title ?? null };
			})
			.catch((e) => report('Naam van de wet', e));
		return () => (stale = true);
	});
	// Never the key ($lib/bron/menselijk): "Algemene wet bestuursrecht, versie van 1 mei 2022".
	const title = $derived(
		menselijkeNaam(
			{
				collection: node.collection,
				key: node.key,
				display_name: textOf(p.title) ?? node.raw?.display_name,
				props: p
			},
			(b) => (wet?.bwb === b ? wet.naam : null)
		)
	);
	// A group of kinds says nothing of this one beyond its title (#31, #58).
	const soort = $derived(ownKind(p.kind));
	const facts = $derived(
		[
			soort,
			textOf(p.number) ?? textOf(p.activity_number),
			langeDatum(textOf(p.date) ?? textOf(p.made_on)),
			textOf(p.minister_role),
			textOf(p.status)
		].filter(Boolean)
	);
	const source = $derived(textOf(p.tk_url));
</script>

<ReaderFrame>
	<article class="r-simple">
		<ReaderHead
			collection={node.collection}
			{title}
			acties={{
				bewaar: bewaarItem(node.id, { kort: title, voluit: title })
			}}
		>
			{#snippet statusLine()}
				{#if facts.length > 0}<span>{facts.join(', ')}</span>{/if}
			{/snippet}
		</ReaderHead>
		{#if textOf(p.text)}
			<p class="text">{textOf(p.text)}</p>
		{/if}
		{#if source}
			<a class="source" href={source} target="_blank" rel="external noopener noreferrer"
				>tweedekamer.nl</a
			>
		{/if}
	</article>
</ReaderFrame>

<style>
	.r-simple {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-2);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.text {
		margin: var(--s-3) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		max-width: var(--regel);
		white-space: pre-line;
	}
	.source {
		align-self: flex-start;
		margin-top: var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.source:hover {
		color: var(--ink);
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
</style>

<script lang="ts">
	import SoortLink from '$lib/bron/SoortLink.svelte';
	// Reader for the kinds without a text of their own (toezegging, zaak, ...): what the
	// bron is, when, and where the source keeps it. Its verbindingen are in the panel.
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import { formatLongDate, textProp } from './_shared';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const title = $derived(textProp(p.title) ?? node.raw?.display_name ?? node.label);
	const facts = $derived(
		[
			textProp(p.kind),
			textProp(p.number) ?? textProp(p.activity_number),
			formatLongDate(textProp(p.date) ?? textProp(p.made_on)),
			textProp(p.minister_role),
			textProp(p.status)
		].filter(Boolean)
	);
	const source = $derived(textProp(p.tk_url));
</script>

<ReaderFrame>
	<article class="r-simple">
		<span class="lezer-soort"
			><SoortLink collection={node.collection}>{bronLabel(node.collection)}</SoortLink></span
		>
		<h2 class="lezer-titel">{title}</h2>
		{#if facts.length > 0}
			<p class="facts">{facts.join(', ')}</p>
		{/if}
		{#if textProp(p.text)}
			<p class="text">{textProp(p.text)}</p>
		{/if}
		{#if source}
			<a class="source" href={source} target="_blank" rel="noopener noreferrer">tweedekamer.nl ↗</a>
		{/if}
	</article>
</ReaderFrame>

<style>
	.r-simple {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		color: var(--ink-2);
	}
	.facts {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.text {
		margin: var(--s-3) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		max-width: var(--measure);
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
		color: var(--accent);
	}
</style>

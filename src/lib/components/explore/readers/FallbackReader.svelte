<script lang="ts">
	// Reader for the kinds without a text of their own (toezegging, zaak, ...): what the
	// bron is, when, and where the source keeps it. Its verbindingen are in the panel.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
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

<article class="r-simple">
	<span class="kicker"><KindGlyph collection={node.collection} /> {bronLabel(node.collection)}</span
	>
	<h2 class="title">{title}</h2>
	{#if facts.length > 0}
		<p class="facts">{facts.join(' · ')}</p>
	{/if}
	{#if textProp(p.text)}
		<p class="text">{textProp(p.text)}</p>
	{/if}
	{#if source}
		<a class="source" href={source} target="_blank" rel="noopener noreferrer">tweedekamer.nl ↗</a>
	{/if}
</article>

<style>
	.r-simple {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-5) var(--s-5) var(--s-6);
		height: 100%;
		overflow-y: auto;
		color: var(--ink-2);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 22px;
		font-weight: 500;
		line-height: 1.25;
		color: var(--ink);
	}
	.facts {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
	}
	.text {
		margin: var(--s-3) 0 0;
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.6;
		max-width: 60ch;
		white-space: pre-line;
	}
	.source {
		align-self: flex-start;
		margin-top: var(--s-3);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
	}
</style>

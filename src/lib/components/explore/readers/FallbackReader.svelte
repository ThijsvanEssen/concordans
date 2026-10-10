<script lang="ts">
	import ReaderHead from './ReaderHead.svelte';
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
		<ReaderHead
			collection={node.collection}
			{title}
			acties={{
				bewaar: {
					id: node.id,
					at: '',
					kort: title,
					voluit: title,
					groep: bronLabel(node.collection)
				}
			}}
		>
			{#snippet status()}
				{#if facts.length > 0}<span>{facts.join(', ')}</span>{/if}
			{/snippet}
		</ReaderHead>
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

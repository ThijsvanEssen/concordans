<script lang="ts">
	// A bron on its own opened from the drawing of Netwerk tonen (besluit 39, mockup A197-a): in
	// place under the drawing, what it is, its line of the verbinding, and Lees, the bron one step
	// further; Zet in het netwerk adds it to the netwerk without leaving the page.
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { openHref } from '$lib/bron/href';
	import { bronKind } from '$lib/components/graph/bron-kind';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { capitalize } from '$lib/text/words';
	import { hoeVan } from './hoe';
	import { ankerVanRij, metaParts, type Row } from './rows';

	let {
		row,
		selection,
		onAddToNetwerk,
		inNetwerk
	}: {
		row: Row;
		selection: GraphNode;
		onAddToNetwerk?: (row: Row) => void;
		inNetwerk?: (row: Row) => boolean;
	} = $props();

	const hoe = $derived(hoeVan(row, selection.collection));
	const zin = $derived(
		hoe ? capitalize([hoe.werkwoord, hoe.rest].filter(Boolean).join(' ')) : null
	);
	const meta = $derived(
		metaParts(row, !!hoe)
			.map((p) => p.text)
			.join(', ')
	);
	const erin = $derived(inNetwerk?.(row) ?? false);
</script>

<div class="schets-kaart" role="region" aria-label={row.title}>
	<p class="soortregel">
		<KindGlyph collection={row.ref.collection} size={11} />{bronKind(
			row.ref.collection,
			row.props ?? undefined
		)}
	</p>
	<p class="titel">{row.title}</p>
	{#if meta}<p class="meta">{meta}</p>{/if}
	{#if zin}<p class="hoe">{zin}</p>{/if}
	<div class="acties">
		<a class="btn" href={openHref(row.ref, { at: ankerVanRij(row) })} data-sveltekit-noscroll
			>Lees</a
		>
		{#if onAddToNetwerk && !row.missing}
			{#if erin}<span class="stil">In het netwerk</span>{:else}<TekstLink
					onclick={() => onAddToNetwerk(row)}>Zet in het netwerk</TekstLink
				>{/if}
		{/if}
	</div>
</div>

<style>
	/* As the mockup A197-a: a framed card under the drawing. */
	.schets-kaart {
		margin: var(--s-3) 0 0;
		padding: var(--s-3) var(--s-4);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-2);
		background: var(--paper);
	}
	.soortregel {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		margin: 0 0 var(--s-1);
		font-size: var(--t-micro);
		font-style: italic;
		color: var(--ink-3);
	}
	.titel {
		margin: 0;
		font-size: var(--t-body-2);
		line-height: 24px;
		font-weight: 600;
	}
	.meta {
		margin: 0 0 var(--s-2);
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.hoe {
		margin: 0 0 var(--s-3);
		font-size: var(--t-meta);
		line-height: 20px;
		color: var(--ink-2);
	}
	.acties {
		display: flex;
		align-items: center;
		gap: var(--s-4);
	}
</style>

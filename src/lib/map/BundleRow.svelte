<script lang="ts">
	// One bundel in the overview (bundels-ux 2a): a row of Bladeren (IndexRow) that opens in
	// place on what the bundel holds, per group by its citations, with Open bundel; its name a
	// link to its page, so cmd-click opens it there. The bookmark of Bewaar marks the bundel
	// Bewaar keeps in; at the right its number of bronnen as a plain mark and the day it
	// changed. A bundel from a file is a row too, marked, its choices beside it (`choices`).
	import type { Snippet } from 'svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import Picto from '$lib/components/ui/Picto.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import { formatCount } from '$lib/text/getal';
	import { dagMaand, vandaag } from '$lib/text/datum';
	import { groepen, judgmentRows, rowTitle, JUDGMENTS_GROUP, type Map, type MapItem } from './map';
	import { bundlePageHref } from './page';

	let {
		bundle,
		open,
		onToggle,
		target = false,
		mark = null,
		choices
	}: {
		bundle: Pick<Map, 'naam' | 'items' | 'notitie'> & Partial<Pick<Map, 'id' | 'gewijzigd'>>;
		open: boolean;
		onToggle: () => void;
		/** Bewaar keeps in this bundel. */
		target?: boolean;
		/** What the row is besides a bundel of this browser: `uit bestand`. */
		mark?: string | null;
		/** The row's own choices at its right (a bundel from a file). */
		choices?: Snippet;
	} = $props();

	const href = $derived(bundle.id && !mark ? bundlePageHref({ id: bundle.id }) : undefined);
	/** A group's citations on one line; a judgment once, its r.o.'s after it. */
	const citations = (key: string, items: MapItem[]) =>
		(key === JUDGMENTS_GROUP
			? judgmentRows(items).map(
					(r) =>
						rowTitle(r.head).title +
						(r.places.length ? ` (${r.places.map((p) => rowTitle(p, true).title).join(', ')})` : '')
				)
			: items.map((i) => rowTitle(i).title)
		).join(', ');
	const question = $derived(bundle.notitie?.split('\n')[0]?.trim() || null);
</script>

<IndexRow title={bundle.naam} {href} {open} {onToggle}>
	{#snippet lead()}
		{#if target}<span class="doel" title="Bewaren gaat hierheen"
				><Picto naam="bewaard" /><span class="sr-only">Bewaren gaat hierheen</span></span
			>{/if}
	{/snippet}
	{#snippet body()}
		{#if mark}<span class="merk">{mark}</span>{/if}
		{#if question}<span class="vraag">{question}</span>{/if}
	{/snippet}
	{#snippet aside()}
		<span class="aantal">{formatCount(bundle.items.length)}</span>
		{#if bundle.gewijzigd}<span class="dag">{dagMaand(vandaag(new Date(bundle.gewijzigd)))}</span
			>{/if}
		{@render choices?.()}
	{/snippet}
	{#snippet detail()}
		<div class="inhoud">
			{#if bundle.items.length}
				<dl>
					{#each groepen(bundle.items) as g (g.sleutel)}
						<dt>{g.groep}</dt>
						<dd>{citations(g.sleutel, g.items)}</dd>
					{/each}
				</dl>
			{:else}
				<p class="stil">Nog niets bewaard.</p>
			{/if}
			{#if href}<p class="verder"><TekstLink {href}>Open bundel</TekstLink></p>{/if}
		</div>
	{/snippet}
</IndexRow>

<style>
	.doel {
		display: inline-flex;
		color: var(--ink);
	}
	.merk {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The first line of the research question, in grey under the name. */
	.vraag {
		display: block;
		margin-top: var(--s-1);
		overflow: hidden;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.aantal,
	.dag {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
		white-space: nowrap;
	}
	.inhoud {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
		padding: var(--s-2) 0 var(--s-4);
	}
	dl {
		display: grid;
		grid-template-columns: minmax(0, 14rem) minmax(0, 1fr);
		gap: var(--s-1) var(--s-4);
		margin: 0;
		font-size: var(--t-meta);
	}
	dt {
		color: var(--ink-2);
	}
	dd {
		margin: 0;
		color: var(--ink);
	}
	.verder {
		margin: 0;
		font-size: var(--t-meta);
		text-align: right;
	}
	/* On a phone the day goes; the group's name stands over its citations. */
	@media (max-width: 768px) {
		.dag {
			display: none;
		}
		dl {
			grid-template-columns: minmax(0, 1fr);
		}
		dd {
			margin-bottom: var(--s-1);
		}
		.verder {
			text-align: left;
		}
	}
</style>

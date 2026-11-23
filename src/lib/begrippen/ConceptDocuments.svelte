<script lang="ts">
	// The papers joined to any article of a concept, each once: a year to narrow them, 25 more
	// at a time by "Volgende". The papers have no counts per year.
	import { page } from '$app/state';
	import { getConceptDocuments } from '$lib/api/concepts';
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import { naamVan } from '$lib/bron/menselijk';
	import AllN from '$lib/components/ui/AlleN.svelte';
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import FilterBar from '$lib/components/explore/index/FilterBar.svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import type { FacetGroup } from '$lib/components/explore/index/facets';
	import { aboutArticles, oneSpace } from '$lib/components/explore/readers/concept-rows';
	import { filterAddress } from '$lib/util/address';
	import { load } from '$lib/util/load.svelte';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';

	let { concept }: { concept: Schema<'ConceptResponse'> } = $props();

	const PAGE = 25;
	const YEAR = 'stukjaar';
	const year = $derived.by(() => {
		const y = page.url.searchParams.get(YEAR) ?? '';
		return /^\d{4}$/.test(y) ? y : '';
	});
	const address = filterAddress(() => page.url, { clear: [], filters: [YEAR] });

	const first = load(
		() => year,
		() => getConceptDocuments(concept.key, { limit: PAGE, offset: 0, ...(year ? { year } : {}) }),
		'Stukken bij het begrip'
	);
	let more = $state<{ year: string; items: Schema<'ConceptDocumentDTO'>[]; failed: boolean }>({
		year: '',
		items: [],
		failed: false
	});
	let busy = $state(false);
	const extra = $derived(more.year === year ? more.items : []);
	async function next(loaded: number) {
		const now = year;
		busy = true;
		try {
			const r = await getConceptDocuments(concept.key, {
				limit: PAGE,
				offset: loaded,
				...(now ? { year: now } : {})
			});
			if (now === year) more = { year: now, items: [...extra, ...r.items], failed: false };
		} catch {
			if (now === year) more = { year: now, items: extra, failed: true };
		} finally {
			busy = false;
		}
	}

	// From the year of the oldest paper the concept has to this one: the API counts none per year.
	const thisYear = new Date().getFullYear();
	const years = Array.from({ length: thisYear - 1994 }, (_, n) => String(thisYear - n));
	const groups = $derived<FacetGroup[]>([
		{
			id: 'jaar',
			label: 'Jaar',
			kind: 'select',
			value: year,
			all: 'Alle jaren',
			options: years.map((y) => ({ value: y, label: y })),
			onChange: (v) => address.patch({ [YEAR]: v || null })
		}
	]);

	const total = $derived(first.state.status === 'ready' ? first.state.data.total : null);
	let listEl = $state<HTMLElement | null>(null);
	let listItems = $state<Element | null>(null);
</script>

{#snippet countLine()}
	<p class="total">
		{#if total != null}{formatCount(total)}<span class="noun"
				>&nbsp;{plural(total, 'stuk', 'stukken')}</span
			>{/if}
	</p>
{/snippet}

<Section id="stukken" title="Stukken" inklapbaar={false}>
	<div bind:this={listEl}>
		<FilterBar
			{groups}
			show={total != null ? `Toon ${formatCount(total)} stukken` : 'Toon de stukken'}
			list={() => listEl}
			onClear={address.clearFilters}
			count={countLine}
		/>
		<LoadState state={first.state} what="De stukken" plural retry={first.retry}>
			{#snippet children(data)}
				{@const items = [...data.items, ...extra]}
				{#if items.length === 0}
					<p class="stil leeg" role="status">Geen stukken in dit jaar</p>
				{:else}
					<ul class="list" bind:this={listItems}>
						{#each items as { document: d, article_ids } (d.key)}
							{@const bron = `documents/${d.key}`}
							{@const about = aboutArticles(concept, article_ids)}
							<IndexRow
								{bron}
								dossier={d.dossier_number}
								title={oneSpace(d.title ?? d.kind ?? naamVan('documents', d)) ?? ''}
								href={openHref(bron)}
								acties
							>
								{#snippet lead()}
									<span class="row-id-main"><Waarde value={d.dossier_number} /></span>
								{/snippet}
								{#snippet body()}
									{@const line = [d.kind, about].filter(Boolean).join(', ')}
									{#if line}<span class="row-sub">{line}</span>{/if}
								{/snippet}
								{#snippet aside()}
									{#if d.date}<span class="row-sub"><DateTime iso={d.date} /></span>{/if}
								{/snippet}
							</IndexRow>
						{/each}
					</ul>
					{#if items.length < data.total}
						<p class="alle">
							<AllN
								volgende
								noun="stukken"
								stap={PAGE}
								rest={data.total - items.length}
								laden={busy}
								opnieuw={more.failed}
								loaded={items.length}
								list={listItems}
								onclick={() => next(items.length)}
							/>
						</p>
					{/if}
				{/if}
			{/snippet}
		</LoadState>
	</div>
</Section>

<style>
	.list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.total {
		margin: 0 var(--s-2) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 600;
		line-height: 1.1;
	}
	.noun {
		font-size: var(--t-meta);
		font-weight: 400;
		color: var(--ink-3);
	}
	.alle,
	.leeg {
		margin: var(--s-2) var(--s-3) 0;
		font-size: var(--t-meta);
	}
</style>

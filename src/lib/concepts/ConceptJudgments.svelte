<script lang="ts">
	// The judgments that cite any article of a concept, each once, as the page of the begrip
	// lists them: the filters of the bar (jaar, instantie, rechtsgebied) are asked of the API,
	// whose total and facets are those of the whole list, and a page of 25 more by "Volgende".
	import { untrack } from 'svelte';
	import { page } from '$app/state';
	import { getConceptJudgments } from '$lib/api/concepts';
	import type { Schema } from '$lib/api/types';
	import { openHref } from '$lib/bron/href';
	import AllN from '$lib/components/ui/AlleN.svelte';
	import DateTime from '$lib/components/ui/DateTime.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
	import TekstMenu from '$lib/components/ui/TekstMenu.svelte';
	import Waarde from '$lib/components/ui/Waarde.svelte';
	import FilterBar from '$lib/components/explore/index/FilterBar.svelte';
	import IndexRow from '$lib/components/explore/index/IndexRow.svelte';
	import { facetMap, selectOptions, type FacetGroup } from '$lib/components/explore/index/facets';
	import { judgmentCourt, judgmentRowTitle } from '$lib/components/explore/index/judgment-row';
	import { aboutArticles, oneSpace } from '$lib/components/explore/readers/concept-rows';
	import { filterAddress } from '$lib/util/address';
	import { load } from '$lib/util/load.svelte';
	import { formatCount } from '$lib/text/getal';
	import { plural } from '$lib/text/words';
	import { TIER_LABEL, type Tier } from '$lib/vocabulary';

	let { concept }: { concept: Schema<'ConceptResponse'> } = $props();

	/** Rows a page brings. */
	const PAGE = 25;
	const P = { year: 'jaar', tier: 'instantie', area: 'rechtsgebied', sort: 'volgorde' } as const;
	const params = $derived(page.url.searchParams);
	const year = $derived(params.get(P.year) ?? '');
	const tier = $derived(params.get(P.tier) ?? '');
	const area = $derived(params.get(P.area) ?? '');
	const sort = $derived<'date_desc' | 'citation_count'>(
		params.get(P.sort) === 'aangehaald' ? 'citation_count' : 'date_desc'
	);

	const address = filterAddress(() => page.url, {
		clear: [],
		filters: [P.year, P.tier, P.area]
	});

	const query = $derived({
		sort,
		...(year && /^\d{4}$/.test(year) ? { year } : {}),
		...(tier ? { tier: [tier as Schema<'Tier'>] } : {}),
		...(area ? { subject_area: area } : {})
	});
	const asked = $derived(JSON.stringify(query));
	const first = load(
		() => asked,
		() => getConceptJudgments(concept.key, { ...query, limit: PAGE, offset: 0 }),
		'Uitspraken bij het begrip'
	);

	// The pages after the first, for the filters asked.
	let more = $state<{ asked: string; items: Schema<'ConceptJudgmentDTO'>[]; failed: boolean }>({
		asked: '',
		items: [],
		failed: false
	});
	let busy = $state(false);
	const extra = $derived(more.asked === asked ? more.items : []);
	async function next(loaded: number) {
		const now = asked;
		busy = true;
		try {
			const r = await getConceptJudgments(concept.key, { ...query, limit: PAGE, offset: loaded });
			if (now === asked) more = { asked: now, items: [...extra, ...r.items], failed: false };
		} catch {
			if (now === asked) more = { asked: now, items: extra, failed: true };
		} finally {
			busy = false;
		}
	}

	// The counts stay as the last answer gave them while the next is on its way.
	let facets = $state<Schema<'CitedByFacets'> | null>(null);
	let total = $state<number | null>(null);
	$effect(() => {
		const s = first.state;
		if (s.status !== 'ready') return;
		untrack(() => {
			facets = s.data.facets;
			total = s.data.total;
		});
	});

	const groups = $derived.by((): FacetGroup[] => {
		const out: FacetGroup[] = [];
		if (!facets) return out;
		out.push(
			{
				id: 'jaar',
				label: 'Jaar',
				kind: 'select',
				value: year,
				all: 'Alle jaren',
				options: selectOptions(facetMap(facets.year), year, (y) => y).sort((a, b) =>
					b.value.localeCompare(a.value)
				),
				onChange: (v) => address.patch({ [P.year]: v || null })
			},
			{
				id: 'instantie',
				label: 'Instantie',
				kind: 'select',
				value: tier,
				all: 'Alle instanties',
				options: selectOptions(facetMap(facets.tier), tier, (t) => TIER_LABEL[t as Tier] ?? t),
				onChange: (v) => address.patch({ [P.tier]: v || null })
			},
			{
				id: 'rechtsgebied',
				label: 'Rechtsgebied',
				kind: 'select',
				value: area,
				all: 'Alle rechtsgebieden',
				options: selectOptions(facetMap(facets.subject_area), area, (a) => a),
				onChange: (v) => address.patch({ [P.area]: v || null })
			}
		);
		return out;
	});

	let listEl = $state<HTMLElement | null>(null);
	let listItems = $state<Element | null>(null);
</script>

{#snippet sortControl()}
	<TekstMenu
		rechts
		label="Volgorde"
		waarde={sort}
		opties={[
			{ waarde: 'date_desc', label: 'Datum (nieuw → oud)' },
			{ waarde: 'citation_count', label: 'Meest aangehaald' }
		]}
		onSelect={(v) => address.patch({ [P.sort]: v === 'citation_count' ? 'aangehaald' : null })}
	/>
{/snippet}

{#snippet countLine()}
	<p class="total">
		{#if total != null}{formatCount(total)}<span class="noun"
				>&nbsp;{plural(total, 'uitspraak', 'uitspraken')}</span
			>{/if}
	</p>
{/snippet}

<Section id="uitspraken" title="Uitspraken" inklapbaar={false}>
	<div bind:this={listEl}>
		<FilterBar
			{groups}
			pending={!facets}
			show={total != null ? `Toon ${formatCount(total)} uitspraken` : 'Toon de uitspraken'}
			list={() => listEl}
			onClear={address.clearFilters}
			end={sortControl}
			count={countLine}
		/>
		<LoadState state={first.state} what="De uitspraken" plural retry={first.retry}>
			{#snippet children(data)}
				{@const items = [...data.items, ...extra]}
				{#if items.length === 0}
					<p class="stil leeg" role="status">Geen uitspraken met deze filters</p>
				{:else}
					<ul class="list" bind:this={listItems}>
						{#each items as { judgment: j, article_ids } (j.key)}
							{@const bron = `judgments/${j.key}`}
							{@const about = aboutArticles(concept, article_ids)}
							<IndexRow
								{bron}
								title={oneSpace(judgmentRowTitle(j)) ?? ''}
								href={openHref(bron)}
								acties
							>
								{#snippet lead()}
									<span class="row-id-main"><DateTime iso={j.date} /></span>
									<span class="row-id-sub"
										><Waarde value={judgmentCourt(j.display_name, j.court)} /></span
									>
								{/snippet}
								{#snippet body()}
									{#if about}<span class="row-sub">{about}</span>{/if}
								{/snippet}
								{#snippet aside()}
									{#if j.inbound_citation_count}
										<span class="num-strong"
											>{formatCount(j.inbound_citation_count)}<span class="num-lbl"
												>&nbsp;{plural(j.inbound_citation_count, 'citatie', 'citaties')}</span
											></span
										>
									{/if}
								{/snippet}
							</IndexRow>
						{/each}
					</ul>
					{#if items.length < data.total}
						<p class="alle">
							<AllN
								volgende
								noun="uitspraken"
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

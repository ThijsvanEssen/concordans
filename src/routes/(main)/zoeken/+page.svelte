<script lang="ts">
	// Zoeken: the results of a query on a page of their own (besluit 31). The list under the
	// field on the start page is for what a query names exactly; words end here, with the hits
	// in groups per soort, the soort and, for uitspraken, the instantie and the jaar as facets,
	// and a page at a time once one soort is chosen. Everything chosen is in the address, so a
	// search can be shared. Asked in full (`mode=full`): up to RESULT_LIMIT hits per soort.
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import ChooseLine from '$lib/components/ui/Bepaalregel.svelte';
	import Coverage from '$lib/components/ui/Coverage.svelte';
	import AllN from '$lib/components/ui/AlleN.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import TextLink from '$lib/components/ui/TekstLink.svelte';
	import Verfijnen from '$lib/components/ui/Verfijnen.svelte';
	import IndexFacets, {
		selectOptions,
		activeFilters,
		type FacetGroup
	} from '$lib/components/explore/index/IndexFacets.svelte';
	import RouteHead from '$lib/seo/RouteKop.svelte';
	import { SEARCH_KINDS, type SearchKind } from '$lib/search/lanes';
	import { bySection, groupLabel, sectionOf } from '$lib/search/present';
	import {
		courtLabel,
		judgmentFacets,
		narrowerWords,
		OVERVIEW_ROWS,
		onlyJudgments,
		pageOf,
		resultsHref,
		RESULT_LIMIT
	} from '$lib/search/results';
	import { SearchResults } from '$lib/search/results.svelte';
	import ResultRow from '$lib/search/ResultRow.svelte';
	import { navigate, withParams, type ParamPatch } from '$lib/util/address';
	import { formatCount } from '$lib/text/getal';
	import { uniqueBy } from '$lib/util/unique';
	import { lijstDoel as listTarget } from '$lib/stores/sprong';

	// The names of the parameters in the address, which stay Dutch.
	const P = {
		q: 'q',
		from: 'van',
		to: 'tot',
		kind: 'soort',
		court: 'instantie',
		year: 'jaar',
		page: 'pagina'
	} as const;
	const params = $derived(page.url.searchParams);
	const q = $derived((params.get(P.q) ?? '').trim());
	const from = $derived(params.get(P.from) ?? '');
	const to = $derived(params.get(P.to) ?? '');
	const chosen = $derived(
		SEARCH_KINDS.find((k) => k === params.get(P.kind)) as SearchKind | undefined
	);
	const court = $derived(chosen === 'judgments' ? (params.get(P.court) ?? '') : '');
	const year = $derived(chosen === 'judgments' ? (params.get(P.year) ?? '') : '');
	const pageNumber = $derived(Number(params.get(P.page)) || 1);

	const results = new SearchResults();
	$effect(() => {
		const request = { q, from, to };
		untrack(() => results.ask(request));
	});
	$effect(() => () => results.stop());

	/** A step in the history; typing replaces it. */
	const patchUrl = (patch: ParamPatch, replace = false) =>
		navigate(withParams(page.url, patch, { clear: [P.page] }), { step: !replace });
	const hrefWith = (patch: ParamPatch) => withParams(page.url, patch, { clear: [P.page] });

	// What is typed goes into the address when the typing pauses; the field keeps what was typed.
	let draft = $state<string | null>(null);
	let timer: ReturnType<typeof setTimeout> | undefined;
	function type(v: string) {
		draft = v;
		clearTimeout(timer);
		timer = setTimeout(
			() => patchUrl({ [P.q]: v.trim() || null, [P.kind]: null }, true),
			v ? 300 : 0
		);
	}
	$effect(() => {
		void q;
		untrack(() => {
			if (draft !== null && draft.trim() === q) draft = null;
		});
	});

	/** The kinds with hits, in the order of the groups; the judgments narrowed by instantie and jaar. */
	const hitsOf = (kind: SearchKind) =>
		kind === 'judgments' ? onlyJudgments(results.hitsOf(kind), court, year) : results.hitsOf(kind);
	const groups = $derived(
		SEARCH_KINDS.filter((k) => !chosen || k === chosen)
			.map((kind) => ({ kind, hits: uniqueBy(bySection(hitsOf(kind)), (h) => h.id) }))
			.filter((g) => g.hits.length > 0)
	);
	const all = $derived(SEARCH_KINDS.map((kind) => ({ kind, hits: results.hitsOf(kind) })));
	const total = $derived(groups.reduce((n, g) => n + g.hits.length, 0));
	const judgments = $derived(judgmentFacets(results.hitsOf('judgments')));
	/** The judgments are still on their way: their group holds its place. */
	const waitingJudgments = $derived(
		results.lanes.judgments.status === 'loading' && (!chosen || chosen === 'judgments')
	);

	const groupsOfFacets = $derived.by((): FacetGroup[] => {
		const out: FacetGroup[] = [
			{
				id: 'soort',
				label: 'Soort',
				kind: 'list',
				options: all
					.filter((g) => g.hits.length > 0 || g.kind === chosen)
					.map((g) => ({
						id: g.kind,
						label: groupLabel(g.kind),
						on: chosen === g.kind,
						count: g.hits.length,
						onClick: () =>
							patchUrl({
								[P.kind]: chosen === g.kind ? null : g.kind,
								[P.court]: null,
								[P.year]: null
							})
					}))
			}
		];
		if (chosen === 'judgments') {
			out.push(
				{
					id: 'instantie',
					label: 'Instantie',
					kind: 'select',
					value: court,
					all: 'Alle instanties',
					options: selectOptions(judgments.courts, court, courtLabel),
					onChange: (v) => patchUrl({ [P.court]: v || null })
				},
				{
					id: 'jaar',
					label: 'Jaar',
					kind: 'select',
					value: year,
					all: 'Alle jaren',
					options: selectOptions(judgments.years, year, (y) => y),
					onChange: (v) => patchUrl({ [P.year]: v || null })
				}
			);
		}
		return out;
	});
	const chips = $derived(activeFilters(groupsOfFacets));
	const clearFilters = () =>
		patchUrl({ [P.kind]: null, [P.court]: null, [P.year]: null, [P.from]: null, [P.to]: null });

	let filtersOpen = $state(false);
	let listEl = $state<HTMLElement | null>(null);

	const empty = $derived(
		q.length >= 2 && results.done && results.failed.length === 0 && all.every((g) => !g.hits.length)
	);
	/** Chosen and filtered down to nothing: the hits there are, but not these. */
	const filteredAway = $derived(
		q.length >= 2 && results.done && !empty && total === 0 && results.failed.length === 0
	);
	const leftOut = $derived([...new Set(SEARCH_KINDS.flatMap((k) => results.laneOf(k).leftOut))]);
	const failedNames = $derived(
		results.failed.map((l) => ({ id: l.id, name: l.kinds.map((k) => groupLabel(k)).join(' en ') }))
	);
</script>

<RouteHead />

<div class="zoeken blad blad__indeling">
	<header class="blad__kop">
		<div>
			<h1 class="blad__titel">Zoeken</h1>
		</div>
	</header>

	<div class="regel">
		<ChooseLine
			zoek={{
				waarde: draft ?? q,
				placeholder: 'Zoek een wet, uitspraak of dossier',
				naam: 'Zoek in Concordans',
				onInput: type
			}}
			periode={{
				van: from,
				tot: to,
				onChange: (van, tot) => patchUrl({ [P.from]: van || null, [P.to]: tot || null })
			}}
		/>
	</div>

	<aside class="blad__facetten" aria-label="Verfijnen">
		<Verfijnen
			id="zoeken-facetten"
			active={chips.length}
			label={results.done ? `Toon ${formatCount(total)} resultaten` : 'Toon de resultaten'}
			list={() => listEl}
			bind:open={filtersOpen}
		>
			<IndexFacets
				groups={groupsOfFacets}
				pending={!results.done && all.every((g) => !g.hits.length)}
			/>
			{#if chips.length}
				<p class="wis"><TextLink onclick={clearFilters}>Wis alle filters</TextLink></p>
			{/if}
		</Verfijnen>
	</aside>

	<div class="lijst" aria-busy={!results.done} use:listTarget bind:this={listEl}>
		{#if q.length < 2}
			<p class="stil">Typ een zoekterm.</p>
		{/if}

		{#if leftOut.length > 0}
			<p class="stil weggelaten">Weggelaten: {leftOut.join(', ')}</p>
		{/if}

		{#each groups as group (group.kind)}
			{@const paged = chosen ? pageOf(group.hits, pageNumber) : null}
			{@const rows = paged ? paged.rows : group.hits.slice(0, OVERVIEW_ROWS)}
			{@const lane = results.laneOf(group.kind)}
			<!-- The API gave its limit: there may be more than it gave, which the count says. -->
			{@const capped = group.hits.length >= RESULT_LIMIT}
			<section class="groep" aria-labelledby="groep-{group.kind}">
				<h2 class="groep__kop" id="groep-{group.kind}">
					<KindGlyph collection={group.kind} />
					{groupLabel(group.kind)}
					<span class="aantal">{formatCount(group.hits.length)}{capped ? '+' : ''}</span>
					{#if lane.matched === 'any'}
						<span class="deel">treffers met een deel van de woorden</span>
					{/if}
				</h2>
				{#if lane.searched[group.kind]}
					<p class="gezocht"><Coverage searched={lane.searched[group.kind]} /></p>
				{/if}
				<div class="rijen">
					{#each rows as hit, n (hit.id)}
						{@const section = sectionOf(hit)}
						{#if section && (n === 0 || section !== sectionOf(rows[n - 1]))}
							<div class="sectie">{section}</div>
						{/if}
						<ResultRow {hit} {q} neighbours={group.hits} />
					{/each}
				</div>
				{#if paged && paged.pages > 1}
					<nav class="bladeren" aria-label="Pagina's">
						{#if paged.page > 1}
							<TextLink
								href={withParams(page.url, {
									[P.page]: paged.page > 2 ? String(paged.page - 1) : null
								})}>Vorige</TextLink
							>
						{/if}
						<span class="stil">Pagina {paged.page} van {paged.pages}</span>
						{#if paged.page < paged.pages}
							<TextLink href={withParams(page.url, { [P.page]: String(paged.page + 1) })}
								>Volgende</TextLink
							>
						{/if}
					</nav>
				{:else if !chosen && group.hits.length > OVERVIEW_ROWS}
					<p class="alle">
						<AllN
							aantal={capped ? null : group.hits.length}
							noun={groupLabel(group.kind).toLowerCase()}
							href={hrefWith({ [P.kind]: group.kind })}
						/>
					</p>
				{/if}
			</section>
		{/each}

		{#if waitingJudgments && q.length >= 2}
			<section class="groep" aria-labelledby="groep-judgments-laden">
				<h2 class="groep__kop" id="groep-judgments-laden">
					<KindGlyph collection="judgments" />
					{groupLabel('judgments')}
					<span class="laden">laden…</span>
				</h2>
			</section>
		{/if}

		{#each failedNames as lane (lane.id)}
			<div class="staat">
				<LoadState
					state={{ status: 'error', error: results.lanes[lane.id].error }}
					what={lane.name}
					plural
					retry={() => results.retry(lane.id)}
				/>
			</div>
		{/each}

		{#if empty}
			<div class="staat stil" role="status">
				<span>Geen resultaten voor "{q}"</span>
				<span class="verder">
					{#each narrowerWords(q) as word (word)}
						<TextLink href={resultsHref(word, from, to)}>Zoek "{word}"</TextLink>
					{/each}
					{#if from || to}
						<TextLink href={withParams(page.url, { [P.from]: null, [P.to]: null })}
							>Zonder periode</TextLink
						>
					{/if}
				</span>
			</div>
		{:else if filteredAway}
			<div class="staat stil" role="status">
				<span>Geen resultaten met deze filters</span>
				<span class="verder"><TextLink onclick={clearFilters}>Wis alle filters</TextLink></span>
			</div>
		{/if}
	</div>
</div>

<style>
	.regel {
		grid-column: 1 / -1;
		margin-bottom: var(--s-5);
	}
	.wis {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
	.groep {
		margin: 0 0 var(--s-6);
	}
	.groep__kop {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		margin: 0 0 var(--s-2);
		padding-bottom: var(--s-2);
		border-bottom: 1px solid var(--ink);
		font: var(--niveau-1-sectie);
	}
	.aantal,
	.laden,
	.deel {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 400;
		color: var(--ink-3);
	}
	.deel {
		font-style: italic;
	}
	.gezocht {
		margin: 0 0 var(--s-1) var(--s-3);
		line-height: var(--lh-snug);
	}
	.sectie {
		padding: var(--s-1) var(--s-3) 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-2);
	}
	.alle,
	.bladeren {
		margin: var(--s-2) var(--s-3) 0;
		font-size: var(--t-meta);
	}
	.bladeren {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-4);
	}
	.weggelaten {
		margin-bottom: var(--s-4);
	}
	.staat {
		margin: var(--s-4) 0;
	}
	.verder {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-1) var(--s-4);
		margin-top: var(--s-1);
	}

	@media (max-width: 768px) {
		.regel {
			margin-bottom: var(--s-3);
		}
	}
</style>

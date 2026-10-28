<script lang="ts">
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import KeyList from '$lib/components/ui/KeyList.svelte';
	import KeyRow from '$lib/components/ui/KeyRow.svelte';
	import CoverageLine from '$lib/components/ui/Coverage.svelte';
	import { coverageLine } from '$lib/text/coverage';
	import { onDate, untilDate, throughDate } from '$lib/text/datum';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Bronnen en hergebruik: the one place for where the data comes from, how far it goes, and
	// what may be done with it. Elsewhere one sentence links here.
	import { getCoverage, getStats, type Coverage, type Stats } from '$lib/api/stats';
	import { load } from '$lib/util/load.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { formatCount } from '$lib/text/getal';
	import { TIERS, TIER_LABEL } from '$lib/vocabulary';
	import { COVERAGE, PUBLISHERS, SOURCE_LABEL } from '$lib/bron/herkomst';

	const stats = load(
		() => 'stats',
		(_, signal) => getStats(signal),
		'Bronnen'
	);
	const coverage = load(
		() => 'coverage',
		(_, signal) => getCoverage(signal),
		'Bronnen dekking'
	);

	/** How current each source is (`data_as_of`): the last date in its data, and when it was fetched. */
	const asOfIn = (stats: Stats) =>
		Object.entries(stats.data_as_of ?? {}).flatMap(([source, d]) =>
			d?.retrieved_at || d?.completeness
				? [
						{
							source: SOURCE_LABEL[source] ?? source,
							newest: d.newest ?? null,
							fetched: d.retrieved_at?.slice(0, 10) ?? null,
							completeness: d.completeness
						}
					]
				: []
		);

	/** The colleges the dataset holds judgments of, in the order of the filters. */
	const tiersIn = (coverage: Coverage) =>
		TIERS.flatMap((tier) =>
			(coverage.tiers ?? []).filter((c) => c.tier === tier).map((c) => ({ ...c, tier }))
		);
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/over">Over Concordans</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Bronnen en hergebruik</h1></header>
		<p class="stub-lede">Concordans gebruikt alleen officiële bronnen.</p>

		<Sectie title="Herkomst" niveau={2} inklapbaar={false} id="herkomst">
			<KeyList>
				{#each PUBLISHERS as p (p.name)}
					<KeyRow key={p.name}
						>{p.gives}.
						<span class="licentie"
							><a href={p.licence.url} class="cite" rel="external">{p.licence.name}</a></span
						></KeyRow
					>
				{/each}
			</KeyList>
		</Sectie>

		<Sectie title="Dekking en stand" niveau={2} inklapbaar={false} id="dekking">
			<p>
				Het netwerk bevat een selectie uit deze bronnen; wat erbuiten valt, staat bij de
				<a href="/docs/methode#grenzen" class="cite">grenzen</a>.
			</p>
			<!-- Each block stands on its own answer: the colleges appear when /stats/coverage is there. -->
			<LoadState state={stats.state} what="De dekking" retry={stats.retry}>
				{#snippet children(stats)}
					<KeyList>
						{#each COVERAGE as c (c.collection)}
							<KeyRow key={c.label}>{formatCount(stats.nodes[c.collection] ?? 0)}</KeyRow>
						{/each}
					</KeyList>
				{/snippet}
			</LoadState>
			<LoadState state={coverage.state} what="De dekking per college" retry={coverage.retry}>
				{#snippet children(coverage)}
					<KeyList>
						{#each tiersIn(coverage) as t (t.tier)}
							<KeyRow key={TIER_LABEL[t.tier]}
								>{formatCount(t.count)}{#if t.first_date && t.last_date}, {t.first_date.slice(0, 4)}
									{untilDate(t.last_date)}{/if}</KeyRow
							>
						{/each}
					</KeyList>
				{/snippet}
			</LoadState>
			{#if stats.state.status === 'ready'}
				{@const asOf = asOfIn(stats.state.data)}
				{#if asOf.length}
					<p class="list-note">Stand per bron</p>
					<KeyList>
						{#each asOf as a (a.source)}
							<!-- A source the runs no longer fetch from says so, with the day it reached. -->
							<KeyRow key={a.source}
								>{#if coverageLine(a.completeness)}<CoverageLine
										coverage={a.completeness}
									/>{:else}{a.newest ? `${throughDate(a.newest)}, ` : ''}opgehaald {onDate(
										a.fetched
									)}{/if}</KeyRow
							>
						{/each}
					</KeyList>
				{/if}
			{/if}
		</Sectie>

		<Sectie title="Hergebruik en aanhalen" niveau={2} inklapbaar={false} id="hergebruik">
			<p>
				De wetgeving, de publicaties in Staatsblad, Staatscourant en Tractatenblad, de open data van
				de Tweede Kamer en de gegevens van rijksoverheid.nl vallen onder CC0 1.0: vrij te
				hergebruiken, zonder voorwaarden. Voor de uitspraken van de Rechtspraak en het EHRM, de
				stukken van de Eerste Kamer, EUR-Lex, de Verdragenbank en de waardelijsten gelden de
				voorwaarden van de uitgever; de herkomst hierboven linkt ernaar.
			</p>
			<p>
				Wat Concordans toevoegt, zoals de verbindingen en de uitvoer van de API, valt onder
				<a href="https://creativecommons.org/licenses/by/4.0/deed.nl" class="cite">CC BY 4.0</a>:
				vrij te hergebruiken, met vermelding van Concordans als bron. Voor een brontekst in die
				uitvoer blijven de voorwaarden van zijn uitgever gelden.
			</p>
			<p>
				Haal een tekst aan naar de officiële bron: het ECLI, het artikel met de wet, het Kamerstuk
				of de vindplaats in het Staatsblad. Haal de verbindingen van Concordans aan met het adres en
				de datum van raadplegen:
			</p>
			<p class="voorbeeld">
				Concordans, verbindingen van art. 273f Sr,
				https://concordans.nl/wetten/BWBR0001854/artikel/273f (geraadpleegd 7 oktober 2026).
			</p>
		</Sectie>

		<div class="meta-row">
			<a href="/over" class="meta-link">Over Concordans</a>
			<a href="/voorwaarden" class="meta-link">Voorwaarden</a>
			<a href="/docs/methode" class="meta-link">Methode</a>
		</div>
	</div>
</div>

<style>
	p {
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0 0 var(--s-3);
	}

	p:last-child {
		margin-bottom: 0;
	}

	.voorbeeld {
		padding-left: var(--s-4);
		border-left: 2px solid var(--rule-strong);
		color: var(--ink-2);
		overflow-wrap: anywhere;
	}

	.licentie {
		display: block;
		margin-top: var(--s-1);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	// Bronnen en hergebruik: the one place for where the data comes from, how far it goes, and
	// what may be done with it. Elsewhere one sentence links here.
	import { onMount } from 'svelte';
	import { getCoverage, getStats, type Coverage, type Stats } from '$lib/api/stats';
	import { longDate } from '$lib/verbonden/rows';
	import { formatCount } from '$lib/verbonden/filter';
	import { TIERS, TIER_LABEL } from '$lib/vocabulary';

	type Herkomst = {
		bron: string;
		/** What it gives and from whom, as it starts the line (a site keeps its own case). */
		wat: string;
		/** The licence or terms as the publisher states them, with their page. */
		licentie: { naam: string; url: string } | null;
	};

	// The licence as the publisher states it on its own page (read 8 October 2026,
	// ~/Development/bronnen-licenties.md). Where that is not clear: the publisher's terms.
	const HERKOMST: Herkomst[] = [
		{
			bron: 'Wetgeving',
			wat: 'wetten.overheid.nl (Basiswettenbestand), op BWB-id',
			licentie: { naam: 'CC0 1.0', url: 'https://data.overheid.nl/dataset/basis-wetten-bestand' }
		},
		{
			bron: 'Rechtspraak',
			wat: 'rechtspraak.nl, op ECLI',
			licentie: { naam: 'Voorwaarden van de uitgever', url: 'https://www.rechtspraak.nl/colofon' }
		},
		{
			bron: 'EHRM',
			wat: 'HUDOC, op ECLI of zaaknummer',
			licentie: {
				naam: 'Voorwaarden van de uitgever',
				url: 'https://www.echr.coe.int/copyright-and-disclaimer'
			}
		},
		{
			bron: 'Tweede Kamer',
			wat: 'De open data van de Tweede Kamer; Kamerstukken op dossier- en ondernummer',
			licentie: { naam: 'CC0 1.0', url: 'https://opendata.tweedekamer.nl/disclaimer' }
		},
		{
			bron: 'Eerste Kamer',
			wat: 'eerstekamer.nl; Kamerstukken op dossiernummer en letter',
			licentie: {
				naam: 'Voorwaarden van de uitgever',
				url: 'https://www.eerstekamer.nl/begrip/colofon'
			}
		},
		{
			bron: 'Publicaties',
			wat: 'Staatsblad, Staatscourant en Tractatenblad, van officielebekendmakingen.nl',
			licentie: {
				naam: 'CC0 1.0',
				url: 'https://data.overheid.nl/dataset/officiele-bekendmakingen'
			}
		},
		{
			bron: 'Regering',
			wat: 'Kabinetten, hun periodes en bewindspersonen van rijksoverheid.nl',
			licentie: { naam: 'CC0 1.0', url: 'https://www.rijksoverheid.nl/copyright' }
		},
		{
			bron: 'Europees recht',
			wat: 'EUR-Lex, op CELEX-nummer',
			licentie: {
				naam: 'Voorwaarden van de uitgever',
				url: 'https://eur-lex.europa.eu/content/legal-notice/legal-notice.html'
			}
		},
		{
			bron: 'Verdragen',
			wat: 'De Verdragenbank van de Rijksoverheid',
			licentie: { naam: 'Voorwaarden van de uitgever', url: 'https://verdragenbank.overheid.nl' }
		},
		{
			bron: 'Organisaties',
			wat: 'Ministeries en rechtsgebieden uit de waardelijsten van de overheid (TOOI)',
			licentie: { naam: 'Voorwaarden van de uitgever', url: 'https://standaarden.overheid.nl/tooi' }
		}
	];

	/** The collections the dekking lists. */
	const COVERAGE: { collection: string; label: string }[] = [
		{ collection: 'instruments', label: 'Wetten en regelingen' },
		{ collection: 'articles', label: 'Artikelen' },
		{ collection: 'judgments', label: 'Uitspraken' },
		{ collection: 'dossiers', label: 'Dossiers' },
		{ collection: 'documents', label: 'Kamerstukken en andere documenten' },
		{ collection: 'members', label: 'Personen' },
		{ collection: 'committees', label: 'Commissies' },
		{ collection: 'cabinets', label: 'Kabinetten' },
		{ collection: 'commitments', label: 'Toezeggingen' }
	];

	/** The sources the API names in `data_as_of`, as a reader knows them. */
	const SOURCE_LABEL: Record<string, string> = {
		bwb: 'wetten.overheid.nl',
		rechtspraak: 'rechtspraak.nl',
		echr: 'HUDOC',
		eurlex: 'EUR-Lex',
		tk: 'Tweede Kamer',
		eerstekamer: 'Eerste Kamer',
		staatsblad: 'Staatsblad',
		staatscourant: 'Staatscourant',
		rijksoverheid: 'rijksoverheid.nl',
		tooi: 'TOOI',
		verdragenbank: 'Verdragenbank'
	};

	let stats = $state<Stats | null>(null);
	let coverage = $state<Coverage | null>(null);

	/** How current each source is (`data_as_of`): the last date in its data, and when it was fetched. */
	const asOf = $derived(
		Object.entries(stats?.data_as_of ?? {}).flatMap(([source, d]) =>
			d?.retrieved_at
				? [
						{
							source: SOURCE_LABEL[source] ?? source,
							newest: d.newest ?? null,
							fetched: d.retrieved_at.slice(0, 10)
						}
					]
				: []
		)
	);

	/** The colleges the dataset holds judgments of, in the order of the filters. */
	const tiers = $derived(
		TIERS.flatMap((tier) =>
			(coverage?.tiers ?? []).filter((c) => c.tier === tier).map((c) => ({ ...c, tier }))
		)
	);

	onMount(() => {
		getStats()
			.then((s) => (stats = s))
			.catch(() => (stats = null));
		getCoverage()
			.then((c) => (coverage = c))
			.catch(() => (coverage = null));
	});
</script>

<RouteKop pad="/bronnen" />

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Over Concordans</div>
		<h1 class="stub-title">Bronnen en hergebruik</h1>
		<p class="stub-lede">
			Concordans gebruikt alleen officiële bronnen. Deze pagina zegt welke, hoe ver de gegevens gaan
			en wat er met de teksten en met de verbindingen mag.
		</p>

		<div class="section" id="herkomst">
			<h2 class="section-title">Herkomst</h2>
			<div class="list">
				{#each HERKOMST as h (h.bron)}
					<div class="list-row">
						<span class="list-k">{h.bron}</span><span
							>{h.wat}.{#if h.licentie}
								<span class="licentie"
									><a href={h.licentie.url} class="cite" rel="external">{h.licentie.naam}</a></span
								>{/if}</span
						>
					</div>
				{/each}
			</div>
		</div>

		<div class="section" id="dekking">
			<h2 class="section-title">Dekking en stand</h2>
			<p>
				Het netwerk bevat een selectie uit deze bronnen; wat erbuiten valt, staat bij de
				<a href="/docs/methode#grenzen" class="cite">grenzen</a>.
			</p>
			{#if stats}
				<div class="list">
					{#each COVERAGE as c (c.collection)}
						<div class="list-row">
							<span class="list-k">{c.label}</span><span
								>{formatCount(stats.nodes[c.collection] ?? 0)}</span
							>
						</div>
					{/each}
				</div>
				{#if coverage}
					<div class="list">
						{#each tiers as t (t.tier)}
							<div class="list-row">
								<span class="list-k">{TIER_LABEL[t.tier]}</span><span
									>{formatCount(t.count)}{#if t.first_date && t.last_date}, {t.first_date.slice(
											0,
											4
										)} tot {longDate(t.last_date)}{/if}</span
								>
							</div>
						{/each}
					</div>
				{/if}
				{#if asOf.length}
					<p class="list-note">
						Stand per bron: de laatste datum in de gegevens, waar de bron die heeft, en de datum van
						ophalen.
					</p>
					<div class="list">
						{#each asOf as a (a.source)}
							<div class="list-row">
								<span class="list-k">{a.source}</span><span
									>{a.newest ? `tot en met ${longDate(a.newest)}, ` : ''}opgehaald {longDate(
										a.fetched
									)}</span
								>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<div class="section" id="hergebruik">
			<h2 class="section-title">Hergebruik en aanhalen</h2>
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
		</div>

		<div class="meta-row">
			<a href="/over" class="meta-link">Over Concordans</a>
			<a href="/voorwaarden" class="meta-link">Voorwaarden</a>
			<a href="/docs/methode" class="meta-link">Methode</a>
		</div>
	</div>
</div>

<style>
	.page-wrap {
		padding: var(--s-8) 0 calc(2 * var(--s-8));
	}

	.container {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 var(--s-5);
	}

	.stub-eyebrow {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: var(--s-4);
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		line-height: var(--lh-tight);
		color: var(--ink);
		margin: 0 0 var(--s-4);
	}

	.stub-lede {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin-bottom: var(--s-7);
	}

	.section {
		margin-bottom: var(--s-6);
	}

	.section-title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 var(--s-3);
	}

	p {
		font-family: var(--font-serif);
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

	.cite {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
	}

	.list {
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
		margin-bottom: var(--s-3);
	}

	.list-row {
		display: flex;
		gap: var(--s-4);
		padding: var(--s-2) var(--s-4);
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink);
		border-top: 1px solid var(--rule);
	}

	.list-row:first-child {
		border-top: 0;
	}

	.list-k {
		flex: none;
		width: 11em;
		color: var(--ink-3);
		font-variant-numeric: tabular-nums;
	}

	.meta-row {
		display: flex;
		gap: var(--s-5);
		flex-wrap: wrap;
		margin-top: var(--s-7);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}

	.meta-link {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
		text-decoration: none;
	}

	.meta-link:hover {
		color: var(--ink);
	}

	/* A phone: the name of the bron above its line, not in a narrow column beside it. */
	@media (max-width: 560px) {
		.list-row {
			flex-direction: column;
			gap: var(--s-1);
		}
		.list-k {
			width: auto;
		}
	}
</style>

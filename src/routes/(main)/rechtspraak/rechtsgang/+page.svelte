<script lang="ts">
	// Rechtsgang (B143): the route of a case per area of law, each court with the article that
	// gives it its say as a link; a court whose article is not read in the source shows the gap.
	// Under bestuursrecht the Bevoegdheidsregeling bestuursrechtspraak by chapter, its headings
	// as the regeling writes them, each article opened to the laws its list names. One answer
	// of the API (`/api/judgments/routes`); `?gebied=` chooses the area (from the Verloop).
	import { page } from '$app/state';
	import { getJudgmentRoutes } from '$lib/api/judgments';
	import { openHref } from '$lib/bron/href';
	import Keuze from '$lib/components/ui/Keuze.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { NOT_IN_DATA } from '$lib/text/coverage';
	import { load } from '$lib/util/load.svelte';
	import { SOURCES } from '$lib/nav/sources';
	import { count, separatorBefore } from '$lib/text/words';
	import {
		VIEWS,
		designatedCourt,
		annexArticleName,
		routeOf,
		type CourtStep
	} from '$lib/court-route/route';

	const routes = load(
		() => 'routes',
		() => getJudgmentRoutes(),
		'Rechtsgang'
	);
	const judgments = SOURCES.find((x) => x.id === 'rechtspraak')!;
	const asked = page.url.searchParams.get('gebied');
	let chosen = $state(VIEWS.find((v) => v.id === asked)?.id ?? VIEWS[0].id);
	const view = $derived(VIEWS.find((v) => v.id === chosen) ?? VIEWS[0]);
	const data = $derived(routes.state.status === 'ready' ? routes.state.data : null);
	const route = $derived(data ? routeOf(view, data) : null);
	const options = $derived(VIEWS.map((v) => ({ waarde: v.id, label: v.short })));
	const RO = { collection: 'instruments' as const, key: 'bwbr0001830' };
	const AWB = { collection: 'instruments' as const, key: 'bwbr0005537' };
	const lawRef = (bwbId: string) => ({
		collection: 'instruments' as const,
		key: bwbId.toLowerCase()
	});
</script>

<RouteKop />

{#snippet articles(court: CourtStep)}
	{#if court.gap}
		<span class="gat">wetsartikel {NOT_IN_DATA}</span>
	{:else}
		{#each court.articles as a, i (a.name + (a.area ?? ''))}{separatorBefore(
				i,
				court.articles.length
			)}<a href={openHref(a.ref)}>{a.name}</a>{#if a.area}{` (${a.area})`}{/if}{/each}
	{/if}
{/snippet}

<div class="page-wrap">
	<div class="container blad rechtsgang">
		<nav class="stub-eyebrow" aria-label="Hoort bij">
			<a href={judgments.href}>{judgments.label}</a>
		</nav>
		<header class="blad__kop"><h1 class="blad__titel">Rechtsgang</h1></header>
		<p class="stil lede">
			De route van een zaak langs de instanties, uit de <a href={openHref(RO)}
				>Wet op de rechterlijke organisatie</a
			>
			en de <a href={openHref(AWB)}>Algemene wet bestuursrecht</a>.
		</p>
		<Keuze opties={options} waarde={chosen} onSelect={(w) => (chosen = w)} label="Rechtsgebied" />

		{#if routes.state.status !== 'ready'}
			<LoadState state={routes.state} what="De rechtsgang" retry={routes.retry} />
		{:else if route && data}
			<section class="gebied" aria-labelledby="gebied-kop">
				<h2 id="gebied-kop">{view.label}</h2>
				<ol class="route">
					{#each route.stages as stage, i (stage.name)}
						<li class="stap">
							{#if i}<span class="pijl" aria-hidden="true">{stage.name.toLowerCase()}</span>{/if}
							<div class="vak">
								<span class="fase">{stage.name}</span>
								{#each stage.courts as court (court.tier)}
									<p class="instantie">
										<span class="naam">{court.name}</span>
										<span class="art">{@render articles(court)}</span>
									</p>
								{/each}
							</div>
						</li>
					{/each}
				</ol>
				{#if route.others.length}
					<p class="stil andere">Eerste en enige aanleg bij een andere rechter:</p>
					<ul class="andere-lijst">
						{#each route.others as court (court.tier)}
							<li><span class="naam">{court.name}</span> {@render articles(court)}</li>
						{/each}
					</ul>
				{/if}
			</section>

			{#if view.id === 'bestuur' && data.regeling.length}
				<section class="regeling" aria-labelledby="regeling-kop">
					<h2 id="regeling-kop">Bevoegdheidsregeling bestuursrechtspraak</h2>
					<p class="stil">Bijlage 2 bij de Awb, koppen zoals de bijlage ze schrijft.</p>
					<div class="kop-rij stil" aria-hidden="true">
						<span>Artikel</span><span>Rechter</span><span>Wetten genoemd</span>
					</div>
					{#each data.regeling as chapter (chapter.label)}
						<h3 class="hoofdstuk">{chapter.label} {chapter.title ?? ''}</h3>
						<ul class="artikelen">
							{#each chapter.articles as art (art.key)}
								{@const court = designatedCourt(data, art.number)}
								<li>
									<details>
										<summary>
											<span class="art-naam"
												>{annexArticleName(art.number)}
												{art.heading ?? ''}</span
											>
											<span class="rechter">{court ?? ''}</span>
											<span class="aantal">{count(art.laws.length, 'wet', 'wetten')}</span>
										</summary>
										<p class="open-kop">
											<a href={openHref({ collection: 'articles', key: art.key })}
												>{annexArticleName(art.number)} van de regeling</a
											>
										</p>
										<ul class="wetten">
											{#each art.laws as law (law.bwb_id)}
												<li>
													{#if law.name}<a href={openHref(lawRef(law.bwb_id))}>{law.name}</a
														>{:else}<a href={openHref(lawRef(law.bwb_id))}>{law.bwb_id}</a><span
															class="gat">, naam {NOT_IN_DATA}</span
														>{/if}
												</li>
											{/each}
										</ul>
									</details>
								</li>
							{/each}
						</ul>
					{/each}
				</section>
			{/if}
		{/if}
	</div>
</div>

<style>
	.lede {
		margin: var(--s-2) 0 var(--s-4);
	}
	.gebied,
	.regeling {
		margin-top: var(--s-6);
		padding-top: var(--s-4);
		border-top: 1px solid var(--rule);
	}
	h2 {
		margin: 0 0 var(--s-4);
		font: var(--niveau-1-sectie);
		color: var(--ink);
	}
	.rechtsgang :is(.lede, .instantie, .andere-lijst, .open-kop, .wetten) a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.route {
		display: flex;
		gap: var(--s-2);
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.stap {
		display: flex;
		flex: 1;
		align-items: center;
		gap: var(--s-2);
		min-width: 0;
	}
	.pijl {
		flex: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.pijl::after {
		content: ' →';
	}
	.vak {
		flex: 1 1 14rem;
		min-width: 0;
		padding: var(--s-3);
		border: 1px solid var(--ink-3);
		border-radius: var(--r-2);
	}
	.fase {
		display: block;
		font-size: var(--t-micro);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-3);
	}
	.instantie {
		margin: var(--s-1) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.naam {
		display: block;
		font-size: var(--t-body);
		color: var(--ink);
	}
	.andere-lijst li .naam {
		display: inline;
	}
	.gat {
		font-style: italic;
		color: var(--ink-3);
	}
	.andere {
		margin-top: var(--s-4);
	}
	.andere-lijst,
	.artikelen,
	.wetten {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.andere-lijst li {
		font-size: var(--t-meta);
		padding: var(--s-1) 0;
	}
	.kop-rij,
	summary {
		display: grid;
		grid-template-columns: minmax(0, 3fr) minmax(0, 1.3fr) minmax(0, 1fr);
		gap: var(--s-3);
	}
	.kop-rij {
		margin-top: var(--s-4);
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--ink-3);
		font-size: var(--t-micro);
		text-transform: uppercase;
	}
	.kop-rij span:last-child,
	.aantal {
		text-align: right;
	}
	.hoofdstuk {
		margin: var(--s-3) 0 0;
		padding: var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.artikelen > li {
		border-bottom: 1px solid var(--rule);
	}
	summary {
		align-items: baseline;
		min-height: var(--veld-h-raak);
		padding: var(--s-2) 0;
		cursor: pointer;
		list-style: none;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	summary::-webkit-details-marker {
		display: none;
	}
	.art-naam {
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.open-kop {
		margin: 0 0 var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.wetten {
		padding-bottom: var(--s-3);
		columns: 2;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.wetten li {
		break-inside: avoid;
	}
	@media (max-width: 768px) {
		.route {
			flex-direction: column;
		}
		.stap {
			flex-direction: column;
			align-items: stretch;
		}
		.vak {
			flex: none;
		}
		.kop-rij {
			display: none;
		}
		summary {
			grid-template-columns: minmax(0, 1fr) auto;
		}
		.rechter {
			display: none;
		}
		.wetten {
			columns: 1;
		}
	}
</style>

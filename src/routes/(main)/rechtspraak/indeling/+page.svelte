<script lang="ts">
	// Indeling (B140): the rechtbank and the gerechtshof of a municipality, as the CBS gives
	// them (CC BY 4.0), each with the article of the Wet op de rechterlijke indeling that draws
	// it. A municipality by name (`?gemeente=GM0392`), a day of reckoning (`?jaar=`); under it
	// every arrondissement with its ressort and its municipalities. Where the API holds no map
	// yet the page says so; nothing is filled in by hand. A municipality the text of the law
	// does not name as the CBS does says it under its result: the indeling follows the CBS.
	import { page } from '$app/state';
	import { getCourtDistricts } from '$lib/api/courts';
	import { openHref } from '$lib/bron/href';
	import { padHref } from '$lib/bron/address';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import Section from '$lib/components/ui/Sectie.svelte';
	import YearMenu from '$lib/components/ui/TekstMenu.svelte';
	import SlowLoad from '$lib/components/ui/SlowLoad.svelte';
	import { sourceTabs } from '$lib/components/explore/index/categories';
	import MunicipalityField from '$lib/court-map/MunicipalityField.svelte';
	import {
		RI,
		articleHref,
		riLabel,
		circuitName,
		judgmentsHref,
		yearLabel,
		byDistrict,
		districtName,
		textDiffers,
		type Municipality
	} from '$lib/court-map/court-map';
	import { SOURCES } from '$lib/nav/sources';
	import SourceTabs from '$lib/nav/SourceTabs.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { count } from '$lib/text/words';
	import { navigate, withParams } from '$lib/util/address';
	import { load } from '$lib/util/load.svelte';

	/** The address parameter of the day of reckoning. */
	const YEAR = 'jaar';
	const judgments = SOURCES.find((x) => x.id === 'rechtspraak')!;
	const year = $derived(Number(page.url.searchParams.get(YEAR)) || undefined);
	const code = $derived(page.url.searchParams.get('gemeente'));
	const map = load(
		() => year ?? 0,
		(y) => getCourtDistricts(y || undefined),
		'Indeling'
	);
	const data = $derived(map.state.status === 'ready' ? map.state.data : null);
	const chosen = $derived(data?.items.find((g) => g.code === code) ?? null);
	const groups = $derived(data ? byDistrict(data.items) : []);
	let opened = $state<string | null>(null);

	const choose = (g: Municipality) => navigate(withParams(page.url, { gemeente: g.code }));
	const clear = () => navigate(withParams(page.url, { gemeente: null }));
	const pick = (g: Municipality) => {
		choose(g);
		document.getElementById('gemeente')?.scrollIntoView({ block: 'center' });
	};
	const setYear = (y: string) =>
		navigate(
			withParams(page.url, { [YEAR]: Number(y) === data?.years[0] ? null : y, gemeente: code })
		);
	const cassation = padHref({ kind: 'artikel', law: 'BWBR0001830', number: '78' });
	const lawRef = { collection: 'instruments' as const, key: RI.toLowerCase() };
</script>

<RouteKop />

<SourceTabs label={judgments.label} tabs={sourceTabs(judgments)} current="/rechtspraak/indeling" />

<div class="page-wrap">
	<div class="container blad indeling">
		<!-- The tab names the page, as on a list of Bladeren (B170). -->
		<h1 class="blad__titel sr-only">Bronnen: Indeling</h1>
		<p class="stil lede">
			Rechtbank en gerechtshof per gemeente, volgens de <a href={openHref(lawRef)}
				>Wet op de rechterlijke indeling</a
			> (RI).
		</p>

		{#if map.state.status === 'loading'}
			<div aria-busy="true"><SlowLoad label="Laden…" /></div>
		{:else if map.state.status === 'error'}
			<LoadState state={map.state} what="De indeling" retry={map.retry} />
		{:else if !data}
			<!-- The API holds no map yet (the CBS source has not run): a gap, shown and not filled in. -->
			<p class="gat">De indeling per gemeente is nog niet beschikbaar.</p>
		{:else}
			<div class="invoer">
				<MunicipalityField items={data.items} {chosen} onChoose={choose} onClear={clear} />
				<div class="peil">
					<span class="peil-label">Peildatum</span>
					<YearMenu
						label="Peildatum"
						opties={data.years.map((y) => ({ ['waarde']: String(y), label: yearLabel(y) }))}
						waarde={String(data.year)}
						onSelect={setYear}
					/>
				</div>
			</div>

			{#if chosen}
				<section class="resultaat" aria-labelledby="resultaat-kop">
					<h2 id="resultaat-kop">{chosen.name}</h2>
					<p class="provincie">Gemeente in de provincie {chosen.province}</p>
					<div class="kaarten">
						<div class="kaart">
							<span class="fase">Eerste aanleg</span>
							<span class="naam">{districtName(chosen.district)}</span>
							<p class="regel raak-regels">
								Arrondissement {chosen.district.name}{#if articleHref(chosen.district)}, <a
										href={articleHref(chosen.district)}>{riLabel(chosen.district)}</a
									>{/if}
							</p>
							<a class="uitspraken" href={judgmentsHref(districtName(chosen.district))}
								>Uitspraken van de {districtName(chosen.district).replace(
									/^Rechtbank/,
									'rechtbank'
								)}</a
							>
						</div>
						<div class="kaart">
							<span class="fase">Hoger beroep</span>
							<span class="naam">{circuitName(chosen.circuit)}</span>
							<p class="regel raak-regels">
								Ressort {chosen.circuit.name.replace(
									/^Gerechtshof /,
									''
								)}{#if articleHref(chosen.circuit)}, <a href={articleHref(chosen.circuit)}
										>{riLabel(chosen.circuit)}</a
									>{/if}
							</p>
							<a class="uitspraken" href={judgmentsHref(circuitName(chosen.circuit))}
								>Uitspraken van het {circuitName(chosen.circuit).replace(
									/^Gerechtshof/,
									'gerechtshof'
								)}</a
							>
						</div>
						<div class="kaart">
							<span class="fase">Cassatie</span>
							<span class="naam">Hoge Raad</span>
							<p class="regel raak-regels">
								Voor heel Nederland, <a href={cassation}>art. 78 RO</a>
							</p>
							<a class="uitspraken" href="/rechtspraak/rechtsgang">Rechtsgang</a>
						</div>
					</div>
					{#if data.checked && textDiffers(chosen)}
						<p class="afwijking">
							De tekst van <a href={articleHref(chosen.district) ?? openHref(lawRef)}
								>{riLabel(chosen.district) ?? 'de wet'}</a
							> noemt deze gemeente niet zoals het CBS; de indeling volgt het CBS.
						</p>
					{/if}
				</section>
			{/if}

			<Section title="Per arrondissement" niveau={2} inklapbaar={false} rijen>
				<table class="tabel">
					<thead>
						<tr>
							<th scope="col">Rechtbank</th>
							<th scope="col">Gerechtshof</th>
							<th scope="col" class="getal">Gemeenten</th>
							<th scope="col">Artikel</th>
						</tr>
					</thead>
					<tbody>
						{#each groups as g (g.district.code)}
							{@const here = chosen?.district.code === g.district.code}
							<tr class:hier={here}>
								<th scope="row"
									>{#if judgmentsHref(districtName(g.district))}<a
											href={judgmentsHref(districtName(g.district))}>{districtName(g.district)}</a
										>{:else}{districtName(g.district)}{/if}{#if here}<span class="hier-in"
											>({chosen?.name})</span
										>{/if}</th
								>
								<td data-label="Gerechtshof">{circuitName(g.circuit)}</td>
								<td class="getal" data-label="Gemeenten"
									><button
										type="button"
										class="aantal"
										aria-expanded={opened === g.district.code}
										aria-controls="gemeenten-{g.district.code}"
										onclick={() => (opened = opened === g.district.code ? null : g.district.code)}
										>{count(g.municipalities.length, 'gemeente', 'gemeenten')}</button
									></td
								>
								<td data-label="Artikel"
									>{#if articleHref(g.district)}<a href={articleHref(g.district)}
											>{riLabel(g.district)}</a
										>{/if}</td
								>
							</tr>
							{#if opened === g.district.code}
								<tr class="gemeenten" id="gemeenten-{g.district.code}">
									<td colspan="4">
										<ul>
											{#each g.municipalities as m (m.code)}
												<li><button type="button" onclick={() => pick(m)}>{m.name}</button></li>
											{/each}
										</ul>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</Section>
			<p class="bron">Indeling: {data.source}.</p>
		{/if}
	</div>
</div>

<style>
	.lede {
		margin: var(--s-2) 0 var(--s-4);
	}
	.indeling :is(.lede, .regel, .afwijking) a {
		color: inherit;
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.gat {
		margin: var(--s-4) 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.invoer {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: var(--s-4);
	}
	.peil {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.peil-label {
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.resultaat {
		margin-top: var(--s-6);
	}
	h2 {
		margin: 0;
		font: var(--niveau-1-sectie);
		color: var(--ink);
	}
	.provincie {
		margin: var(--s-1) 0 0;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.kaarten {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: var(--s-4);
		margin-top: var(--s-4);
	}
	.kaart {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: var(--s-3);
		border: 1px solid var(--ink-3);
		border-radius: var(--r-2);
	}
	.fase {
		font-size: var(--t-micro);
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--ink-3);
	}
	.naam {
		margin-top: var(--s-1);
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.regel {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.regel a {
		white-space: nowrap;
	}
	.uitspraken {
		display: inline-flex;
		align-items: center;
		min-height: var(--veld-h-raak);
		align-self: flex-start;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
	}
	.afwijking {
		margin: var(--s-3) 0 var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.tabel {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.tabel :is(th, td) {
		padding: var(--s-2) var(--s-3) var(--s-2) 0;
		border-bottom: 1px solid var(--rule);
		text-align: left;
		vertical-align: baseline;
		font-weight: 400;
	}
	.tabel thead th {
		font-size: var(--t-micro);
		color: var(--ink-3);
		border-bottom-color: var(--ink-3);
	}
	.tabel tbody th a {
		color: var(--ink);
		text-underline-offset: 3px;
	}
	.tabel .getal {
		text-align: right;
	}
	.tabel a {
		color: inherit;
		text-underline-offset: 3px;
	}
	.tabel td:last-child {
		white-space: nowrap;
	}
	tr.hier {
		background: var(--paper-2);
	}
	tr.hier th {
		font-weight: 600;
	}
	.hier-in {
		margin-left: var(--s-1);
		font-weight: 400;
		color: var(--ink-3);
	}
	.aantal,
	.gemeenten button {
		min-height: var(--veld-h);
		padding: 0 var(--s-2);
		border: 0;
		background: transparent;
		font: inherit;
		color: var(--ink);
		text-decoration: underline;
		text-underline-offset: 3px;
		cursor: pointer;
	}
	.gemeenten ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0 var(--s-3);
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.bron {
		margin: var(--s-3) 0 0;
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	@media (max-width: 768px) {
		.kaarten {
			grid-template-columns: 1fr;
			gap: var(--s-3);
		}
		.tabel thead {
			display: none;
		}
		.tabel :is(tbody, th, td) {
			display: block;
		}
		.tabel tbody tr:not(.gemeenten) {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			column-gap: var(--s-4);
			padding: var(--s-2) 0;
			border-bottom: 1px solid var(--rule);
		}
		.tabel tr.gemeenten {
			display: block;
			border-bottom: 1px solid var(--rule);
		}
		.tabel tbody tr :is(th, td[data-label='Gerechtshof']) {
			flex: 0 0 100%;
		}
		.aantal,
		.gemeenten button {
			min-height: var(--veld-h-raak);
		}
		.tabel :is(tbody th a, td:last-child a) {
			display: inline-flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
</style>

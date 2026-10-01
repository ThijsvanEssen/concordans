<script lang="ts">
	import { langeDatum, vandaag } from '$lib/text/datum';
	import { onMount } from 'svelte';
	import { getCoverage, getStats, type Coverage, type Stats } from '$lib/api/stats';
	import { longDate } from '$lib/verbonden/rows';
	import { formatCount } from '$lib/verbonden/filter';
	import { modKey } from '$lib/utils/platform';
	import { RELATIONS, RELATION_LABEL, TIERS, TIER_LABEL } from '$lib/vocabulary';

	/** The collections the dekking lists, in the order of the bronnen above. */
	const COVERAGE: { collection: string; label: string }[] = [
		{ collection: 'instruments', label: 'Instrumenten' },
		{ collection: 'articles', label: 'Artikelen' },
		{ collection: 'judgments', label: 'Uitspraken' },
		{ collection: 'dossiers', label: 'Dossiers' },
		{ collection: 'documents', label: 'Kamerstukken en andere documenten' },
		{ collection: 'members', label: 'Kamerleden' },
		{ collection: 'committees', label: 'Commissies' }
	];

	let stats = $state<Stats | null>(null);
	let coverage = $state<Coverage | null>(null);
	let fetchedOn = $state<string | null>(null);

	/** The relation types the network holds, in vocabulary order: only those the API counts. */
	/** The colleges the dataset holds judgments of, in the order of the filters. */
	const tiers = $derived(
		TIERS.flatMap((tier) =>
			(coverage?.tiers ?? []).filter((c) => c.tier === tier).map((c) => ({ ...c, tier }))
		)
	);

	const relations = $derived(
		stats ? RELATIONS.filter((r) => (stats!.edges.by_relation[r] ?? 0) > 0) : []
	);

	onMount(() => {
		getStats()
			.then((s) => {
				stats = s;
				fetchedOn = langeDatum(vandaag());
			})
			.catch(() => (stats = null));
		getCoverage()
			.then((c) => (coverage = c))
			.catch(() => (coverage = null));
	});
</script>

<svelte:head>
	<title>Documentatie · Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Documentatie</div>
		<h1 class="stub-title">Documentatie</h1>
		<p class="stub-lede">
			Concordans verbindt wetsartikelen, rechterlijke uitspraken, parlementaire documenten en
			wetgevingsdossiers in één netwerk.
		</p>

		<div class="section" id="dekking">
			<h2 class="section-title">Bronnen en dekking</h2>
			<p>
				Een instrument (wet, AMvB, ministeriële regeling, verdrag) bestaat uit artikelen; de
				verbinding tussen beide is <em>onderdeel van</em>. Een eerdere tekst van een artikel is een
				eigen bron, verbonden met <em>versie van</em>. Een publicatie in het Staatsblad wijzigt,
				voegt toe aan of trekt een regeling in.
			</p>
			<p>
				Een uitspraak verwijst naar artikelen, instrumenten en andere uitspraken. Een uitspraak in
				hoger beroep of cassatie is <em>hoger beroep van</em> de bestreden uitspraak.
			</p>
			<p>
				Een wetgevingsdossier bundelt de kamerstukken, zaken, activiteiten, stemmingen en
				toezeggingen van een wetsvoorstel, bij Tweede en Eerste Kamer.
			</p>
			<p>
				Het netwerk is gericht op Nederlands recht. Gemeentelijke verordeningen en
				niet-gepubliceerde uitspraken vallen buiten de dekking. Europese regelgeving staat erin voor
				zover een Nederlandse regeling ernaar verwijst. Waar de gegevens vandaan komen staat in het <a
					href="/colofon"
					class="cite">colofon</a
				>; hoe een verbinding ontstaat in de
				<a href="/docs/methode" class="cite">methode</a>.
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
				<p class="list-note">
					Aantallen in het netwerk op {fetchedOn}. Een bron die ontbreekt, staat niet in deze
					selectie; dat is geen bewijs dat hij niet bestaat.
				</p>
			{/if}
		</div>

		<div class="section">
			<h2 class="section-title">Zoeken</h2>
			<p>
				Het zoekveld (startpagina, <kbd>{modKey} K</kbd>) doorzoekt instrumenten, artikelen,
				uitspraken, dossiers, documenten, commissies, kamerleden en fracties op tekst. Vier notaties
				openen een bron direct:
			</p>
			<div class="list">
				<div class="list-row">
					<span class="list-k">ECLI</span><span>ECLI:NL:HR:2019:1278</span>
				</div>
				<div class="list-row">
					<span class="list-k">artikelcitaat</span><span>artikel 287 Sr, art. 7:658 BW</span>
				</div>
				<div class="list-row">
					<span class="list-k">dossiernummer</span><span>36264, 37020-XV, 37020-XV-3</span>
				</div>
				<div class="list-row">
					<span class="list-k">BWB-id of CELEX</span><span>BWBR0001854, 32013L0036</span>
				</div>
			</div>
			<p>
				De zoekindex doorzoekt tekst als substring, niet gerangschikt op relevantie. Een recent
				toegevoegde bron ontbreekt er soms nog in. De positie binnen een bron staat in de URL: <code
					>#lid-2</code
				>, <code>#lid-2-onder-a</code>, <code>#aanhef</code> in een artikel, <code>#rov-5.3</code> in
				een uitspraak.
			</p>
			<p>Een bron heeft een eigen adres op zijn officiële nummer:</p>
			<div class="list">
				<div class="list-row">
					<span class="list-k">uitspraak</span><span>/uitspraken/ECLI:NL:HR:2019:2006</span>
				</div>
				<div class="list-row">
					<span class="list-k">artikel</span><span>/wetten/BWBR0005289/artikel/6:162</span>
				</div>
				<div class="list-row">
					<span class="list-k">dossier</span><span>/dossiers/36600-VIII</span>
				</div>
				<div class="list-row">
					<span class="list-k">Kamerstuk</span><span
						>/kamerstukken/36799/31, /kamerstukken/36600-VIII/AB</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">publicatie</span><span>/stb/2026/94</span>
				</div>
			</div>
			<p>
				De weergave staat erachter: <code>?lezen=1</code> voor de tekst op volle breedte. Andere
				bronnen houden een adres onder <code>/explore</code>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Verbindingen</h2>
			<p>
				Elke verbinding draagt een type, een status (vastgesteld of voorgesteld) en, waar ze niet
				structureel is, een betrouwbaarheidsscore tussen 0 en 1: een score van 1 is rechtstreeks uit
				de brontekst gelezen, lager is afgeleid. Een verwijzing tussen artikelen kan daarnaast een
				aard dragen: voorwaarde, uitzondering, definitie, procedure, reikwijdtebeperking of
				delegatie.
			</p>
			{#if relations.length}
				<div class="list list--two-col">
					{#each relations as relation (relation)}
						<div class="list-row">
							<span class="list-k">{relation}</span><span>{RELATION_LABEL[relation]}</span>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="section">
			<h2 class="section-title">Klikken</h2>
			<p>
				Eén klik op een rij, een titel of een verwijzing opent die ter plekke: de rij klapt uit, of
				naast de verwijzing verschijnt een kaart met soort, naam, datum en de eerste regels. Daarin
				staat de weg naar de bron zelf: <strong>Lees</strong> opent de bron,
				<strong>In het netwerk</strong>
				toont haar tussen haar verbindingen. In Verbonden staan er ook
				<strong>Alleen de omgeving</strong> en <strong>In netwerk</strong>.
			</p>
			<p>
				Cmd-klik, ctrl-klik en een klik met de middelste knop openen de bron direct, in een nieuw
				tabblad waar de browser dat doet. <kbd>Esc</kbd> of een klik ernaast sluit een kaart.
			</p>
			<p>
				Uitzondering: een zoekresultaat opent de bron direct. Zoeken is navigeren; wie een bron
				zoekt, wil erheen.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Netwerk samenstellen</h2>
			<p>
				Een klik op een bron in het netwerk kiest die bron; de lezer ernaast toont haar. Het netwerk
				blijft staan. Rust de muis op een bron, dan staat naast haar een kaart met
				<strong>Tekst lezen</strong>, <strong>Omgeving tonen</strong> en
				<strong>In netwerk</strong>. Een dubbelklik doet hetzelfde als Omgeving tonen: het netwerk
				opnieuw rond die bron, tot de gekozen diepte.
			</p>
			<p>
				Een artikel, wet, uitspraak of stuk heeft een eigen tekst. De schakelaar
				<strong>Netwerk</strong> / <strong>Tekst</strong> rechtsboven (toets <kbd>L</kbd>) wisselt
				tussen het netwerk met de lezer ernaast en de tekst op volle breedte, met inhoudsopgave. Een
				link van buiten de Verkenner opent zo'n bron op volle breedte. Een kamerlid, commissie,
				fractie of dossier staat altijd naast het netwerk.
			</p>
			<p>
				Het paneel Netwerk rechtsboven toont de gekozen bronnen als labels: een klik zet een bron
				uit of aan, × haalt haar weg. <strong>+ bron</strong> zoekt een bron om toe te voegen; een
				geselecteerde bron komt erbij met <strong>+ naam</strong>, en elke rij in Verbonden heeft
				een +. Gekozen bronnen staan in de URL (<code>?netwerk</code>). Het netwerk toont ze met hun
				onderlinge verbindingen en met de bronnen die twee van hen verbinden: een stuk dat beide
				ondertekenden, een artikel van een gekozen wet. Een bron zonder zulke verbinding staat als
				<em>los</em> in het paneel. Paden van meer dan twee stappen worden nog niet gevonden.
			</p>
			<p>
				Diepte voegt context toe rond de geselecteerde bron, net als een groep uit Verbonden.
				Context staat vaag getekend. <strong>Alleen de gekozen bronnen tonen</strong> (onder ⋯) laat
				de gekozen bronnen en hun verbindingen staan. <strong>Wissen</strong> maakt alles leeg: gekozen
				bronnen, selectie en canvas. Terug zet het terug. Zonder wissen opent de Verkenner op het laatste
				netwerk.
			</p>
			<p>
				De legenda linksboven toont dicht de tekens van wat op het canvas staat, en open het
				bronfilter, alle tekens met hun betekenis, de groepering en de verbindingen. Een omtrek is
				een bron die alleen genoemd wordt en niet in de gegevens staat.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Dossiers en Parlement</h2>
			<p>
				Een dossier heeft een nummer, soms met toevoeging: 37020-XV is een ander dossier dan 37020.
				Dossiers onder hetzelfde nummer die in de lijst naast elkaar staan, zoals de hoofdstukken
				van een begroting, staan in Bladeren onder één regel. Het traject is wetsvoorstel,
				initiatiefwetsvoorstel, begroting, verdrag, initiatiefnota, nota, structuurvisie,
				verantwoording, EU, interparlementair, Kamer of beleid.
			</p>
			<p>
				Alleen een wetsvoorstel, initiatiefwetsvoorstel, begroting of verdrag doorloopt fasen:
				wetsvoorstel, memorie van toelichting, advies Raad van State, verslag, nota naar aanleiding
				van het verslag, amendementen, behandeling, stemming, afgehandeld. Een ander dossier heeft
				geen fase tot het is afgehandeld.
			</p>
			<p>
				Een afgehandeld dossier heeft een uitkomst en een datum. Aangenomen: de Eerste Kamer nam het
				wetsvoorstel aan, of de wet is in het Staatsblad gepubliceerd. Verworpen: de Tweede Kamer of
				de Eerste Kamer stemde tegen het wetsvoorstel. Ingetrokken: het wetsvoorstel is bij brief
				ingetrokken.
			</p>
			<p>
				Een stemming van de Tweede Kamer staat per fractie geregistreerd, met zetels, of per lid bij
				een hoofdelijke stemming. Zonder hoofdelijke stemming volgt de stem van een lid uit de
				fractie waarbij het op dat moment hoorde. Van een stemming van de Eerste Kamer staan de
				wijze van stemmen en de fracties voor en tegen geregistreerd, zonder zetels.
			</p>
			<p>
				De wetgevingsgeschiedenis van een artikel is de reeks dossiers die het invoerden, wijzigden
				of introkken, met de dossiers die dat nu voorstellen.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Regering</h2>
			<p>
				Bladeren toont onder Regering de kabinetten, de bewindspersonen en de toezeggingen. Een
				kabinet heeft een periode, een minister-president en een coalitie. Per ministerie staat wie
				welke post bekleedde, op de tijdlijn van het kabinet: een opvolger volgt op dezelfde regel,
				een waarnemer is gearceerd, de demissionaire periode ligt als band erachter. De gegevens
				komen van rijksoverheid.nl.
			</p>
		</div>

		<div class="section" id="beperkingen">
			<h2 class="section-title">Bekende beperkingen</h2>
			<p>
				<strong>Eerste Kamer.</strong> Kamerstukken van de Eerste Kamer zijn opgenomen onder het
				dossiernummer van het wetsvoorstel, en haar besluiten over wetsvoorstellen vanaf juli 2026.
				Leden, fracties en commissies van de Eerste Kamer ontbreken; zie
				<a href="https://www.eerstekamer.nl" class="cite">eerstekamer.nl</a>.
			</p>
			<p>
				<strong>Europees en verdragsrecht.</strong> Een Europese richtlijn of verordening staat in
				het netwerk voor zover een Nederlandse regeling ernaar verwijst, niet volledig. Uitspraken
				van het EHRM zijn opgenomen; dekking van het Hof van Justitie is niet betrouwbaar. Zie
				<a href="https://eur-lex.europa.eu" class="cite">eur-lex.europa.eu</a>
				en
				<a href="https://hudoc.echr.coe.int" class="cite">hudoc.echr.coe.int</a>.
			</p>
			<p>
				<strong>Actualisering.</strong> Elke bron wordt afzonderlijk ververst, niet doorlopend. De geldigheidsdatum
				van een artikel is de inwerkingtredingsdatum, niet het moment van verversen.
			</p>
			<p>
				<strong>Dekking.</strong> Het netwerk bevat een selectie: niet elk BWB-instrument, niet de volledige
				rechtspraak.nl-collectie, niet het volledige Tweede Kamer-archief. Het ontbreken van een resultaat
				is geen bewijs dat de bron niet bestaat.
			</p>
		</div>

		<div class="meta-row">
			<a href="/docs/methode" class="meta-link">Methode</a>
			<a href="/docs/sneltoetsen" class="meta-link">Sneltoetsen</a>
			<a href="/api" class="meta-link">API-referentie</a>
			<a href="/colofon" class="meta-link">Colofon</a>
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

	.cite {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
	}

	code,
	kbd {
		font-family: var(--font-sans);
		font-size: 0.85em;
		color: var(--ink-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		padding: 0 var(--s-1);
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

	.list--two-col {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.list--two-col .list-row:nth-child(2n) {
		border-left: 1px solid var(--rule);
	}

	.list--two-col .list-row:nth-child(1),
	.list--two-col .list-row:nth-child(2) {
		border-top: 0;
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

	@media (max-width: 560px) {
		.list--two-col {
			grid-template-columns: 1fr;
		}
		.list--two-col .list-row:nth-child(2n) {
			border-left: 0;
		}
		.list--two-col .list-row:nth-child(n) {
			border-top: 1px solid var(--rule);
		}
		.list--two-col .list-row:first-child {
			border-top: 0;
		}
	}
</style>

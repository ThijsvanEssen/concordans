<script lang="ts">
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

	/** When each source was last read, as the API says (`data_as_of`). */
	const asOf = $derived(
		Object.entries(stats?.data_as_of ?? {}).flatMap(([source, d]) =>
			d?.retrieved_at
				? [{ source: SOURCE_LABEL[source] ?? source, date: d.retrieved_at.slice(0, 10) }]
				: []
		)
	);

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
			.then((s) => (stats = s))
			.catch(() => (stats = null));
		getCoverage()
			.then((c) => (coverage = c))
			.catch(() => (coverage = null));
	});
</script>

<svelte:head>
	<title>Documentatie, Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Documentatie</div>
		<h1 class="stub-title">Documentatie</h1>
		<p class="stub-lede">
			Concordans toont wetten, uitspraken en parlementaire stukken uit officiële bronnen, met de
			verbindingen ertussen. Het is een naslagwerk en geeft geen juridisch advies.
		</p>

		<div class="section" id="onderdelen">
			<h2 class="section-title">Onderdelen</h2>
			<p>
				Zoeken (startpagina, <kbd>{modKey} K</kbd>) gaat naar een bron. Bladeren toont lijsten per
				soort bron in vier groepen: Recht, Parlementaire behandeling, Parlement en Regering. Actueel
				toont per dag nieuwe Kamerstukken, stemmingen, toezeggingen, uitspraken en publicaties.
			</p>
			<p>
				Een bron opent in de Verkenner. Een artikel, wet, uitspraak of Kamerstuk staat daar als
				tekst op volle breedte (<strong>Tekst</strong>) of naast het netwerk (<strong
					>Netwerk</strong
				>). Elke andere bron staat naast het netwerk. Verbonden, rechts, somt de verbindingen van de
				bron op per groep. Het netwerk tekent dezelfde verbindingen.
			</p>
		</div>

		<div class="section" id="dekking">
			<h2 class="section-title">Bronnen en dekking</h2>
			<p>
				Een instrument is een regeling uit het Basiswettenbestand, een verdrag of een Europese
				regeling. Het bestaat uit artikelen. Een eerdere tekst van een artikel is een eigen bron.
				Een publicatie in het Staatsblad wijzigt een regeling, voegt eraan toe of trekt haar in.
			</p>
			<p>
				Een uitspraak verwijst naar artikelen, instrumenten en andere uitspraken. Een uitspraak in
				hoger beroep of cassatie is verbonden met de bestreden uitspraak.
			</p>
			<p>
				Een dossier bundelt de Kamerstukken, activiteiten, stemmingen en toezeggingen over één
				onderwerp, bij beide Kamers.
			</p>
			<p>
				De herkomst per bron staat in de <a href="/docs/methode" class="cite">methode</a>; de
				bronvermelding in het <a href="/colofon" class="cite">colofon</a>.
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
					<p class="list-note">Laatst opgehaald:</p>
					<div class="list">
						{#each asOf as a (a.source)}
							<div class="list-row">
								<span class="list-k">{a.source}</span><span>{longDate(a.date)}</span>
							</div>
						{/each}
					</div>
				{/if}
			{/if}
		</div>

		<div class="section">
			<h2 class="section-title">Zoeken</h2>
			<p>
				Het zoekveld doorzoekt instrumenten, artikelen, uitspraken, dossiers, Kamerstukken,
				stemmingen, personen, fracties, commissies, kabinetten en toezeggingen. Een treffer op
				nummer staat eerst, dan een op de volledige naam, het begin van de naam, een deel ervan en
				ten slotte op woorden.
			</p>
			<p>Een nummer, citaat of wetsnaam opent de bron direct:</p>
			<div class="list">
				<div class="list-row">
					<span class="list-k">ECLI</span><span>ECLI:NL:HR:2019:1278</span>
				</div>
				<div class="list-row">
					<span class="list-k">artikelcitaat</span><span>artikel 287 Sr, art. 7:658 BW</span>
				</div>
				<div class="list-row">
					<span class="list-k">dossier</span><span>36264, 37020-XV</span>
				</div>
				<div class="list-row">
					<span class="list-k">Kamerstuk</span><span
						>37020-XV-3, Kamerstukken II 2020/21, 36327, nr. 3</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">BWB-id of CELEX</span><span>BWBR0001854, 32013L0036</span>
				</div>
				<div class="list-row">
					<span class="list-k">wetsnaam</span><span
						>Awb, Algemene verordening gegevensbescherming</span
					>
				</div>
			</div>
			<p>
				Een bron heeft een eigen adres: op haar officiële nummer, en voor personen en organen op
				naam.
			</p>
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
					<span class="list-k">publicatie</span><span>/stb/2026/94, /stcrt/…, /trb/…</span>
				</div>
				<div class="list-row">
					<span class="list-k">lid</span><span>/leden/rob-jetten</span>
				</div>
				<div class="list-row">
					<span class="list-k">kabinet</span><span>/kabinetten/rutte_iv</span>
				</div>
				<div class="list-row">
					<span class="list-k">fractie</span><span>/fracties/d66</span>
				</div>
				<div class="list-row">
					<span class="list-k">commissie</span><span>/commissies/szw</span>
				</div>
				<div class="list-row">
					<span class="list-k">toezegging</span><span>/toezeggingen/TZ202609-124</span>
				</div>
			</div>
			<p>
				De weergave staat erachter: <code>?lezen=1</code> voor de tekst op volle breedte. Een plaats
				in de tekst staat na het hekje: <code>#lid-2-onder-a</code> in een artikel,
				<code>#rov-5.3</code> in een uitspraak. Een stemming heeft geen eigen adres en blijft onder
				<code>/explore</code>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Verbindingen</h2>
			<p>
				Elke verbinding heeft een soort. Hoe een verbinding ontstaat en wat haar score en status
				betekenen, staat in de <a href="/docs/methode" class="cite">methode</a>.
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
				Eén klik op een rij, een titel of een verwijzing opent die ter plekke. Een rij klapt uit;
				naast een verwijzing verschijnt een kaart met soort, naam, datum en de eerste regels. Met de
				muis erop of met de toetsenbordfocus verschijnt dezelfde kaart, zonder knoppen.
			</p>
			<p>
				In de kaart opent <strong>Lees</strong> de bron. <strong>In het netwerk</strong> toont haar met
				haar verbindingen. Cmd-klik, ctrl-klik en een klik met de middelste knop openen de bron direct.
				Een zoekresultaat opent de bron ook direct.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Netwerk</h2>
			<p>
				Een klik op een bron in het netwerk kiest die bron; de lezer ernaast toont haar. Een
				dubbelklik tekent het netwerk opnieuw rond die bron, tot de gekozen diepte. Diepte voegt
				bronnen rond de gekozen bron toe; die staan vaag getekend.
			</p>
			<p>
				Meer dan veertig bronnen van één soort die alleen aan de gekozen bron hangen, staan als één
				groep, zoals ‘250 uitspraken’. Een klik op de groep tekent ze alle of toont ze in Verbonden.
				De artikelen van één wet, de stukken van één dossier en de leden van een fractie of
				commissie staan binnen een omtrek met haar naam. Een open teken, alleen de rand, is een bron
				die alleen genoemd wordt en niet in de gegevens staat.
			</p>
			<p>
				Het paneel Netwerk, rechtsboven, houdt bronnen vast over meerdere keuzes heen. Een klik op
				een naam zet de bron uit of aan; × haalt haar weg. <strong>+ bron</strong> zoekt een bron om
				toe te voegen; in Verbonden heeft elke rij een +. De gekozen bronnen staan in de URL (<code
					>?netwerk</code
				>).
			</p>
			<p>
				Het netwerk toont de gekozen bronnen met hun onderlinge verbindingen en met de bronnen
				ertussen, tot vier stappen. <strong>Bronnen ertussen</strong> zet die aan of uit. Een
				gekozen bron zonder verbinding met de andere staat als <em>los</em> in het paneel.
				<strong>Wissen</strong> maakt het netwerk leeg; Terug zet het terug. Zonder wissen opent de Verkenner
				op het laatste netwerk.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Dossiers en Parlement</h2>
			<p>
				Een dossier heeft een nummer, soms met toevoeging: 37020-XV is een ander dossier dan 37020.
				Bladeren zet dossiers onder één nummer, zoals de hoofdstukken van een begroting, op één
				regel.
			</p>
			<p>
				De soort van een dossier is die van de Tweede Kamer: Wetgeving, Initiatiefwetgeving,
				Begroting, Verdrag, Initiatiefnota of PKB/Structuurvisie. Een ander dossier staat onder
				Overige dossiers.
			</p>
			<p>
				Een wetsvoorstel en een begroting doorlopen fasen: voorstel van wet, memorie van
				toelichting, advies Raad van State, verslag, nota naar aanleiding van het verslag, nota van
				wijziging of amendement, stemmingen en eindtekst. Een fase is doorlopen als een stuk,
				activiteit of besluit in de gegevens haar markeert.
			</p>
			<p>
				Een wetsvoorstel is aangenomen of verworpen, per Kamer, met datum en wijze van stemmen. Van
				de Eerste Kamer toont het dossier ook de stand en de stukken op eerstekamer.nl.
			</p>
			<p>
				Een stemming van de Tweede Kamer staat per fractie, met zetels, of per lid bij een
				hoofdelijke stemming. Zonder hoofdelijke stemming volgt de stem van een lid uit de fractie
				waartoe het op dat moment behoorde. Van een stemming van de Eerste Kamer staan de wijze van
				stemmen en de fracties voor en tegen, zonder zetels.
			</p>
			<p>
				De wetsgeschiedenis van een artikel is de reeks dossiers die het invoerden, wijzigden of
				introkken, met de dossiers die dat nu voorstellen.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Regering</h2>
			<p>
				Bladeren toont onder Regering de kabinetten, de bewindspersonen en de toezeggingen. Een
				kabinet heeft een periode, een minister-president en een coalitie. Per ministerie staat op
				de tijdlijn van het kabinet wie welke post bekleedde. Een opvolger staat op dezelfde regel;
				een waarnemer staat gestippeld, met ‘waarnemend’. De demissionaire periode is een
				stippellijn op de tijdas.
			</p>
		</div>

		<div class="section" id="beperkingen">
			<h2 class="section-title">Bekende beperkingen</h2>
			<p>
				Het netwerk bevat een selectie: niet elk BWB-instrument, niet alle uitspraken van
				rechtspraak.nl, niet het volledige archief van de Kamers. Gemeentelijke verordeningen en
				ongepubliceerde uitspraken vallen erbuiten. Een bron die ontbreekt, staat niet in deze
				selectie; dat is geen bewijs dat ze niet bestaat.
			</p>
			<p>
				Een Europese richtlijn of verordening staat erin voor zover een Nederlandse regeling ernaar
				verwijst. Van het EHRM staat een selectie uitspraken in het netwerk, van het Hof van
				Justitie vrijwel niets. Zie <a href="https://eur-lex.europa.eu" class="cite"
					>eur-lex.europa.eu</a
				>
				en
				<a href="https://hudoc.echr.coe.int" class="cite">hudoc.echr.coe.int</a>.
			</p>
			<p>
				Van de Eerste Kamer staan leden, fracties en commissies erin vanaf 2 oktober 2026, zonder
				eerdere samenstelling, en besluiten over wetsvoorstellen vanaf juli 2026.
			</p>
			<p>
				Elke bron wordt afzonderlijk opgehaald; de datum per bron staat onder Bronnen en dekking. De
				geldigheidsdatum van een artikel is de datum van inwerkingtreding, niet die van het ophalen.
			</p>
			<p>
				Concordans is in ontwikkeling. Functies en weergave kunnen wijzigen. Een adres op ECLI,
				BWB-id of officieel nummer blijft werken.
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

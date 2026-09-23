<script lang="ts">
	import { modKey } from '$lib/utils/platform';
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

		<div class="section">
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
					<span class="list-k">ECLI</span><span>ECLI:NL:HR:2024:1493</span>
				</div>
				<div class="list-row">
					<span class="list-k">artikelcitaat</span><span>artikel 287 Sr, art. 6:162 BW</span>
				</div>
				<div class="list-row">
					<span class="list-k">dossiernummer</span><span>36327, 36327-3</span>
				</div>
				<div class="list-row">
					<span class="list-k">BWB-id of CELEX</span><span>BWBR0001854, 32016L0680</span>
				</div>
			</div>
			<p>
				De zoekindex doorzoekt tekst als substring, niet gerangschikt op relevantie. Een recent
				toegevoegde bron ontbreekt er soms nog in. De positie binnen een bron staat in de URL: <code
					>#lid-2</code
				>, <code>#lid-2-onder-a</code>, <code>#aanhef</code> in een artikel, <code>#rov-5.3</code> in
				een uitspraak.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Verbindingen</h2>
			<p>
				Elke verbinding draagt een van achttien types, een status (vastgesteld of voorgesteld) en,
				waar ze niet structureel is, een betrouwbaarheidsscore tussen 0 en 1: een score van 1 is
				rechtstreeks uit de brontekst gelezen, lager is afgeleid. Een verwijzing tussen artikelen
				kan daarnaast een aard dragen: voorwaarde, uitzondering, definitie, procedure,
				reikwijdtebeperking of delegatie.
			</p>
			<div class="list list--two-col">
				<div class="list-row"><span class="list-k">PART_OF</span><span>onderdeel van</span></div>
				<div class="list-row"><span class="list-k">VERSION_OF</span><span>versie van</span></div>
				<div class="list-row"><span class="list-k">AMENDS</span><span>wijzigt</span></div>
				<div class="list-row"><span class="list-k">INTRODUCES</span><span>voegt toe</span></div>
				<div class="list-row"><span class="list-k">REPEALS</span><span>trekt in</span></div>
				<div class="list-row"><span class="list-k">BASED_ON</span><span>gebaseerd op</span></div>
				<div class="list-row">
					<span class="list-k">IMPLEMENTS</span><span>implementeert</span>
				</div>
				<div class="list-row">
					<span class="list-k">LEGISLATED_IN</span><span>vastgesteld in</span>
				</div>
				<div class="list-row"><span class="list-k">REFERS_TO</span><span>verwijst naar</span></div>
				<div class="list-row"><span class="list-k">EXPLAINS</span><span>licht toe</span></div>
				<div class="list-row">
					<span class="list-k">APPEAL_OF</span><span>hoger beroep van</span>
				</div>
				<div class="list-row"><span class="list-k">SCOPED_BY</span><span>begrensd door</span></div>
				<div class="list-row"><span class="list-k">ABOUT</span><span>over</span></div>
				<div class="list-row"><span class="list-k">LED_BY</span><span>geleid door</span></div>
				<div class="list-row"><span class="list-k">MADE_IN</span><span>gedaan in</span></div>
				<div class="list-row"><span class="list-k">MEMBER_OF</span><span>lid van</span></div>
				<div class="list-row">
					<span class="list-k">AUTHORED</span><span>ingediend door</span>
				</div>
				<div class="list-row"><span class="list-k">VOTED</span><span>stemde over</span></div>
			</div>
		</div>

		<div class="section">
			<h2 class="section-title">Dossiers en Parlement</h2>
			<p>
				Een dossier doorloopt acht fasen: wetsvoorstel, memorie van toelichting, advies Raad van
				State, nota, verslag, amendementen, stemming, afgehandeld. Het traject (wetsvoorstel,
				initiatiefwetsvoorstel, begroting, motie, overig) en de uitslag (aangenomen, verworpen,
				ingetrokken) staan bij het dossier.
			</p>
			<p>
				Een stemming staat per fractie geregistreerd, of per lid bij een hoofdelijke stemming.
				Zonder hoofdelijke stemming volgt de stem van een lid uit de fractie waarbij het op dat
				moment hoorde.
			</p>
			<p>
				De wetgevingsgeschiedenis van een artikel is de reeks dossiers die het invoerden, wijzigden
				of introkken, met de dossiers die dat nu voorstellen.
			</p>
		</div>

		<div class="section" id="beperkingen">
			<h2 class="section-title">Bekende beperkingen</h2>
			<p>
				<strong>Eerste Kamer.</strong> Alleen kamerstukken van de Eerste Kamer zijn opgenomen,
				gekoppeld aan het dossiernummer van de Tweede Kamer. Leden, fracties, commissies en
				stemmingen van de Eerste Kamer ontbreken; zie
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
		padding: 80px 0 120px;
	}

	.container {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 24px;
	}

	.stub-eyebrow {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: 16px;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		line-height: var(--lh-tight);
		color: var(--ink);
		margin: 0 0 16px;
	}

	.stub-lede {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin-bottom: 48px;
	}

	.section {
		margin-bottom: 36px;
	}

	.section-title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 12px;
	}

	p {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0 0 14px;
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
		padding: 1px 6px;
	}

	.list {
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
		margin-bottom: 14px;
	}

	.list-row {
		display: flex;
		gap: 16px;
		padding: 8px 16px;
		font-family: var(--font-sans);
		font-size: 13px;
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
		gap: 24px;
		flex-wrap: wrap;
		margin-top: 48px;
		padding-top: 24px;
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

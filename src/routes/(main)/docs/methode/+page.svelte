<svelte:head>
	<title>Methode, Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow"><a href="/docs">Documentatie</a>, Methode</div>
		<h1 class="stub-title">Methode</h1>
		<p class="stub-lede">
			Concordans haalt elke bron op bij de officiële uitgever en legt de verbindingen ertussen vast.
			Een verbinding komt uit de gegevens van de bron zelf, zoals een artikel en zijn wet of een
			Kamerlid en zijn fractie, of uit een verwijzing in de tekst.
		</p>

		<div class="section">
			<h2 class="section-title">Herkomst per bron</h2>
			<div class="list">
				<div class="list-row">
					<span class="list-k">Wetgeving</span><span
						>wetten.overheid.nl (Basiswettenbestand), op BWB-id.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Rechtspraak</span><span
						>rechtspraak.nl, en HUDOC voor het EHRM, op ECLI.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Parlement</span><span
						>De open data van de Tweede Kamer, en eerstekamer.nl. Kamerstukken op dossier- en
						ondernummer.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Publicaties</span><span
						>Staatsblad, Staatscourant en Tractatenblad, van officielebekendmakingen.nl.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Regering</span><span
						>Kabinetten, hun periodes en bewindspersonen van rijksoverheid.nl.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Europees recht</span><span>EUR-Lex, op CELEX-nummer.</span>
				</div>
				<div class="list-row">
					<span class="list-k">Verdragen</span><span>De Verdragenbank van de Rijksoverheid.</span>
				</div>
				<div class="list-row">
					<span class="list-k">Organisaties</span><span
						>Ministeries en rechtsgebieden uit de waardelijsten van de overheid.</span
					>
				</div>
			</div>
			<p>Bronvermelding en licenties staan in het <a href="/colofon" class="cite">colofon</a>.</p>
		</div>

		<div class="section">
			<h2 class="section-title">Verwijzingen in de tekst</h2>
			<p>
				Concordans herkent verwijzingen aan vaste patronen: een artikelverwijzing, een citeertitel,
				een ECLI. Er is geen taalmodel. Passen meerdere patronen, dan geldt het specifiekste. Een
				herkenning met te weinig zekerheid wordt niet vastgelegd.
			</p>
			<p>
				Een verwijzing tussen artikelen kan een aard hebben: voorwaarde, uitzondering, definitie,
				procedure, beperking van de reikwijdte of delegatie. Een wijziging in het Staatsblad hangt
				aan het artikel dat ze wijzigt, invoegt of intrekt.
			</p>
		</div>

		<div class="section" id="betrouwbaarheid">
			<h2 class="section-title">Betrouwbaarheid</h2>
			<p>De kaart van een verbinding noemt haar herkomst:</p>
			<div class="list">
				<div class="list-row">
					<span class="list-k">gelezen uit de bron</span><span
						>De uitgever legt de verbinding zelf vast, zoals het artikel van een wet of het dossier
						van een Kamerstuk.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">herkend in de tekst</span><span
						>Een verwijzing in de tekst, zoals ‘artikel 6:162 BW’ in een uitspraak. De kaart toont
						de passage.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">afgeleid</span><span
						>Uit het dossier of uit de tekst, zonder verwijzing.</span
					>
				</div>
			</div>
			<p>
				Daarbij staat hoe zeker de verbinding is: hoog, matig of laag. Wat uit de bron gelezen is,
				is hoog. Bij een herkenning of afleiding zegt het woord hoe goed het patroon past. Bij laag:
				lees de passage na.
			</p>
			<p>
				De status is vastgesteld of voorgesteld. Een wijziging uit een wetsvoorstel dat nog niet in
				het Staatsblad staat, is voorgesteld.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Wat Concordans zelf afleidt</h2>
			<p>
				Het lid dat een verwijzing noemt, volgt uit de tekst van de verwijzing. De leden en
				onderdelen van een artikel volgen uit de indeling van de tekst. Bij een memorie van
				toelichting is de passage over een artikel vooraf gekoppeld; zonder die koppeling zoekt
				Concordans in de toelichting naar ‘Artikel N’.
			</p>
			<p>
				Een toelichting staat alleen bij een artikel als ze dat artikel zelf noemt, of als ze het
				artikel toelicht, wijzigt of invoegt. Een toelichting bij het dossier als geheel staat niet
				bij het artikel.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Grenzen</h2>
			<p>
				De patronen begrijpen de tekst niet. Een ongebruikelijke formulering wordt gemist of aan de
				verkeerde bron gelegd. De dekking per bron staat bij de <a
					href="/docs#beperkingen"
					class="cite">bekende beperkingen</a
				>.
			</p>
		</div>

		<div class="meta-row">
			<a href="/docs" class="meta-link">Documentatie</a>
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

	.stub-eyebrow a {
		color: inherit;
		text-decoration: none;
	}

	.stub-eyebrow a:hover {
		color: var(--ink);
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
		line-height: 1.5;
		color: var(--ink);
		border-top: 1px solid var(--rule);
	}

	.list-row:first-child {
		border-top: 0;
	}

	.list-k {
		flex: none;
		width: 10em;
		color: var(--ink-3);
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
		.list-row {
			flex-direction: column;
			gap: var(--s-1);
		}
		.list-k {
			width: auto;
		}
	}
</style>

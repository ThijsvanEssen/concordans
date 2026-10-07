<svelte:head>
	<title>Methode, Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow"><a href="/docs">Documentatie</a>, Methode</div>
		<h1 class="stub-title">Methode</h1>
		<p class="stub-lede">
			Concordans haalt bronnen op bij de officiële uitgever, zet ze om naar één model en legt de
			verbindingen ertussen vast: uit de gegevens van de bron en uit verwijzingen in de tekst.
		</p>

		<div class="section">
			<h2 class="section-title">Pijplijn</h2>
			<p>
				Drie stappen per bron. Ophalen: de officiële bron zelf, in haar eigen formaat. Omzetten: een
				bron in het netwerk, met een eigen adres op haar officiële nummer (<code
					>/dossiers/36558</code
				>). Verbinden: een verbinding komt uit de gegevens van de bron, zoals een artikel en zijn
				wet of een lid en zijn fractie, of uit een verwijzing in de tekst.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Herkomst per bron</h2>
			<div class="list">
				<div class="list-row">
					<span class="list-k">Wetgeving</span><span
						>BWB-XML van wetten.overheid.nl, geadresseerd op BWB-id.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Rechtspraak</span><span
						>XML van rechtspraak.nl, en van HUDOC voor het EHRM, geadresseerd op ECLI.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Parlement</span><span
						>OData van het gegevensmagazijn van de Tweede Kamer. Van de Eerste Kamer eerstekamer.nl
						en de repository van KOOP.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Publicaties</span><span
						>Staatsblad, Staatscourant en Tractatenblad via de repository van KOOP.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Regering</span><span
						>Kabinetten, hun periodes en bewindspersonen van rijksoverheid.nl.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Europees recht</span><span
						>HTML van EUR-Lex, geadresseerd op CELEX-nummer.</span
					>
				</div>
				<div class="list-row">
					<span class="list-k">Verdragen</span><span>De Verdragenbank van de Rijksoverheid.</span>
				</div>
				<div class="list-row">
					<span class="list-k">Organisaties</span><span
						>Ministeries en rechtsgebieden uit de TOOI-waardelijsten van de overheid.</span
					>
				</div>
			</div>
			<p>Bronvermelding en licenties staan in het <a href="/colofon" class="cite">colofon</a>.</p>
		</div>

		<div class="section">
			<h2 class="section-title">Detectoren</h2>
			<p>
				Een detector herkent een patroon in tekst, zoals een artikelverwijzing, een citeertitel of
				een ECLI, en zet dat om in een verbinding met een betrouwbaarheidsscore. Geen taalmodel: een
				vaste set patronen per veld. Waar meerdere patronen passen wint het specifiekste; onder de
				betrouwbaarheidsdrempel wordt niets vastgelegd.
			</p>
			<p>
				Een verwijzing tussen artikelen kan een aard dragen: voorwaarde, uitzondering, definitie,
				procedure, reikwijdtebeperking of delegatie. Een wijziging in het Staatsblad wordt gekoppeld
				aan het artikel dat ze wijzigt, invoert of intrekt.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Afgeleide gegevens</h2>
			<p>
				Een paar gegevens leidt Concordans zelf uit de tekst af, waar de API ze niet meegeeft. Het
				lid dat een verwijzing noemt, volgt uit de tekst van de verwijzing. De leden en onderdelen
				van een artikel volgen uit de regelindeling. De passage van een memorie van toelichting bij
				een artikel komt van de API; zonder die passage zoekt Concordans naar "Artikel N". Een
				afleiding vervalt zodra de API het gegeven zelf levert.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Toelichting bij een artikel</h2>
			<p>
				Een memorie of nota van toelichting staat alleen bij een artikel als de API bevestigt dat de
				toelichting dat artikel zelf noemt, of het een directe verbinding met het artikel draagt
				(licht toe, wijzigt, voegt toe). Een toelichting bij het dossier zonder die bevestiging
				staat niet bij het artikel.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Betrouwbaarheid</h2>
			<p>
				Elke niet-structurele verbinding draagt een score tussen 0 en 1. Een score van 1 is
				rechtstreeks uit de brontekst gelezen, lager is afgeleid. Het netwerk toont semantische
				verbindingen boven een vaste drempel. Status is vastgesteld of voorgesteld: een wijziging
				uit een wetsvoorstel dat nog niet is aangenomen staat als voorgesteld.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Grenzen</h2>
			<p>
				Detectoren herkennen patronen, ze begrijpen de tekst niet. Een ongebruikelijke formulering
				wordt gemist of aan de verkeerde bron gelegd. Dekking per bron staat bij de <a
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

	code {
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
		line-height: 1.5;
		color: var(--ink);
		border-top: 1px solid var(--rule);
	}

	.list-row:first-child {
		border-top: 0;
	}

	.list-k {
		flex: none;
		width: 8em;
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

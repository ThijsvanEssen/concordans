<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
</script>

<RouteKop pad="/docs/methode" />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/docs">Documentatie</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Methode</h1></header>
		<p class="stub-lede">
			Concordans haalt elke bron op bij de officiële uitgever en legt de verbindingen ertussen vast.
			Een verbinding komt uit de gegevens van de bron zelf, zoals een artikel en zijn wet of een
			Kamerlid en zijn fractie, of uit een verwijzing in de tekst. Welke bronnen dat zijn en wat
			ermee mag, staat bij
			<a href="/bronnen" class="cite">Bronnen en hergebruik</a>.
		</p>

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

		<div class="section" id="grenzen">
			<h2 class="section-title">Grenzen</h2>
			<p>
				De patronen begrijpen de tekst niet. Een ongebruikelijke formulering wordt gemist of aan de
				verkeerde bron gelegd.
			</p>
			<p>
				Het netwerk bevat een selectie: niet elke regeling uit het Basiswettenbestand, niet alle
				uitspraken van rechtspraak.nl, niet het volledige archief van de Kamers. Gemeentelijke
				verordeningen en ongepubliceerde uitspraken vallen erbuiten. Een bron die ontbreekt, staat
				niet in deze selectie; dat is geen bewijs dat ze niet bestaat.
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
				Van de Eerste Kamer staan leden, fracties en commissies erin in hun huidige samenstelling,
				zonder eerdere, en besluiten over wetsvoorstellen vanaf juli 2026.
			</p>
			<p>
				Elke bron wordt afzonderlijk opgehaald; de stand per bron staat bij
				<a href="/bronnen#dekking" class="cite">Bronnen en hergebruik</a>. De geldigheidsdatum van
				een artikel is de datum van inwerkingtreding, niet die van het ophalen.
			</p>
			<p>
				Concordans is in ontwikkeling. Functies en weergave kunnen wijzigen. Een adres op ECLI,
				BWB-id of officieel nummer blijft werken.
			</p>
		</div>

		<div class="meta-row">
			<a href="/docs" class="meta-link">Documentatie</a>
			<a href="/api" class="meta-link">API-referentie</a>
			<a href="/bronnen" class="meta-link">Bronnen en hergebruik</a>
		</div>
	</div>
</div>

<style>
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
		font-family: var(--font-serif);
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

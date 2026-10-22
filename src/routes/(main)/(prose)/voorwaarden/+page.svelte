<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { CONTACT_EMAIL } from '$lib/site/contact';
	import { BUNDLES_PATH } from '$lib/map/page';

	const reportHref = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Fout in Concordans')}`;
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/over">Over Concordans</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Gebruiksvoorwaarden</h1></header>
		<p class="stub-lede">Wie Concordans gebruikt, aanvaardt deze voorwaarden.</p>

		<div class="section">
			<h2 class="section-title">Geen juridisch advies</h2>
			<p>
				Concordans ondersteunt juridisch onderzoek en geeft geen juridisch advies. Een deel van de
				verbindingen leest Concordans zelf uit de tekst, op nummer of op naam; zo'n verbinding kan
				onjuist zijn. Aan de weergaven en verbindingen kunnen geen rechten worden ontleend.
				Raadpleeg voor een juridische beslissing de officiële bron en een bevoegde jurist.
			</p>
		</div>

		<div class="section" id="garanties">
			<h2 class="section-title">Geen garanties</h2>
			<p>
				Concordans geeft geen garantie dat de gegevens volledig, juist of bij de tijd zijn, en geen
				garantie dat de site bereikbaar is. Concordans kan worden gewijzigd, opgeschort of beëindigd
				zonder voorafgaande kennisgeving.
			</p>
		</div>

		<div class="section" id="back-ups">
			<h2 class="section-title">Geen back-ups</h2>
			<p>
				Bundels, aantekeningen en gevolgde onderwerpen staan alleen in de browser waarin ze zijn
				gemaakt. Concordans maakt er geen back-up van: wie de gegevens van de browser wist, is ze
				kwijt. Wat moet blijven, gaat als bestand mee: <a href={BUNDLES_PATH} class="cite"
					>Alle bundels downloaden</a
				>. Van de gegevens op de server maakt Concordans evenmin back-ups; na verlies worden ze
				opnieuw uit de officiële bronnen opgebouwd.
			</p>
		</div>

		<div class="section" id="fouten">
			<h2 class="section-title">Fouten melden</h2>
			<p>
				Een fout in een tekst, een verbinding, een datum of een stand gaat naar
				<a href={reportHref} class="cite">{CONTACT_EMAIL}</a>, met het adres van de pagina.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Hergebruik en API</h2>
			<p>
				Wat geldt voor hergebruik van de bronteksten en van wat Concordans toevoegt, staat bij
				<a href="/bronnen#hergebruik" class="cite">Bronnen en hergebruik</a>. Wat geldt voor de API,
				staat bij de <a href="/api" class="cite">API</a>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Aansprakelijkheid</h2>
			<p>
				Aansprakelijkheid voor schade door het gebruik van Concordans of van de informatie erin is
				uitgesloten, voor zover de wet dat toelaat.
			</p>
		</div>

		<div class="updated">Laatste wijziging: oktober 2026</div>
	</div>
</div>

<style>
	p {
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
	}
</style>

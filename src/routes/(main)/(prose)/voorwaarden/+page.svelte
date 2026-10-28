<script lang="ts">
	import Sectie from '$lib/components/ui/Sectie.svelte';
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

		<Sectie title="Geen juridisch advies" niveau={2} inklapbaar={false}>
			<p>
				Concordans ondersteunt juridisch onderzoek en geeft geen juridisch advies. Een deel van de
				verbindingen leest Concordans zelf uit de tekst, op nummer of op naam; zo'n verbinding kan
				onjuist zijn. Aan de weergaven en verbindingen kunnen geen rechten worden ontleend.
				Raadpleeg voor een juridische beslissing de officiële bron en een bevoegde jurist.
			</p>
		</Sectie>

		<Sectie title="Geen garanties" niveau={2} inklapbaar={false} id="garanties">
			<p>
				Concordans geeft geen garantie dat de gegevens volledig, juist of bij de tijd zijn, en geen
				garantie dat de site bereikbaar is. Concordans kan worden gewijzigd, opgeschort of beëindigd
				zonder voorafgaande kennisgeving.
			</p>
		</Sectie>

		<Sectie title="Geen back-ups" niveau={2} inklapbaar={false} id="back-ups">
			<p>
				Bundels, aantekeningen en gevolgde onderwerpen staan alleen in de browser waarin ze zijn
				gemaakt. Concordans maakt er geen back-up van: wie de gegevens van de browser wist, is ze
				kwijt. Wat moet blijven, gaat als bestand mee: <a href={BUNDLES_PATH} class="cite"
					>Exporteer alle bundels</a
				>. Van de gegevens op de server maakt Concordans evenmin back-ups; na verlies worden ze
				opnieuw uit de officiële bronnen opgebouwd.
			</p>
		</Sectie>

		<Sectie title="Fouten melden" niveau={2} inklapbaar={false} id="fouten">
			<p>
				Een fout in een tekst, een verbinding, een datum of een stand gaat naar
				<a href={reportHref} class="cite">{CONTACT_EMAIL}</a>, met het adres van de pagina.
			</p>
		</Sectie>

		<Sectie title="Hergebruik en API" niveau={2} inklapbaar={false}>
			<p>
				Wat geldt voor hergebruik van de bronteksten en van wat Concordans toevoegt, staat bij
				<a href="/bronnen#hergebruik" class="cite">Bronnen en hergebruik</a>. Wat geldt voor de API,
				staat bij de <a href="/api" class="cite">API</a>.
			</p>
		</Sectie>

		<Sectie title="Aansprakelijkheid" niveau={2} inklapbaar={false}>
			<p>
				Aansprakelijkheid voor schade door het gebruik van Concordans of van de informatie erin is
				uitgesloten, voor zover de wet dat toelaat.
			</p>
		</Sectie>

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

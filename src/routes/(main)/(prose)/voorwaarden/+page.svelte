<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
</script>

<RouteKop pad="/voorwaarden" />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<div class="stub-eyebrow">Over Concordans</div>
		<header class="blad__kop"><h1 class="blad__titel">Gebruiksvoorwaarden</h1></header>
		<p class="stub-lede">
			Gebruik van Concordans impliceert instemming met onderstaande voorwaarden.
		</p>

		<div class="section">
			<h2 class="section-title">Geen juridisch advies</h2>
			<p>
				Concordans ondersteunt juridisch onderzoek en geeft geen juridisch advies. Verbindingen
				worden deels machinaal afgeleid en kunnen onjuist zijn. Aan de weergaven en verbindingen
				kunnen geen rechten worden ontleend. Raadpleeg voor een juridische beslissing de officiële
				bron en een bevoegde jurist.
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
			<h2 class="section-title">Beschikbaarheid</h2>
			<p>
				Concordans wordt aangeboden zonder garantie van ononderbroken beschikbaarheid. De
				werkomgeving kan worden gewijzigd, opgeschort of beëindigd zonder voorafgaande kennisgeving.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Aansprakelijkheidsbeperking</h2>
			<p>
				De maker van Concordans aanvaardt geen aansprakelijkheid voor schade die voortvloeit uit het
				gebruik van de applicatie of de daarin opgenomen informatie.
			</p>
		</div>

		<div class="updated">Laatste wijziging: oktober 2026</div>
	</div>
</div>

<style>
	p {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
	}
</style>

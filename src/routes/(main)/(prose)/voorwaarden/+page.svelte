<script lang="ts">
</script>

<svelte:head>
	<title>Gebruiksvoorwaarden, Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Juridisch</div>
		<h1 class="stub-title">Gebruiksvoorwaarden</h1>
		<p class="stub-lede">
			Gebruik van Concordans impliceert instemming met onderstaande voorwaarden.
		</p>

		<div class="section">
			<h2 class="section-title">Geen juridisch advies</h2>
			<p>
				Concordans ondersteunt juridisch onderzoek en geeft geen juridisch advies. Verbindingen
				worden deels machinaal afgeleid en kunnen onjuist zijn. Raadpleeg voor een juridische
				beslissing de officiële bron en een bevoegde jurist.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Hergebruik</h2>
			<p>
				Wetteksten, uitspraken en parlementaire stukken komen van overheidsbronnen en zijn vrij te
				hergebruiken. Voor teksten uit EUR-Lex en HUDOC gelden de voorwaarden van die bronnen.
			</p>
			<p>
				Wat Concordans toevoegt, zoals de verbindingen en de uitvoer van de API, is vrij te
				hergebruiken onder <a
					href="https://creativecommons.org/publicdomain/zero/1.0/deed.nl"
					class="cite">CC0 1.0</a
				>. Bronvermelding is welkom, niet verplicht.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">API</h2>
			<p>
				De <a href="/api" class="cite">API</a> is vrij te gebruiken, zonder sleutel. Het aantal
				verzoeken per minuut per IP-adres is begrensd; daarboven volgt 429. Voor grootschalig
				gebruik:
				<a href="/contact" class="cite">contact</a>.
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
	.page-wrap {
		padding: 80px 0 120px;
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
		margin-bottom: 36px;
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
		margin: 0;
	}

	.updated {
		margin-top: var(--s-7);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

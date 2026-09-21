<script lang="ts">
</script>

<svelte:head>
	<title>Colofon. Concordans.</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">OVER CONCORDANS</div>
		<h1 class="stub-title">Colofon</h1>
		<p class="stub-lede">
			Concordans is een onafhankelijk onderzoeksproject naar de structuur van het Nederlandse recht.
		</p>

		<div class="section">
			<h2 class="section-title">Maker</h2>
			<p>
				Concordans is ontwikkeld als persoonlijk onderzoeksproject. Het project is niet gelieerd aan
				enige juridische instelling, rechtbank of overheidsorgaan.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Bronnen</h2>
			<p>
				De weergegeven wetteksten zijn afkomstig van <a
					href="https://wetten.overheid.nl"
					class="cite">wetten.overheid.nl</a
				>
				en vallen onder de
				<a href="https://creativecommons.org/publicdomain/zero/1.0/" class="cite">CC0-licentie</a>
				van de Nederlandse overheid. Rechterlijke uitspraken zijn afkomstig van
				<a href="https://www.rechtspraak.nl/uitspraken" class="cite">uitspraken.rechtspraak.nl</a>
				en, voor het EHRM, van HUDOC. Parlementaire gegevens komen uit het gegevensmagazijn van de Tweede
				Kamer. Kamerstukken van de Eerste Kamer, het Staatsblad en de Staatscourant komen uit de repository
				van KOOP (repository.overheid.nl). Europese regelgeving komt uit EUR-Lex en verdragen komen uit
				de Verdragenbank.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Technologie</h2>
			<p>
				De applicatie is gebouwd met SvelteKit. Het netwerk staat in een ArangoDB-database achter
				een FastAPI-service (LawGraph). Die service leest, behalve voor het volgen van bronnen en
				het beoordelen van verbindingen. Geen commerciële tracking, geen advertentiediensten.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Aansprakelijkheid</h2>
			<p>
				Concordans is bedoeld als hulpmiddel bij juridisch onderzoek, niet als juridisch advies. Aan
				de weergaven en verbindingen kunnen geen rechten worden ontleend. Zie ook de <a
					href="/voorwaarden"
					class="cite">gebruiksvoorwaarden</a
				>.
			</p>
		</div>

		<div class="meta-row">
			<a href="/privacy" class="meta-link">Privacyverklaring</a>
			<a href="/voorwaarden" class="meta-link">Gebruiksvoorwaarden</a>
			<a href="/contact" class="meta-link">Contact</a>
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
		font-size: 11px;
		letter-spacing: 0.1em;
		color: var(--fg-3);
		margin-bottom: 16px;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: clamp(28px, 5vw, 40px);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 16px;
	}

	.stub-lede {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.65;
		color: var(--fg-2);
		margin-bottom: 48px;
	}

	.section {
		margin-bottom: 36px;
	}

	.section-title {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 12px;
	}

	p {
		font-family: var(--font-sans);
		font-size: 14px;
		line-height: 1.7;
		color: var(--fg-1);
		margin: 0;
	}

	.cite {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid var(--accent);
	}

	.cite:hover {
		opacity: 0.8;
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
		font-size: 13px;
		color: var(--fg-3);
		text-decoration: none;
		border-bottom: none;
	}

	.meta-link:hover {
		color: var(--ink);
		border-bottom: none;
	}
</style>

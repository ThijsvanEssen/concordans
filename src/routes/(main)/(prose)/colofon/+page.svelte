<script lang="ts">
</script>

<svelte:head>
	<title>Colofon, Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Over Concordans</div>
		<h1 class="stub-title">Colofon</h1>
		<p class="stub-lede">
			Concordans is een onafhankelijk onderzoeksproject naar de structuur van het Nederlandse recht.
		</p>

		<div class="section">
			<h2 class="section-title">Maker</h2>
			<p>
				Het project is niet gelieerd aan een juridische instelling, rechtbank of overheidsorgaan.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Bronnen</h2>
			<p>
				Wetteksten komen van <a href="https://wetten.overheid.nl" class="cite">wetten.overheid.nl</a
				>, onder de
				<a href="https://creativecommons.org/publicdomain/zero/1.0/deed.nl" class="cite"
					>CC0-licentie</a
				>
				van de Nederlandse overheid. Uitspraken komen van
				<a href="https://www.rechtspraak.nl/uitspraken" class="cite">rechtspraak.nl</a>, die van het
				EHRM van HUDOC. Parlementaire gegevens komen uit het gegevensmagazijn van de Tweede Kamer en
				van <a href="https://www.eerstekamer.nl" class="cite">eerstekamer.nl</a>. Staatsblad,
				Staatscourant en Tractatenblad komen uit de repository van KOOP. Kabinetten en
				bewindspersonen komen van
				<a href="https://www.rijksoverheid.nl/regering" class="cite">rijksoverheid.nl</a>, eveneens
				onder CC0. Europese regelgeving en uitspraken van het Hof van Justitie komen uit EUR-Lex,
				verdragen uit de Verdragenbank, ministeries en rechtsgebieden uit de TOOI-waardelijsten. De
				herkomst per bron staat in de <a href="/docs/methode" class="cite">methode</a>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Technologie</h2>
			<p>
				De applicatie is gebouwd met SvelteKit. Het netwerk staat in een database achter een
				FastAPI-service (LawGraph). Concordans leest alleen uit die service.
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
		margin: 0;
	}

	.cite {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
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
</style>

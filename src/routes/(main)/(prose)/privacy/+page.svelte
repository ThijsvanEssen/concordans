<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
</script>

<RouteKop pad="/privacy" />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<div class="stub-eyebrow">Over Concordans</div>
		<h1 class="stub-title">Privacyverklaring</h1>
		<p class="stub-lede">
			Concordans verwerkt zo min mogelijk persoonsgegevens. Deze pagina zegt welke en waarom.
		</p>

		<div class="section">
			<h2 class="section-title">Wat wordt verwerkt</h2>
			<p>
				Concordans heeft geen accounts en plaatst geen cookies. Wie via de <a
					href="/over#contact"
					class="cite">contactpagina</a
				> een e-mail stuurt, deelt het e-mailadres en de inhoud van het bericht. Een advertentie op Concordans
				is nooit afgestemd op wie de pagina bekijkt.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Serverlogbestanden</h2>
			<p>
				De API registreert bij elk verzoek het IP-adres, het tijdstip en het opgevraagde adres,
				inclusief zoektermen. Die gegevens dienen voor technisch beheer, beveiliging en de grens aan
				het aantal verzoeken per IP-adres. Dit logboek wordt na 30 dagen verwijderd. De webserver
				van de site zelf houdt geen bezoeken bij.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Opslag in de browser</h2>
			<p>
				Concordans bewaart enkele weergave-instellingen in de opslag van de browser: de breedte van
				de panelen, het laatst samengestelde netwerk en of de legenda open staat. Ook de gevolgde
				onderwerpen staan daar, met de dag van het vorige bezoek. Die blijven in de browser en gaan
				niet naar een server. Om nieuwe stukken bij een onderwerp te vinden, gaan de woorden als
				zoekterm naar de API.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Contact</h2>
			<p>
				Vragen over de verwerking van persoonsgegevens gaan via de <a
					href="/over#contact"
					class="cite">contactpagina</a
				>.
			</p>
		</div>

		<div class="updated">Laatste wijziging: oktober 2026</div>
	</div>
</div>

<style>
	.stub-eyebrow {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		margin-bottom: var(--s-4);
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
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
		font-weight: 800;
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

	.updated {
		margin-top: var(--s-7);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

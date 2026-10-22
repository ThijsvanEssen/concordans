<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { CONTACT_EMAIL, MAKER } from '$lib/site/contact';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/over">Over Concordans</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Privacyverklaring</h1></header>
		<p class="stub-lede">
			Concordans verwerkt zo min mogelijk persoonsgegevens. Deze pagina zegt welke en waarom.
		</p>

		<div class="section">
			<h2 class="section-title">Verwerkingsverantwoordelijke</h2>
			<p>
				{MAKER}, de maker van Concordans. Vragen over de verwerking van persoonsgegevens gaan naar
				<a href="mailto:{CONTACT_EMAIL}" class="cite">{CONTACT_EMAIL}</a>.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Wat wordt verwerkt</h2>
			<p>
				Concordans heeft geen accounts, plaatst geen cookies en gebruikt geen externe diensten voor
				statistiek. Wie Concordans een e-mail stuurt, deelt het e-mailadres en de inhoud van het
				bericht.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Serverlogbestanden</h2>
			<p>
				De server houdt per verzoek een ingekort IP-adres, het tijdstip en het opgevraagde adres
				zonder zoektermen bij, voor beheer en beveiliging. Dit logboek wordt na hoogstens 30 dagen
				verwijderd. Zoektermen worden alleen per dag geteld, zonder te bewaren wie zocht.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Opslag in de browser</h2>
			<p>
				Concordans bewaart enkele weergave-instellingen in de opslag van de browser: de breedte van
				de panelen, het laatst samengestelde netwerk en of de legenda open staat. Ook de gevolgde
				onderwerpen staan daar, met de dag van het vorige bezoek, en de bundels met hun
				aantekeningen. Die blijven in de browser en gaan niet naar een server. Concordans vraagt de
				browser die opslag niet zelf te wissen. Een bundel als bestand of als link maakt u zelf, net
				als een link naar de gevolgde onderwerpen; zo'n link draagt de bundel of de onderwerpen in
				het deel na het hekje, dat de browser niet meestuurt. Om nieuwe stukken bij een onderwerp te
				vinden, gaan de woorden als zoekterm naar de API; voor wat er nieuw is bij een bundel gaan
				de wetten, dossiers en artikelen erin als vraag naar de API, zonder de aantekeningen.
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

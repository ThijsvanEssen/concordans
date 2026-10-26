<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { CONTACT_EMAIL } from '$lib/site/contact';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/over">Over Concordans</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Privacyverklaring</h1></header>
		<p class="stub-lede">Concordans verwerkt zo min mogelijk persoonsgegevens.</p>

		<div class="section">
			<h2 class="section-title">Verwerkingsverantwoordelijke</h2>
			<p>
				Concordans. Vragen over de verwerking van persoonsgegevens gaan naar
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

		<div class="section" id="browser">
			<h2 class="section-title">In de browser</h2>
			<ul>
				<li>
					De breedte van de panelen, het laatst samengestelde netwerk en of de legenda open staat.
				</li>
				<li>De gevolgde onderwerpen, met de dag van het vorige bezoek.</li>
				<li>De bundels, met hun aantekeningen.</li>
			</ul>
			<p>
				Dit blijft in de browser en gaat niet naar een server. Er is geen back-up van; zie
				<a href="/voorwaarden#back-ups" class="cite">Geen back-ups</a>.
			</p>
		</div>

		<div class="section" id="server">
			<h2 class="section-title">Naar de server</h2>
			<ul>
				<li>De woorden van een gevolgd onderwerp, als zoekterm voor nieuwe stukken.</li>
				<li>
					De wetten, dossiers en artikelen van een bundel, om te zien wat er nieuw is; de
					aantekeningen niet.
				</li>
			</ul>
		</div>

		<div class="section" id="delen">
			<h2 class="section-title">Delen</h2>
			<p>
				Een bundel of de gevolgde onderwerpen gaan mee als bestand of als link. Een link draagt ze
				in het deel na het hekje, dat de browser niet naar de server stuurt. Een oudere link met ze
				achter het vraagteken wordt bij het openen omgezet; die ene keer ziet de server ze wel.
			</p>
		</div>

		<div class="updated">Laatste wijziging: oktober 2026</div>
	</div>
</div>

<style>
	p,
	li {
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		margin: 0;
	}
	ul {
		margin: 0 0 var(--s-3);
		padding-left: var(--s-5);
	}
</style>

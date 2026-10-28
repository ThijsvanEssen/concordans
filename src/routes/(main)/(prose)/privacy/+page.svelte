<script lang="ts">
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { CONTACT_EMAIL } from '$lib/site/contact';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<nav class="stub-eyebrow" aria-label="Hoort bij"><a href="/over">Over Concordans</a></nav>
		<header class="blad__kop"><h1 class="blad__titel">Privacyverklaring</h1></header>
		<p class="stub-lede">Concordans verwerkt zo min mogelijk persoonsgegevens.</p>

		<Sectie title="Verwerkingsverantwoordelijke" niveau={2} inklapbaar={false}>
			<p>
				Concordans. Vragen over de verwerking van persoonsgegevens gaan naar
				<a href="mailto:{CONTACT_EMAIL}" class="cite">{CONTACT_EMAIL}</a>.
			</p>
		</Sectie>

		<Sectie title="Wat wordt verwerkt" niveau={2} inklapbaar={false}>
			<p>
				Concordans heeft geen accounts, plaatst geen cookies en gebruikt geen externe diensten voor
				statistiek. Wie Concordans een e-mail stuurt, deelt het e-mailadres en de inhoud van het
				bericht.
			</p>
		</Sectie>

		<Sectie title="Serverlogbestanden" niveau={2} inklapbaar={false}>
			<p>
				De server houdt per verzoek een ingekort IP-adres, het tijdstip en het opgevraagde adres
				zonder zoektermen bij, voor beheer en beveiliging. Dit logboek wordt na hoogstens 30 dagen
				verwijderd. Zoektermen worden alleen per dag geteld, zonder te bewaren wie zocht.
			</p>
		</Sectie>

		<Sectie title="In de browser" niveau={2} inklapbaar={false} id="browser">
			<ul>
				<li>
					De breedte van de panelen, het laatst samengestelde netwerk en of de legenda open staat.
				</li>
				<li>De gevolgde onderwerpen, met de dag van het vorige bezoek.</li>
				<li>De bundels, met hun aantekeningen.</li>
				<li>
					Per sessie: of de melding bij de eerste Bewaar al is getoond. Dit verdwijnt als het
					tabblad sluit.
				</li>
			</ul>
			<p>
				Dit blijft in de browser en gaat niet naar een server. Er is geen back-up van; zie
				<a href="/voorwaarden#back-ups" class="cite">Geen back-ups</a>.
			</p>
		</Sectie>

		<Sectie title="Naar de server" niveau={2} inklapbaar={false} id="server">
			<ul>
				<li>De woorden van een gevolgd onderwerp, als zoekterm voor nieuwe stukken.</li>
				<li>
					De wetten, dossiers en artikelen van een bundel, om te zien wat er nieuw is; de
					aantekeningen niet.
				</li>
			</ul>
		</Sectie>

		<Sectie title="Delen" niveau={2} inklapbaar={false} id="delen">
			<p>
				Een bundel of de gevolgde onderwerpen gaan mee als bestand of als link. Een link draagt ze
				in het deel na het hekje, dat de browser niet naar de server stuurt. Een oudere link met ze
				achter het vraagteken wordt bij het openen omgezet; die ene keer ziet de server ze wel.
			</p>
		</Sectie>

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

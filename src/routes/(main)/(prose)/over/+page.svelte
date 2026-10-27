<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
	import { CONTACT_EMAIL } from '$lib/site/contact';
</script>

<RouteKop />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<header class="blad__kop"><h1 class="blad__titel">Over Concordans</h1></header>
		<p class="stub-lede">Het artikel, en de uitspraken en Kamerstukken die ernaar verwijzen.</p>

		<div class="section">
			<h2 class="section-title">De naam</h2>
			<p>
				Concordans komt van concordantie: een register van de woorden uit een werk, met de plaatsen
				waar ze voorkomen (<a
					href="https://www.ensie.nl/oosthoek/concordantie-konkordantie"
					target="_blank"
					rel="external noopener"
					class="cite">Oosthoek Encyclopedie</a
				>).
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Zelfstandig</h2>
			<p>
				Concordans is niet gelieerd aan een juridische instelling, rechtbank of overheidsorgaan.
			</p>
		</div>

		<div class="section" id="contact">
			<h2 class="section-title">Contact</h2>
			<p>
				Vragen, opmerkingen, verzoeken voor grootschalig gebruik van de API en vragen over privacy
				gaan naar <a href="mailto:{CONTACT_EMAIL}" class="cite">{CONTACT_EMAIL}</a>.
			</p>
		</div>

		<div class="meta-row">
			<a href="/bronnen" class="meta-link">Bronnen en hergebruik</a>
			<a href="/voorwaarden" class="meta-link">Voorwaarden</a>
			<a href="/privacy" class="meta-link">Privacy</a>
		</div>
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

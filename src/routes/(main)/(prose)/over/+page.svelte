<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
</script>

<RouteKop pad="/over" />

<div class="page-wrap">
	<div class="container blad blad--tekst">
		<header class="blad__kop"><h1 class="blad__titel">Over Concordans</h1></header>
		<p class="stub-lede">
			Concordans is een onafhankelijk onderzoeksproject naar de structuur van het Nederlandse recht.
		</p>

		<div class="section">
			<h2 class="section-title">Maker</h2>
			<p>
				Het project is niet gelieerd aan een juridische instelling, rechtbank of overheidsorgaan.
			</p>
		</div>

		<div class="section" id="contact">
			<h2 class="section-title">Contact</h2>
			<p>
				Vragen, opmerkingen, verzoeken voor grootschalig gebruik van de API en vragen over privacy
				gaan naar <a href="mailto:concordans@tmve.nl" class="cite">concordans@tmve.nl</a>.
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

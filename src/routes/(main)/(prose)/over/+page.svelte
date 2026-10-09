<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
</script>

<RouteKop pad="/over" />

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Over Concordans</div>
		<h1 class="stub-title">Over Concordans</h1>
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

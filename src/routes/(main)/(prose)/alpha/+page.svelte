<script lang="ts">
</script>

<svelte:head>
	<title>Alpha. Concordans.</title>
	<meta
		name="description"
		content="Concordans is in alpha. Wat dat betekent voor de inhoud, de functies en de betrouwbaarheid van wat op het scherm staat."
	/>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="alpha-eyebrow">Status</div>
		<h1 class="alpha-title">Concordans is in alpha</h1>
		<p class="alpha-lede">
			Werkomgeving in opbouw. Functies, weergaven en URL-structuur kunnen wijzigen zonder
			aankondiging. De onderliggende bronnen blijven de officiële.
		</p>

		<div class="alpha-badge-row">
			<span class="alpha-badge">alpha</span>
			<span class="alpha-badge-note"
				>Concordans toont dit label rechtsboven naast het woordmerk.</span
			>
		</div>

		<section class="alpha-section">
			<h2>Wat alpha hier betekent</h2>
			<p>Concordans is gebruiksklaar maar nog niet stabiel. Drie dingen volgen daaruit.</p>
			<dl class="alpha-list">
				<dt>Functies kunnen wijzigen.</dt>
				<dd>
					Weergaven, sneltoetsen, filters en URL-parameters kunnen tussen versies veranderen.
					Bewaarde links blijven werken zolang de onderliggende bron (BWB-id, ECLI, dossiernummer)
					bestaat.
				</dd>
				<dt>De dekking is niet volledig.</dt>
				<dd>
					Het netwerk groeit met de officiële bronnen mee, maar niet elke regeling, uitspraak of
					dossier zit er al in. Wat ontbreekt, is geen uitspraak van Concordans over relevantie,
					alleen een gevolg van de huidige belading. Het aantal bronnen en verbindingen staat onder
					<a href="/#cijfers">Concordans in cijfers</a>.
				</dd>
				<dt>Verbanden zijn machinaal afgeleid.</dt>
				<dd>
					Citaties en wijzigingen komen uit een reproduceerbare extractie op de bronteksten en de
					structuur van de bronnen. Elke verbinding draagt haar herkomst, betrouwbaarheid en het
					tekstfragment waaruit ze volgt. De heuristieken staan in de
					<a href="/docs/methode">methode-bijlage</a>.
				</dd>
			</dl>
		</section>

		<section class="alpha-section">
			<h2>Wat alpha niet betekent</h2>
			<p>
				Concordans is geen losse demo en geen voorpublicatie. De getallen op deze pagina komen uit
				het levende netwerk; de Verkenner werkt op dezelfde gegevens als de officiële bronnen.
			</p>
			<ul class="alpha-bullets">
				<li>
					Een ontbrekend artikel of arrest betekent niet dat het juridisch irrelevant is. Het
					betekent dat Concordans het nog niet binnenhaalt.
				</li>
				<li>
					Een aanwezig verband betekent niet dat het juridisch geldig is. Het betekent dat de bron
					zelf de verwijzing maakt. Concordans laat zien wat er staat, niet wat het juridisch waard
					is.
				</li>
				<li>Concordans vervangt geen juridische analyse en geeft geen advies.</li>
			</ul>
		</section>

		<section class="alpha-section">
			<h2>Toegang en stabiliteit</h2>
			<p>
				Alpha-toegang is open. Voor wie wil meelezen of voor wie iets niet klopt: meld het kort via
				<a href="mailto:concordans@tmve.nl">concordans@tmve.nl</a>
				of via de
				<a href="/contact">contactpagina</a>. Reproduceerbare voorbeelden (URL + verwachte uitkomst)
				hebben de hoogste kans op een snelle reactie.
			</p>
		</section>

		<div class="alpha-foot">
			<a href="/" class="alpha-foot-link">← Terug naar Concordans</a>
			<a href="/docs/methode" class="alpha-foot-cta">
				Lees de methode-bijlage <span aria-hidden="true">→</span>
			</a>
		</div>
	</div>
</div>

<style>
	.page-wrap {
		padding: 80px 0 120px;
	}

	.container {
		max-width: 680px;
		margin: 0 auto;
		padding: 0 var(--s-5);
	}

	.alpha-eyebrow {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: var(--s-4);
	}

	.alpha-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		line-height: var(--lh-tight);
		color: var(--ink);
		margin: 0 0 20px;
	}

	.alpha-lede {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin: 0 0 36px;
		max-width: 56ch;
	}

	.alpha-badge-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3) 18px;
		align-items: baseline;
		padding: 14px var(--s-4);
		background: var(--paper-2);
		margin: 0 0 40px;
	}

	.alpha-badge {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.alpha-badge-note {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		line-height: 1.4;
	}

	.alpha-section {
		margin: 0 0 40px;
	}

	.alpha-section h2 {
		font-family: var(--font-serif);
		font-size: var(--t-h2);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 var(--s-3);
		border-top: 1px solid var(--rule);
		padding-top: var(--s-5);
	}

	.alpha-section p {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin: 0 0 var(--s-4);
		max-width: 56ch;
	}

	.alpha-section a {
		text-decoration: underline;
		text-decoration-color: var(--rule-strong);
	}

	.alpha-list {
		margin: var(--s-4) 0 0;
		display: grid;
		gap: var(--s-4);
	}

	.alpha-list dt {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 500;
		color: var(--ink);
		margin-bottom: var(--s-1);
	}

	.alpha-list dd {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		max-width: 60ch;
	}

	.alpha-bullets {
		margin: var(--s-3) 0 0;
		padding-left: 20px;
		display: grid;
		gap: 10px;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
	}

	.alpha-bullets li {
		max-width: 60ch;
	}

	.alpha-foot {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: var(--s-4) var(--s-6);
		margin-top: 56px;
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}

	.alpha-foot-link {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		text-decoration: none;
		transition: color var(--dur-1) var(--ease);
	}

	.alpha-foot-link:hover {
		color: var(--ink);
	}

	.alpha-foot-cta {
		display: inline-flex;
		align-items: center;
		gap: var(--s-2);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		border: 1px solid var(--rule-strong);
		padding: 6px var(--s-3);
		border-radius: var(--r-1);
		text-decoration: none;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.alpha-foot-cta:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
</style>

<script lang="ts">
</script>

<svelte:head>
	<title>Privacyverklaring. Concordans.</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">Juridisch</div>
		<h1 class="stub-title">Privacyverklaring</h1>
		<p class="stub-lede">
			Concordans verwerkt zo min mogelijk persoonsgegevens. Deze pagina beschrijft welke gegevens
			worden verwerkt en waarom.
		</p>

		<div class="section">
			<h2 class="section-title">Wat wordt verwerkt</h2>
			<p>
				Concordans verwerkt geen persoonsgegevens van bezoekers, tenzij per e-mail via de
				contactpagina gegevens worden achtergelaten. Er zijn geen gebruikersaccounts en geen
				inlogfunctie. Er worden geen tracking- of advertentiecookies geplaatst.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Serverlogbestanden</h2>
			<p>
				De webserver registreert standaard technische gegevens: IP-adres, tijdstip van toegang en
				het opgevraagde pad. Deze logbestanden worden maximaal dertig dagen bewaard en uitsluitend
				gebruikt voor technisch beheer en beveiliging.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Cookies</h2>
			<p>
				Concordans gebruikt uitsluitend functionele cookies die noodzakelijk zijn voor de werking
				van de applicatie, zoals de weergavevoorkeur. Er worden geen analytische of marketingcookies
				gebruikt.
			</p>
		</div>

		<div class="section">
			<h2 class="section-title">Contact</h2>
			<p>
				Vragen over de verwerking van persoonsgegevens gaan via de <a href="/contact" class="cite"
					>contactpagina</a
				>.
			</p>
		</div>

		<div class="updated">Laatste wijziging: mei 2026</div>
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
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: 16px;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 500;
		line-height: var(--lh-tight);
		color: var(--ink);
		margin: 0 0 16px;
	}

	.stub-lede {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin-bottom: 48px;
	}

	.section {
		margin-bottom: 36px;
	}

	.section-title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 12px;
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
		margin-top: 48px;
		padding-top: 24px;
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

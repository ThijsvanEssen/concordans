<script lang="ts">
</script>

<svelte:head>
	<title>Privacyverklaring. Concordans.</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow">JURIDISCH</div>
		<h1 class="stub-title">Privacyverklaring</h1>
		<p class="stub-lede">
			Concordans verwerkt zo min mogelijk persoonsgegevens. Deze pagina beschrijft welke gegevens
			worden verwerkt en waarom.
		</p>

		<div class="section">
			<h2 class="section-title">Wat wordt verwerkt</h2>
			<p>
				Concordans verwerkt geen persoonsgegevens van bezoekers, tenzij langs het contactformulier
				gegevens worden achtergelaten. Er zijn geen gebruikersaccounts en geen inlogfunctie. Er
				worden geen tracking- of advertentiecookies geplaatst.
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
				Vragen over de verwerking van persoonsgegevens gaan via het <a href="/contact" class="cite"
					>contactformulier</a
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
		font-size: 11px;
		letter-spacing: 0.1em;
		color: var(--fg-3);
		margin-bottom: 16px;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: clamp(28px, 5vw, 40px);
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 16px;
	}

	.stub-lede {
		font-family: var(--font-sans);
		font-size: 15px;
		line-height: 1.65;
		color: var(--fg-2);
		margin-bottom: 48px;
	}

	.section {
		margin-bottom: 36px;
	}

	.section-title {
		font-family: var(--font-serif);
		font-size: 18px;
		font-weight: 500;
		color: var(--ink);
		margin: 0 0 12px;
	}

	p {
		font-family: var(--font-sans);
		font-size: 14px;
		line-height: 1.7;
		color: var(--fg-1);
		margin: 0;
	}

	.cite {
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid var(--accent);
	}

	.cite:hover {
		opacity: 0.8;
	}

	.updated {
		margin-top: 48px;
		padding-top: 24px;
		border-top: 1px solid var(--rule);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
	}
</style>

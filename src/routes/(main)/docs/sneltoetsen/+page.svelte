<script lang="ts">
	import RouteKop from '$lib/seo/RouteKop.svelte';
</script>

<RouteKop pad="/docs/sneltoetsen" />

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow"><a href="/docs">Documentatie</a>, Sneltoetsen</div>
		<h1 class="stub-title">Sneltoetsen</h1>
		<div class="shortcut-table">
			<div class="shortcut-row">
				<span class="shortcut-desc">Zoeken</span>
				<span class="shortcut-keys"><kbd>⌘</kbd><kbd>K</kbd> of <kbd>Ctrl</kbd><kbd>K</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Door de zoekresultaten; Enter opent er een</span>
				<span class="shortcut-keys"><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Enter</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Zoekveld wissen, of zoeken sluiten</span>
				<span class="shortcut-keys"><kbd>Esc</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">In de Verkenner: wissel tussen netwerk en tekst</span>
				<span class="shortcut-keys"><kbd>L</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Bij een bron: Tekst, Netwerk of Verbonden</span>
				<span class="shortcut-keys"><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Bij een bron: alleen de omgeving in het netwerk</span>
				<span class="shortcut-keys"><kbd>O</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc"
					>Volgende of vorige rij in Bladeren en Verbonden; Enter opent haar</span
				>
				<span class="shortcut-keys"><kbd>J</kbd> <kbd>K</kbd> <kbd>Enter</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc"
					>Terug of vooruit naar de vorige bron, als het netwerk de focus heeft</span
				>
				<span class="shortcut-keys"><kbd>←</kbd> <kbd>→</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Door de bronnen in de lijst van het netwerk</span>
				<span class="shortcut-keys"><kbd>↑</kbd> <kbd>↓</kbd> <kbd>Home</kbd> <kbd>End</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc"
					>De bron in die lijst aan het netwerk toevoegen of eruit halen</span
				>
				<span class="shortcut-keys"><kbd>N</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Vorige of volgende wijziging, bij Vergelijken</span>
				<span class="shortcut-keys"><kbd>←</kbd> <kbd>→</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Een verwijzing direct openen, zonder kaart</span>
				<span class="shortcut-keys"
					><kbd>⌘</kbd>-klik, <kbd>Ctrl</kbd>-klik of de middelste muisknop</span
				>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Een kaart, menu of opengeklapte rij sluiten</span>
				<span class="shortcut-keys"><kbd>Esc</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Deze pagina</span>
				<span class="shortcut-keys"><kbd>?</kbd></span>
			</div>
		</div>
	</div>
</div>

<style>
	.page-wrap {
		padding: 80px 0 120px;
	}

	.container {
		max-width: 720px;
		margin: 0 auto;
		padding: 0 var(--s-5);
	}

	.stub-eyebrow {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
		margin-bottom: var(--s-4);
	}

	.stub-eyebrow a {
		color: inherit;
		text-decoration: none;
		border-bottom: none;
	}

	.stub-eyebrow a:hover {
		color: var(--ink);
		border-bottom: none;
	}

	.stub-title {
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
		line-height: var(--lh-tight);
		color: var(--ink);
		margin: 0 0 var(--s-6);
	}

	.shortcut-table {
		border: 1px solid var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}

	.shortcut-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: var(--s-3) 20px;
		background: var(--paper);
	}

	.shortcut-row:hover {
		background: var(--paper-2);
	}

	.shortcut-desc {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink);
	}

	.shortcut-keys {
		display: flex;
		gap: var(--s-1);
		align-items: center;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	kbd {
		font-family: var(--font-ui);
		font-size: var(--t-ui-micro);
		color: var(--ink-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		padding: 2px 7px;
	}
</style>

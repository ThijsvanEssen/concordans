<script lang="ts">
</script>

<svelte:head>
	<title>Sneltoetsen · Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow"><a href="/docs">Documentatie</a> · SNELTOETSEN</div>
		<h1 class="stub-title">Sneltoetsen</h1>
		<p class="stub-lede">Sneltoetsen zijn actief zodra een invoerveld geen focus heeft.</p>

		<div class="shortcut-group">
			<div class="shortcut-group__title">Algemeen</div>
			<div class="shortcut-table">
				<div class="shortcut-row">
					<span class="shortcut-desc">Zoekvenster openen</span>
					<span class="shortcut-keys"><kbd>⌘</kbd><kbd>K</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Sneltoetsen-overzicht</span>
					<span class="shortcut-keys"><kbd>?</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Sluit overlay / paneel / selectie</span>
					<span class="shortcut-keys"><kbd>Esc</kbd></span>
				</div>
			</div>
		</div>

		<div class="shortcut-group">
			<div class="shortcut-group__title">Weergavemodi in de verkenner</div>
			<div class="shortcut-table">
				<div class="shortcut-row">
					<span class="shortcut-desc">Ontdekken</span>
					<span class="shortcut-keys"><kbd>1</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Verdiepen (vraagt een geselecteerde bron)</span>
					<span class="shortcut-keys"><kbd>2</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Lezen (vraagt een geselecteerde bron)</span>
					<span class="shortcut-keys"><kbd>3</kbd></span>
				</div>
			</div>
		</div>

		<div class="shortcut-group">
			<div class="shortcut-group__title">Netwerk</div>
			<div class="shortcut-table">
				<div class="shortcut-row">
					<span class="shortcut-desc">Vorige focus in geschiedenis</span>
					<span class="shortcut-keys"><kbd>←</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Volgende focus in geschiedenis</span>
					<span class="shortcut-keys"><kbd>→</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">In- of uitzoomen</span>
					<span class="shortcut-keys">scroll</span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Deselecteer huidige bron</span>
					<span class="shortcut-keys"><kbd>Esc</kbd></span>
				</div>
			</div>
		</div>

		<div class="shortcut-group">
			<div class="shortcut-group__title">Zoekvenster</div>
			<div class="shortcut-table">
				<div class="shortcut-row">
					<span class="shortcut-desc">Volgend resultaat</span>
					<span class="shortcut-keys"><kbd>↓</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Vorig resultaat</span>
					<span class="shortcut-keys"><kbd>↑</kbd></span>
				</div>
				<div class="shortcut-row">
					<span class="shortcut-desc">Open geselecteerd resultaat</span>
					<span class="shortcut-keys"><kbd>Enter</kbd></span>
				</div>
			</div>
		</div>

		<p class="stub-note">
			Op Windows en Linux vervangt <kbd>Ctrl</kbd> de <kbd>⌘</kbd>-toets. Index heeft geen sneltoets
			en staat in het hoofdmenu.
		</p>
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

	.shortcut-group {
		margin-bottom: 40px;
	}

	.shortcut-group__title {
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		color: var(--fg-3);
		text-transform: uppercase;
		margin-bottom: 12px;
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
		padding: 12px 20px;
		border-bottom: 1px solid var(--rule);
		background: var(--paper);
	}

	.shortcut-row:last-child {
		border-bottom: none;
	}

	.shortcut-desc {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--ink);
	}

	.shortcut-keys {
		display: flex;
		gap: 4px;
		align-items: center;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--fg-3);
	}

	kbd {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-2);
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: 4px;
		padding: 2px 7px;
	}

	.stub-note {
		font-family: var(--font-sans);
		font-size: 13px;
		color: var(--fg-3);
		font-style: italic;
	}
</style>

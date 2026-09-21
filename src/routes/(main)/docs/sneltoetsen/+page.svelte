<svelte:head>
	<title>Sneltoetsen · Concordans</title>
</svelte:head>

<div class="page-wrap">
	<div class="container">
		<div class="stub-eyebrow"><a href="/docs">Documentatie</a> · SNELTOETSEN</div>
		<h1 class="stub-title">Sneltoetsen</h1>
		<div class="shortcut-table">
			<div class="shortcut-row">
				<span class="shortcut-desc">Zoeken</span>
				<span class="shortcut-keys"><kbd>⌘</kbd><kbd>K</kbd> of <kbd>Ctrl</kbd><kbd>K</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Zoeken sluiten</span>
				<span class="shortcut-keys"><kbd>Esc</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Modus Lezen</span>
				<span class="shortcut-keys"><kbd>1</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Modus Netwerk</span>
				<span class="shortcut-keys"><kbd>2</kbd></span>
			</div>
			<div class="shortcut-row">
				<span class="shortcut-desc">Modus Bladeren</span>
				<span class="shortcut-keys"><kbd>3</kbd></span>
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
		margin: 0 0 32px;
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
</style>

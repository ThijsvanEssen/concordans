<script lang="ts">
	import { page } from '$app/stores';
</script>

<svelte:head>
	<title>{$page.status === 404 ? 'Niet gevonden' : 'Fout'}, Concordans</title>
</svelte:head>

<div class="error-shell">
	<div class="error-inner">
		<span class="error-code">{$page.status}</span>
		<h1 class="error-title">
			{#if $page.status === 404}Pagina niet gevonden{:else}Er ging iets mis{/if}
		</h1>
		<p class="error-body">
			{#if $page.status === 404}
				Deze pagina bestaat niet of is verplaatst.
			{:else}
				De pagina kon niet worden getoond. Laad de pagina opnieuw of probeer het later nog eens.
			{/if}
		</p>
		<div class="error-actions">
			<a href="/" class="error-btn error-btn--primary">Naar de startpagina</a>
			<a href="/explore" class="error-btn">Open het netwerk</a>
		</div>
	</div>
</div>

<style>
	.error-shell {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: var(--s-8) var(--s-5);
	}

	.error-inner {
		max-width: 480px;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
	}

	.error-code {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.error-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: var(--t-h1);
		line-height: var(--lh-tight);
		margin: 0;
		color: var(--ink);
	}

	.error-body {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink-2);
		margin: 0;
	}

	.error-actions {
		display: flex;
		gap: var(--s-3);
		margin-top: var(--s-2);
		flex-wrap: wrap;
	}

	.error-btn {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		padding: 7px var(--s-4);
		border-radius: var(--r-1);
		text-decoration: none;
		border: 1px solid var(--rule-strong);
		color: var(--ink-2);
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.error-btn:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.error-btn--primary {
		background: var(--ink);
		color: var(--paper);
		border-color: var(--ink);
	}

	.error-btn--primary:hover {
		background: var(--ink-2);
		color: var(--paper);
		border-color: var(--ink-2);
	}
</style>

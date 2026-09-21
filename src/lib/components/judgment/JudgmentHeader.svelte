<script lang="ts">
	let {
		ecli,
		displayName,
		exploreHref,
		datum = undefined,
		instantie = undefined,
		uitspraakType = undefined
	}: {
		ecli: string | null;
		displayName: string | null;
		exploreHref: string;
		datum?: string | undefined;
		instantie?: string | undefined;
		uitspraakType?: string | undefined;
	} = $props();
</script>

<header class="judgment-header">
	<a href="/" class="back-link no-underline">← Terug</a>

	<div class="judgment-header__kind">
		<span class="judgment-header__sigil" aria-hidden="true">¶</span>
		<span class="judgment-header__kind-label">Uitspraak</span>
		{#if ecli}
			<span class="judgment-header__juris">· NL</span>
		{/if}
	</div>

	<h1 class="judgment-header__title">
		{displayName ?? ecli ?? 'Uitspraak'}
	</h1>

	{#if ecli}
		<div class="judgment-header__cite">{ecli}</div>
	{/if}

	{#if datum || instantie || uitspraakType}
		<div class="judgment-meta-row">
			{#if datum}<span class="judgment-meta-item">Datum: <time>{datum}</time></span>{/if}
			{#if instantie}<span class="judgment-meta-item">Instantie: {instantie}</span>{/if}
			{#if uitspraakType}<span class="judgment-meta-item">Type: {uitspraakType}</span>{/if}
			{#if ecli}<span class="judgment-meta-item"
					><a
						href="https://uitspraken.rechtspraak.nl/details?id={ecli}"
						target="_blank"
						rel="noopener noreferrer"
						class="judgment-source-link">↗ rechtspraak.nl</a
					></span
				>{/if}
		</div>
	{/if}

	<div class="judgment-header__actions">
		<a href={exploreHref} class="explore-link no-underline">Toon op netwerk →</a>
	</div>
</header>

<style>
	.judgment-header {
		display: flex;
		flex-direction: column;
		gap: 10px;
		padding-bottom: var(--s-6);
		border-bottom: 1px solid var(--rule);
		margin-bottom: var(--s-6);
	}

	.back-link {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--fg-3);
		display: inline-block;
		margin-bottom: 6px;
	}

	.back-link:hover {
		color: var(--accent);
	}

	/* Running head */
	.judgment-header__kind {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.judgment-header__sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 18px;
		color: var(--indigo);
		letter-spacing: 0;
		text-transform: none;
		margin-right: 2px;
	}

	.judgment-header__juris {
		color: var(--fg-4);
		text-transform: none;
		letter-spacing: 0;
	}

	/* Title */
	.judgment-header__title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 32px;
		line-height: 1.15;
		letter-spacing: -0.01em;
		margin: 0;
		color: var(--ink);
		text-wrap: pretty;
		font-variant-numeric: tabular-nums;
	}

	/* Cite */
	.judgment-header__cite {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
	}

	/* Legal metadata */
	.judgment-meta-row {
		display: flex;
		gap: var(--s-4);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		margin-top: var(--s-1);
		flex-wrap: wrap;
	}

	.judgment-meta-item {
		display: flex;
		gap: var(--s-1);
		align-items: center;
	}

	.judgment-source-link {
		color: var(--ink-3);
		border-bottom: 1px solid var(--rule);
	}

	.judgment-source-link:hover {
		color: var(--spine);
		border-bottom-color: var(--spine);
	}

	/* Actions */
	.judgment-header__actions {
		display: flex;
		align-items: center;
		gap: var(--s-4);
		margin-top: 4px;
	}

	.explore-link {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--accent);
	}

	.explore-link:hover {
		color: var(--accent-hover);
	}
</style>

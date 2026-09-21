<script lang="ts">
	let {
		bwbId,
		articleNumber,
		displayName,
		instrumentName,
		exploreHref,
		geldigVanaf = undefined,
		gewijzigdDatum = undefined
	}: {
		bwbId: string | null;
		articleNumber: string | null;
		displayName: string | null;
		instrumentName: string | null;
		exploreHref: string;
		geldigVanaf?: string | undefined;
		gewijzigdDatum?: string | undefined;
	} = $props();
</script>

<header class="article-header">
	<a href="/" class="back-link no-underline">← Terug</a>

	<div class="article-header__kind">
		<span class="article-header__sigil" aria-hidden="true">§</span>
		<span class="article-header__kind-label">Artikel</span>
		{#if instrumentName}
			<span class="article-header__juris">· {instrumentName}</span>
		{:else if bwbId}
			<span class="article-header__juris">· {bwbId}</span>
		{/if}
	</div>

	<h1 class="article-header__title">
		{displayName ?? `Artikel ${articleNumber ?? '—'}`}
	</h1>

	{#if bwbId && articleNumber}
		<div class="article-header__cite">{bwbId} Art. {articleNumber}</div>
	{/if}

	{#if geldigVanaf || gewijzigdDatum}
		<div class="article-meta-row">
			{#if geldigVanaf}<span class="article-meta-item"
					>Geldig vanaf: <time>{geldigVanaf}</time></span
				>{/if}
			{#if gewijzigdDatum}<span class="article-meta-item"
					>Gewijzigd op: <time>{gewijzigdDatum}</time></span
				>{/if}
		</div>
	{/if}

	<div class="article-header__actions">
		<a href={exploreHref} class="explore-link no-underline">Toon op netwerk →</a>
	</div>
</header>

<style>
	.article-header {
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
	.article-header__kind {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
	}

	.article-header__sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 18px;
		color: var(--accent);
		letter-spacing: 0;
		text-transform: none;
		margin-right: 2px;
	}

	.article-header__juris {
		color: var(--fg-4);
		text-transform: none;
		letter-spacing: 0;
	}

	/* Title */
	.article-header__title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 38px;
		line-height: 1.12;
		letter-spacing: -0.01em;
		margin: 0;
		color: var(--ink);
		text-wrap: pretty;
	}

	/* Cite */
	.article-header__cite {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
	}

	/* Legal metadata */
	.article-meta-row {
		display: flex;
		gap: var(--s-4);
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		margin-top: var(--s-1);
		flex-wrap: wrap;
	}

	.article-meta-item {
		display: flex;
		gap: var(--s-1);
	}

	/* Actions row */
	.article-header__actions {
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

<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const doc = $derived(data.document);

	const paragraphs = $derived(
		doc.text ? doc.text.split(/\r?\n\s*\r?\n+/).filter((p: string) => p.trim().length > 0) : []
	);
</script>

<svelte:head>
	<title>{doc.title ?? doc.kind ?? 'Document'}. Concordans</title>
</svelte:head>

<div class="pub-shell">
	<nav class="pub-nav">
		<a href="/publications" class="pub-back">← Terug</a>
		<div class="pub-nav-right">
			<a
				href="/explore?mode=split&focus={encodeURIComponent(`documents/${doc.key}`)}"
				class="pub-explore-link"
				title="Bekijk dit document in het netwerk">Verken in netwerk →</a
			>
			{#if doc.external_id}
				<a
					href="https://zoek.officielebekendmakingen.nl/{doc.external_id}"
					target="_blank"
					rel="noopener noreferrer"
					class="pub-source-link">Bekijk origineel →</a
				>
			{/if}
		</div>
	</nav>

	<article class="pub-article">
		<header class="pub-header">
			<div class="pub-kind">
				<span class="pub-sigil" aria-hidden="true">‡</span>
				<span>{doc.kind ?? 'Parlementair document'}</span>
				{#if doc.date}
					<span class="pub-datum">· {doc.date}</span>
				{/if}
			</div>
			<h1 class="pub-title">{doc.title ?? doc.kind ?? 'Document'}</h1>
		</header>

		<div class="pub-body">
			{#if paragraphs.length > 0}
				{#each paragraphs as para, i (i)}
					<p class="pub-para">{para}</p>
				{/each}
			{:else}
				<div class="pub-empty">
					<p class="pub-empty-text">De volledige tekst is nog niet beschikbaar in Concordans.</p>
					<div class="pub-empty-actions">
						<a
							href="/explore?mode=split&focus={encodeURIComponent(`documents/${doc.key}`)}"
							class="pub-empty-action pub-empty-action--primary">Verken in netwerk →</a
						>
						{#if doc.tk_url}
							<a
								href={doc.tk_url}
								target="_blank"
								rel="noopener noreferrer"
								class="pub-empty-action">Download bronbestand ↗</a
							>
						{/if}
						{#if doc.external_id}
							<a
								href="https://zoek.officielebekendmakingen.nl/{doc.external_id}"
								target="_blank"
								rel="noopener noreferrer"
								class="pub-empty-action">Officiëlebekendmakingen.nl ↗</a
							>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	</article>
</div>

<style>
	.pub-shell {
		max-width: 760px;
		margin: 0 auto;
		padding: var(--s-6) var(--s-6) var(--s-9);
		box-sizing: border-box;
	}

	.pub-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-4);
		margin-bottom: var(--s-7);
		padding-bottom: var(--s-4);
		border-bottom: 1px solid var(--rule);
	}

	.pub-nav-right {
		display: flex;
		align-items: center;
		gap: var(--s-4);
	}

	.pub-explore-link {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--accent);
		text-decoration: none;
		border-bottom: 1px solid var(--spine-faint);
		font-weight: 500;
	}

	.pub-explore-link:hover {
		color: var(--accent-hover);
		border-bottom-color: var(--accent-hover);
	}

	.pub-back {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		text-decoration: none;
		border-bottom: none;
	}

	.pub-back:hover {
		color: var(--accent);
		border-bottom: none;
	}

	.pub-source-link {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
	}

	.pub-source-link:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.pub-header {
		margin-bottom: var(--s-7);
	}

	.pub-kind {
		display: flex;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 11px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 16px;
	}

	.pub-sigil {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 18px;
		color: var(--ink-3);
		letter-spacing: 0;
		text-transform: none;
	}

	.pub-datum {
		color: var(--fg-4);
		text-transform: none;
		letter-spacing: 0;
	}

	.pub-title {
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: clamp(22px, 4vw, 34px);
		line-height: 1.2;
		letter-spacing: -0.01em;
		margin: 0;
		color: var(--ink);
		text-wrap: pretty;
	}

	.pub-body {
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.68;
		color: var(--ink);
	}

	.pub-para {
		margin: 0 0 1.3em;
		text-wrap: pretty;
	}

	.pub-para:last-child {
		margin-bottom: 0;
	}

	.pub-empty {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-6);
		background: var(--paper-2);
		border-radius: var(--r-2);
		border: 1px solid var(--rule);
	}

	.pub-empty-text {
		font-style: italic;
		color: var(--fg-3);
		margin: 0;
	}

	.pub-empty-actions {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
	}

	.pub-empty-action {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		text-decoration: none;
		border-bottom: 1px solid var(--rule-strong);
		white-space: nowrap;
	}

	.pub-empty-action:hover {
		color: var(--accent);
		border-bottom-color: var(--accent);
	}

	.pub-empty-action--primary {
		color: var(--accent);
		border-bottom-color: var(--accent);
		font-weight: 500;
	}

	.pub-empty-action--primary:hover {
		opacity: 0.8;
	}
</style>

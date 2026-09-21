<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import { instrumentMetaStore, primeInstrumentNames } from '$lib/api/instrument-cache';
	import type { Schema } from '$lib/api/types';

	let {
		bwbId,
		onNavigate
	}: {
		bwbId: string | null;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	// The API inlines at most this many characters of an article. An article that
	// fills them is shown with an ellipsis; the full text is one click away.
	const PREVIEW_CHARS = 600;
	const PAGE_SIZE = 100;

	type Article = Schema<'InstrumentArticleNodeDTO'>;

	let articles = $state<Article[]>([]);
	let total = $state(0);
	let status = $state<'idle' | 'loading' | 'loading-more' | 'ready' | 'error'>('idle');

	const lawName = $derived.by(() => {
		const meta = bwbId ? $instrumentMetaStore.get(bwbId) : null;
		return meta?.citationTitle ?? meta?.title ?? meta?.shortTitle ?? bwbId;
	});

	function load(bwb: string, offset: number, signal?: AbortSignal) {
		return unwrap(
			api.GET('/api/instruments/{bwb_id}/articles', {
				params: {
					path: { bwb_id: bwb },
					query: { text_preview_chars: PREVIEW_CHARS, limit: PAGE_SIZE, offset }
				},
				signal
			})
		);
	}

	$effect(() => {
		articles = [];
		if (!bwbId) {
			status = 'idle';
			return;
		}
		primeInstrumentNames();
		const controller = new AbortController();
		status = 'loading';
		load(bwbId, 0, controller.signal)
			.then((page) => {
				articles = page.items;
				total = page.total;
				status = 'ready';
			})
			.catch(() => {
				if (!controller.signal.aborted) status = 'error';
			});
		return () => controller.abort();
	});

	async function loadMore() {
		if (!bwbId || status !== 'ready') return;
		const bwb = bwbId;
		status = 'loading-more';
		try {
			const page = await load(bwb, articles.length);
			if (bwb === bwbId) articles.push(...page.items);
		} catch {
			// The articles already shown stay; the button remains for another attempt.
		}
		status = 'ready';
	}

	function newSections(prev: Article | undefined, cur: Article) {
		const before = prev?.breadcrumb ?? [];
		return (cur.breadcrumb ?? [])
			.map((crumb, depth) => ({ ...crumb, depth }))
			.filter((crumb, i) => before[i]?.label !== crumb.label || before[i]?.type !== crumb.type);
	}
</script>

{#if status === 'idle'}
	<div class="whole-empty">Selecteer een artikel om de wet te openen.</div>
{:else if status === 'loading'}
	<div class="whole-loading">
		<div class="spinner" aria-hidden="true"></div>
		<span>Wet ophalen…</span>
	</div>
{:else if status === 'error'}
	<div class="whole-error">Volledige wet kon niet geladen worden.</div>
{:else}
	<article class="whole-law">
		<header class="whole-head">
			<span class="whole-kind">Regeling</span>
			<h1 class="whole-title">{lawName}</h1>
			<p class="whole-count">{total} artikelen</p>
		</header>

		{#each articles as a, i (a.id)}
			{#each newSections(articles[i - 1], a) as section, j (j)}
				<h2 class="whole-section whole-section--depth-{Math.min(section.depth, 3)}">
					<span class="whole-section-kind">{section.type}</span>
					<span class="whole-section-label">{section.label}</span>
				</h2>
			{/each}

			<section class="whole-article" id="article-{a.article_number}">
				<div class="whole-article-head">
					<button
						type="button"
						class="whole-article-jump"
						onclick={() => onNavigate?.('articles', a.key)}
						title="Open in detail"
					>
						<span class="whole-art-num">Art. {a.article_number}</span>
					</button>
				</div>

				<p class="whole-text">
					{#if a.text_preview}
						{a.text_preview}{a.text_preview.length >= PREVIEW_CHARS ? '…' : ''}
					{:else}
						<span class="whole-empty-text">Geen tekst beschikbaar.</span>
					{/if}
				</p>
			</section>
		{/each}

		{#if articles.length < total}
			<button
				type="button"
				class="whole-more"
				disabled={status === 'loading-more'}
				onclick={loadMore}
			>
				{status === 'loading-more'
					? 'Laden…'
					: `Volgende artikelen (${total - articles.length} resterend)`}
			</button>
		{/if}
	</article>
{/if}

<style>
	.whole-empty,
	.whole-error {
		padding: var(--s-7);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 16px;
		color: var(--fg-3);
		text-align: center;
	}

	.whole-error {
		color: var(--accent);
		font-style: normal;
	}

	.whole-loading {
		padding: var(--s-7);
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		align-items: center;
		color: var(--fg-3);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 14px;
	}

	.spinner {
		width: 26px;
		height: 26px;
		border: 2px solid var(--rule);
		border-top-color: var(--accent);
		border-radius: 50%;
		animation: spin 0.9s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.whole-law {
		max-width: 900px;
		width: 100%;
		margin: 0 auto;
		padding: var(--s-7) var(--s-7) var(--s-8);
		box-sizing: border-box;
	}

	.whole-head {
		margin-bottom: var(--s-7);
		padding-bottom: var(--s-4);
		border-bottom: 1px solid var(--rule);
	}

	.whole-kind {
		display: block;
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-3);
		margin-bottom: 8px;
	}

	.whole-title {
		margin: 0 0 6px;
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: 36px;
		line-height: 1.1;
		color: var(--ink);
	}

	.whole-count {
		margin: 0;
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--fg-3);
	}

	.whole-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
		margin: var(--s-7) 0 var(--s-3);
		padding-bottom: 6px;
		border-bottom: 1px solid var(--rule);
	}

	.whole-section--depth-0 {
		margin-top: var(--s-8);
	}

	.whole-section-kind {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--fg-4);
	}

	.whole-section-label {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--ink);
		font-size: 18px;
		line-height: 1.25;
	}

	.whole-section--depth-0 .whole-section-label {
		font-size: 22px;
	}
	.whole-section--depth-2 .whole-section-label,
	.whole-section--depth-3 .whole-section-label {
		font-size: 15px;
		color: var(--ink-2);
	}

	.whole-article {
		margin: var(--s-5) 0;
	}

	.whole-article-head {
		margin-bottom: var(--s-2);
	}

	.whole-article-jump {
		background: none;
		border: 0;
		padding: 0;
		cursor: pointer;
		display: inline-flex;
		align-items: baseline;
		gap: var(--s-2);
		text-align: left;
	}

	.whole-art-num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--accent);
		font-weight: 500;
	}

	.whole-article-jump:hover .whole-art-num {
		text-decoration: underline;
	}

	.whole-text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.62;
		color: var(--ink);
		white-space: pre-line;
	}

	.whole-more {
		display: block;
		margin: var(--s-6) auto 0;
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		background: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 6px 14px;
		cursor: pointer;
	}

	.whole-more:hover:not(:disabled) {
		background: var(--paper-3);
		color: var(--ink);
	}

	.whole-more:disabled {
		opacity: 0.5;
		cursor: default;
	}

	.whole-empty-text {
		margin: 0;
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--fg-3);
	}
</style>

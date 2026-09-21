<script lang="ts">
	// Reader for articles: text with links to the articles it cites, the number of
	// open dossiers that target the article, prev/next navigation and, on request,
	// the legislative history.
	import { api, unwrap } from '$lib/api/client';
	import { getArticleDetail } from '$lib/api/articles';
	import { recordInstrument } from '$lib/api/instrument-cache';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import ArticleLegislativeHistory from '$lib/components/parliamentary/ArticleLegislativeHistory.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';

	let {
		selection,
		onNavigate,
		onPrev,
		onNext
	}: {
		selection: GraphNode | null;
		onNavigate?: (collection: string, key: string) => void;
		onPrev?: () => void;
		onNext?: () => void;
	} = $props();

	type View =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; data: Schema<'ArticleDetailResponse'> };

	let view = $state<View>({ kind: 'empty' });
	let openDossiers = $state(0);

	// Primitives, so that a new selection object for the same article does not reload it.
	const selected = $derived(selection !== null);
	const bwbId = $derived(String(selection?.raw?.props?.bwb_id ?? ''));
	const articleNumber = $derived(String(selection?.raw?.props?.article_number ?? ''));

	$effect(() => {
		openDossiers = 0;
		if (!selected) {
			view = { kind: 'empty' };
			return;
		}
		if (!bwbId || !articleNumber) {
			view = { kind: 'error', message: 'Artikel kon niet geladen worden.' };
			return;
		}

		let stale = false;
		const controller = new AbortController();
		view = { kind: 'loading' };
		getArticleDetail(bwbId, articleNumber)
			.then((data) => {
				if (stale) return;
				// The status bar and the citation panel read the law name from this cache.
				if (data.instrument) {
					recordInstrument({ bwb_id: bwbId, display_name: data.instrument.display_name });
				}
				view = { kind: 'loaded', data };
			})
			.catch(() => {
				if (!stale) view = { kind: 'error', message: 'Artikel kon niet geladen worden.' };
			});
		unwrap(
			api.GET('/api/articles/{bwb_id}/{article_number}/in-flux', {
				params: { path: { bwb_id: bwbId, article_number: articleNumber } },
				signal: controller.signal
			})
		)
			.then((r) => (openDossiers = r.open_dossier_count))
			.catch(() => {
				// The count is supplementary; without it the head simply shows nothing.
			});
		return () => {
			stale = true;
			controller.abort();
		};
	});
</script>

<ReaderFrame
	status={view.kind === 'loaded' ? 'ready' : view.kind}
	message={view.kind === 'error' ? view.message : ''}
>
	{#if view.kind === 'loaded'}
		{@const d = view.data}
		{@const a = d.article}
		<ReaderHead
			sigil="§"
			tone="article"
			kind="Artikel"
			juris={d.instrument?.display_name}
			title={a.display_name ?? 'Artikel'}
		>
			{#if a.article_number}
				<div class="reader-cite">Art. {a.article_number}</div>
			{/if}
			{#if openDossiers > 0}
				<div class="reader-influx-wrap">
					<span class="reader-influx-label">
						<span class="reader-influx-dot" aria-hidden="true"></span>
						In behandeling
					</span>
					<span class="reader-influx-count">
						{openDossiers}
						{openDossiers === 1 ? 'open dossier' : 'open dossiers'}
					</span>
				</div>
			{/if}
		</ReaderHead>

		<div class="reader-body">
			<ArticleText text={a.text} citations={d.citations} {onNavigate} />
		</div>

		{#if onPrev || onNext}
			<div class="reader-nav-footer">
				<button
					type="button"
					class="reader-nav-btn"
					disabled={!onPrev}
					onclick={onPrev}
					aria-label="Vorig artikel">← Vorig</button
				>
				<button
					type="button"
					class="reader-nav-btn reader-nav-btn--next"
					disabled={!onNext}
					onclick={onNext}
					aria-label="Volgend artikel">Volgend →</button
				>
			</div>
		{/if}

		{#if a.bwb_id && a.article_number}
			<ArticleLegislativeHistory bwbId={a.bwb_id} articleNumber={a.article_number} />
		{/if}
	{/if}
</ReaderFrame>

<style>
	.reader-cite {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
		margin-bottom: 10px;
	}

	.reader-influx-wrap {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 12px;
	}

	.reader-influx-label {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ochre);
	}

	.reader-influx-count {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-2);
	}

	.reader-influx-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ochre-2);
		flex-shrink: 0;
	}

	.reader-body {
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.68;
		color: var(--ink);
	}

	.reader-nav-footer {
		display: flex;
		justify-content: space-between;
		gap: var(--s-3);
		margin-top: var(--s-6);
		padding-top: var(--s-5);
		border-top: 1px solid var(--rule);
	}

	.reader-nav-btn {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--ink-3);
		background: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 6px 14px;
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease),
			border-color var(--dur-1) var(--ease);
	}

	.reader-nav-btn:hover:not(:disabled) {
		background: var(--paper-3);
		color: var(--ink);
		border-color: var(--ink-3);
	}

	.reader-nav-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.reader-nav-btn--next {
		margin-left: auto;
	}
</style>

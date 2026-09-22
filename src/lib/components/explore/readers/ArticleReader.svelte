<script lang="ts">
	// Reader for articles: the text in its parts, with links to what it cites, the
	// number of open dossiers that target the article and the previous and next article.
	import { api, unwrap } from '$lib/api/client';
	import { getArticleDetail } from '$lib/api/articles';
	import { recordInstrument } from '$lib/api/instrument-cache';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import { page } from '$app/state';
	import { anchorOfHash, landOn } from '$lib/bron/anchor';
	import { articleIdentity } from '$lib/util/law-id';
	import { tick } from 'svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import ReaderHead from './ReaderHead.svelte';

	let {
		selection,
		prevHref,
		nextHref
	}: {
		selection: GraphNode | null;
		prevHref?: string;
		nextHref?: string;
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
	const identity = $derived(
		selection ? articleIdentity(selection.raw?.props ?? undefined, selection.key) : null
	);
	const bwbId = $derived(identity?.lawId ?? '');
	const articleNumber = $derived(identity?.articleNumber ?? '');

	// The position in the URL, once the text is on the page and again when it changes.
	let root = $state<HTMLElement | null>(null);
	const anchor = $derived(anchorOfHash(page.url.hash));
	$effect(() => {
		if (view.kind !== 'loaded' || !anchor || !root) return;
		const container = root;
		void tick().then(() => landOn(container, anchor));
	});

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
			collection="articles"
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

		<div class="reader-body" bind:this={root}>
			<ArticleText text={a.text} citations={d.citations} />
		</div>

		{#if prevHref || nextHref}
			<nav class="reader-nav-footer" aria-label="Artikelen">
				{#if prevHref}
					<a class="reader-nav-btn" href={prevHref} data-sveltekit-noscroll>← Vorig</a>
				{/if}
				{#if nextHref}
					<a class="reader-nav-btn reader-nav-btn--next" href={nextHref} data-sveltekit-noscroll
						>Volgend →</a
					>
				{/if}
			</nav>
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

	.reader-nav-btn:hover {
		background: var(--paper-3);
		color: var(--ink);
		border-color: var(--ink-3);
	}

	.reader-nav-btn--next {
		margin-left: auto;
	}
</style>

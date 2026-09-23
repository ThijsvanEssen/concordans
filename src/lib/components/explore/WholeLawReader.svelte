<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import { getArticleDetail } from '$lib/api/articles';
	import { instrumentMetaStore, primeInstrumentNames } from '$lib/api/instrument-cache';
	import type { Schema } from '$lib/api/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import { SvelteMap } from 'svelte/reactivity';

	import { bronHref } from '$lib/bron/href';

	let { bwbId }: { bwbId: string | null } = $props();

	// The overview lists every article of the law with a preview only: at full text and
	// parts per article, 810 articles would balloon the payload. The full, leden-structured
	// text of an article is fetched only once it scrolls into view (`lazyLoad` below),
	// through the same per-article endpoint the article reader already uses.
	const PREVIEW_CHARS = 600;
	const PAGE_SIZE = 100;

	type Article = Schema<'InstrumentArticleNodeDTO'>;
	type Detail = Schema<'ArticleDetailResponse'>;

	let articles = $state<Article[]>([]);
	let total = $state(0);
	let status = $state<'idle' | 'loading' | 'loading-more' | 'ready' | 'error'>('idle');
	// A plain `Map` (even inside `$state()`) does not give `.set()`/`.get()` reactivity
	// in Svelte 5, so a mutation here would never re-render the article that just
	// loaded — SvelteMap is reactive on its own and is cleared in place, never reassigned.
	const detailByNumber = new SvelteMap<string, Detail>();
	const pending = new Set<string>();

	async function ensureDetail(bwb: string, articleNumber: string) {
		if (detailByNumber.has(articleNumber) || pending.has(articleNumber)) return;
		pending.add(articleNumber);
		try {
			const detail = await getArticleDetail(bwb, articleNumber);
			if (bwb === bwbId) detailByNumber.set(articleNumber, detail);
		} catch {
			// The preview stays; scrolling back into view retries.
		} finally {
			pending.delete(articleNumber);
		}
	}

	/** Fetches an article's full text once its preview scrolls near the viewport. */
	function lazyLoad(el: HTMLElement, articleNumber: string | null) {
		const bwb = bwbId;
		if (!bwb || !articleNumber) return {};
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((e) => e.isIntersecting)) {
					observer.disconnect();
					void ensureDetail(bwb, articleNumber);
				}
			},
			{ rootMargin: '600px 0px' }
		);
		observer.observe(el);
		return { destroy: () => observer.disconnect() };
	}

	// The law's names for Citeer, as the article reader builds them.
	const citationOf = (articleNumber: string | null) => {
		const meta = bwbId ? $instrumentMetaStore.get(bwbId) : null;
		const title = meta?.citationTitle ?? meta?.title ?? null;
		if (!articleNumber || !title) return null;
		return { articleNumber, shortTitle: meta?.shortTitle ?? null, citationTitle: title };
	};

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
		detailByNumber.clear();
		pending.clear();
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
	<div class="whole-empty"></div>
{:else if status === 'loading'}
	<div class="whole-loading">
		<div class="spinner" aria-hidden="true"></div>
		<span>Laden…</span>
	</div>
{:else if status === 'error'}
	<div class="whole-error">Wet niet geladen.</div>
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

			{@const detail = a.article_number ? detailByNumber.get(a.article_number) : undefined}
			<section
				class="whole-article"
				id="article-{a.article_number}"
				use:lazyLoad={a.article_number}
			>
				<div class="whole-article-head">
					<a
						class="whole-article-jump"
						href={bronHref({ collection: 'articles', key: a.key })}
						data-sveltekit-noscroll
					>
						<span class="whole-art-num">Art. {a.article_number}</span>
					</a>
				</div>

				{#if detail}
					<ArticleText
						text={detail.article.text}
						parts={detail.article.parts}
						citation={citationOf(a.article_number)}
					/>
				{:else if a.text_preview}
					<p class="whole-text">
						{a.text_preview}{a.text_preview.length >= PREVIEW_CHARS ? '…' : ''}
					</p>
				{:else}
					<p class="whole-text"><span class="whole-empty-text">Geen tekst beschikbaar.</span></p>
				{/if}
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
		color: var(--ink-3);
		text-align: center;
	}

	.whole-error {
		color: var(--ink-2);
		font-style: normal;
	}

	.whole-loading {
		padding: var(--s-7);
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		align-items: center;
		color: var(--ink-3);
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
	}

	.spinner {
		width: 26px;
		height: 26px;
		border: 2px solid var(--rule);
		border-top-color: var(--ink-2);
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
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin-bottom: 8px;
	}

	.whole-title {
		margin: 0 0 6px;
		font-family: var(--font-serif);
		font-weight: 500;
		font-size: var(--t-h1);
		line-height: var(--lh-tight);
		color: var(--ink);
	}

	.whole-count {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
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
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.whole-section-label {
		font-family: var(--font-serif);
		font-weight: 500;
		color: var(--ink);
		font-size: 17px;
		line-height: var(--lh-snug);
	}

	.whole-section--depth-0 .whole-section-label {
		font-size: var(--t-h3);
	}
	.whole-section--depth-2 .whole-section-label,
	.whole-section--depth-3 .whole-section-label {
		font-size: var(--t-body-2);
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
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-2);
		font-weight: 500;
	}

	.whole-article-jump:hover .whole-art-num {
		color: var(--accent);
		text-decoration: underline;
	}

	.whole-text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		white-space: pre-line;
	}

	.whole-more {
		display: block;
		margin: var(--s-6) auto 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		background: none;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 6px 14px;
		cursor: pointer;
	}

	.whole-more:hover:not(:disabled) {
		background: var(--paper-2);
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
		color: var(--ink-3);
	}
</style>

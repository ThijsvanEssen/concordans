<script lang="ts">
	// Reader for instrument_articles: article text (or leden), open dossiers
	// that target the article, prev/next navigation, MvT and legislative history.
	import { getArticleDetail } from '$lib/api/articles';
	import { recordInstrument } from '$lib/api/instrument-cache';
	import { fetchArticleLegislativeHistory } from '$lib/api/parliamentary-client';
	import type { ArticleDetailResponse } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import LidText from '$lib/components/articles/LidText.svelte';
	import ArticleLegislativeHistory from '$lib/components/parliamentary/ArticleLegislativeHistory.svelte';
	import ArticleMvtPanel from './ArticleMvtPanel.svelte';
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

	// The generated schema predates citation_formats; the backend still sends it.
	type ArticleDetail = ArticleDetailResponse & {
		citation_formats?: { bibtex?: string | null } | null;
	};

	type View =
		| { kind: 'empty' }
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; data: ArticleDetail };

	// Open dossiers (status 'voorgesteld') targeting this article, deduped by
	// kamerstuknummer.
	type InFluxDossier = { nummer: string; titel: string | null };

	let view = $state<View>({ kind: 'empty' });
	let inFluxDossiers = $state<InFluxDossier[]>([]);
	let token = 0;

	/** Feed the law name to the instrument cache so the status bar and the
	 *  citation panel show it without loading the instrument separately. */
	function recordLawName(bwb: string, data: ArticleDetail) {
		const bibtex = data.citation_formats?.bibtex;
		if (!bibtex) return;
		const shortTitle = bibtex.match(/shorttitle\s*=\s*\{([^}]+)\}/)?.[1] ?? null;
		const law = bibtex.match(/\blaw\s*=\s*\{([^}]+)\}/)?.[1] ?? null;
		recordInstrument({ bwb_id: bwb, short_title: shortTitle, citation_title: law, title: law });
	}

	function loadInFlux(bwb: string, art: string, t: number) {
		fetchArticleLegislativeHistory(bwb, art)
			.then((r) => {
				if (t !== token) return;
				const seen = new Set<string>();
				const open: InFluxDossier[] = [];
				for (const e of r.entries) {
					const nummer = e.dossier_nummer;
					if (e.status !== 'voorgesteld' || !nummer || seen.has(nummer)) continue;
					seen.add(nummer);
					open.push({ nummer, titel: e.dossier_titel });
				}
				inFluxDossiers = open;
			})
			.catch(() => {
				// Best-effort: without the list the reader simply shows no chips.
			});
	}

	$effect(() => {
		const node = selection;
		const t = ++token;
		inFluxDossiers = [];
		if (!node) {
			view = { kind: 'empty' };
			return;
		}

		const props = node.raw?.props as Record<string, unknown> | undefined;
		// EU articles have no bwb_id; the celex stands in. The backend validates
		// ^BWB[RrVv]\d{7}$, so the original casing must be kept.
		const bwb = String(props?.['bwb_id'] ?? props?.['celex'] ?? '');
		const art = String(props?.['article_number'] ?? '');
		if (!bwb || !art) {
			view = { kind: 'error', message: 'Artikel kon niet geladen worden.' };
			return;
		}

		view = { kind: 'loading' };
		getArticleDetail(bwb, art)
			.then((data) => {
				if (t !== token) return;
				recordLawName(bwb, data);
				view = { kind: 'loaded', data };
				loadInFlux(bwb, art, t);
			})
			.catch(() => {
				if (t === token) view = { kind: 'error', message: 'Artikel kon niet geladen worden.' };
			});
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
			title={a.display_name ?? `Art. ${a.article_number ?? '—'}`}
		>
			{#if a.article_number && a.display_name && a.display_name !== `Art. ${a.article_number}`}
				<div class="reader-cite">Art. {a.article_number}</div>
			{/if}
			{#if inFluxDossiers.length > 0}
				<div class="reader-influx-wrap">
					<span class="reader-influx-label">
						<span class="reader-influx-dot" aria-hidden="true"></span>
						In behandeling
					</span>
					<ul class="reader-influx-list" aria-label="Open wetsvoorstellen">
						{#each inFluxDossiers as dossier (dossier.nummer)}
							<li>
								<a
									class="reader-influx-chip"
									href="/explore?focus=kamerstukdossiers/{dossier.nummer}&overlay=dossier:{dossier.nummer}"
									title={dossier.titel ?? `Dossier ${dossier.nummer}`}
								>
									<span class="reader-influx-chip__num">{dossier.nummer}</span>
									<span class="reader-influx-chip__titel">{dossier.titel ?? 'Dossier'}</span>
								</a>
							</li>
						{/each}
					</ul>
				</div>
			{/if}
		</ReaderHead>

		<div class="reader-body">
			{#if d.leden && d.leden.length > 0}
				<ol class="leden">
					{#each d.leden as lid, i (i)}
						<li class="lid">
							<span class="lid-num" aria-hidden="true">{lid.number}</span>
							<p class="lid-text">
								<LidText text={lid.text} citaties={lid.citaties} {onNavigate} />
							</p>
						</li>
					{/each}
				</ol>
			{:else}
				<ArticleText text={a.text} citations={d.citations ?? []} {onNavigate} />
			{/if}
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

		{#if a.bwb_id}
			<ArticleMvtPanel bwbId={a.bwb_id} articleNumber={a.article_number} />
			{#if a.article_number}
				<ArticleLegislativeHistory bwbId={a.bwb_id} articleNumber={a.article_number} />
			{/if}
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
		margin-bottom: 5px;
	}

	.reader-influx-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ochre-2);
		flex-shrink: 0;
	}

	.reader-influx-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 4px 6px;
	}

	.reader-influx-chip {
		display: inline-flex;
		align-items: baseline;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--sepia);
		background: var(--ochre-faint);
		border: 1px solid var(--ochre-faint);
		border-radius: var(--r-1);
		padding: 2px 7px;
		text-decoration: none;
		max-width: 100%;
		transition: background 80ms;
	}

	.reader-influx-chip:hover {
		background: color-mix(in srgb, var(--ochre-faint) 70%, var(--paper-3));
	}

	.reader-influx-chip__num {
		font-weight: 600;
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}

	.reader-influx-chip__titel {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 22ch;
	}

	.reader-body {
		font-family: var(--font-serif);
		font-size: 17px;
		line-height: 1.68;
		color: var(--ink);
	}

	.leden {
		list-style: none;
		margin: 0;
		padding: 0;
		counter-reset: lid;
		max-width: calc(68ch + 32px + var(--s-3));
	}

	.lid {
		display: grid;
		grid-template-columns: 32px 1fr;
		gap: var(--s-3);
		margin-bottom: var(--s-5);
	}

	.lid:last-child {
		margin-bottom: 0;
	}

	.lid-num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
		line-height: 1.62;
		padding-top: 4px;
		text-align: right;
	}

	.lid-text {
		margin: 0;
		font-family: var(--font-serif);
		font-size: 18px;
		line-height: 1.62;
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

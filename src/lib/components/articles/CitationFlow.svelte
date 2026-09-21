<script lang="ts">
	import ReferencedArticleCard from '$lib/components/articles/ReferencedArticleCard.svelte';
	import { getArticleDetail } from '$lib/api/articles';
	import type { ArticleDetailResponse } from '$lib/api/types';
	import { buildCitationGraph, extractArticleTargets, keyOf } from '$lib/articles/citation-graph';
	import type { ArticleKey, BuildCitationGraphResult } from '$lib/articles/citation-graph';

	let { root }: { root: ArticleDetailResponse } = $props();

	const MAX_DEPTH = 3;
	const MAX_FETCH = 30;

	const safeValue = (v: string | null | undefined) => v ?? '';
	const rootKey = keyOf(safeValue(root.article.bwb_id), safeValue(root.article.article_number));

	let showReferencedText = $state(false);
	let depth = $state(1);
	let showFullChain = $state(false);
	let expansionMode = $state<'default' | 'expanded' | 'collapsed'>('default');
	let totalFetches = $state(0);
	let graph = $state<BuildCitationGraphResult | null>(null);
	let graphLoading = $state(false);
	let graphError = $state<string | null>(null);
	let loadToken = 0;

	const cache = new Map<ArticleKey, ArticleDetailResponse>([[rootKey, root]]);
	const directTargets = extractArticleTargets(root.citations ?? []);

	type TreeNode = { key: ArticleKey; depth: number };

	function flattenTree(
		result: BuildCitationGraphResult,
		currentKey: ArticleKey,
		level: number,
		acc: TreeNode[],
		seen = new Set<ArticleKey>()
	) {
		if (level >= depth) return;
		const children = result.edges.get(currentKey) ?? [];
		for (const childKey of children) {
			if (seen.has(childKey)) continue;
			seen.add(childKey);
			acc.push({ key: childKey, depth: level + 1 });
			flattenTree(result, childKey, level + 1, acc, seen);
		}
	}

	const treeNodes = $derived((): TreeNode[] => {
		if (!graph) return [];
		const acc: TreeNode[] = [];
		flattenTree(graph, graph.rootKey, 0, acc);
		return acc;
	});

	async function loadGraph() {
		const callId = ++loadToken;
		graphLoading = true;
		graphError = null;
		const remaining = Math.max(0, MAX_FETCH - totalFetches);

		try {
			const result = await buildCitationGraph({
				root,
				depth,
				maxFetch: remaining,
				fetchArticle: getArticleDetail,
				existingNodes: cache
			});

			if (callId !== loadToken) return;

			for (const [key, detail] of result.nodes) {
				if (!cache.has(key)) cache.set(key, detail);
			}

			totalFetches += result.fetches;
			graph = result;
		} catch (error) {
			if (callId !== loadToken) return;
			graphError = error instanceof Error ? error.message : 'Kon citation flow niet laden.';
		} finally {
			if (callId === loadToken) graphLoading = false;
		}
	}

	async function retryNode(key: ArticleKey) {
		if (!graph || totalFetches >= MAX_FETCH) {
			graphError = 'Maximale fetchlimiet bereikt.';
			return;
		}
		const meta = graph.targetMeta.get(key);
		if (!meta) return;

		graphLoading = true;
		try {
			const detail = await getArticleDetail(meta.bwb_id, meta.article_number);
			cache.set(key, detail);
			totalFetches += 1;
			await loadGraph();
		} catch (error) {
			graphError = error instanceof Error ? error.message : 'Kon artikel niet opnieuw laden.';
		} finally {
			graphLoading = false;
		}
	}

	function targetFromKey(key: ArticleKey) {
		const meta = graph?.targetMeta.get(key);
		if (meta) return meta;
		const detail = graph?.nodes.get(key);
		if (detail?.article.bwb_id && detail.article.article_number) {
			return {
				bwb_id: detail.article.bwb_id,
				article_number: detail.article.article_number,
				display_name: detail.article.display_name
			};
		}
		return null;
	}

	const cardState = $derived((key: ArticleKey) => {
		if (graphLoading) return 'loading' as const;
		if (graph?.errors.has(key)) return 'error' as const;
		return 'loaded' as const;
	});

	$effect(() => {
		if (showReferencedText) loadGraph();
	});

	$effect(() => {
		if (showReferencedText && depth) loadGraph();
	});
</script>

<section class="citation-flow">
	<header class="citation-flow__header">
		<div class="citation-flow__title-group">
			<h2 class="citation-flow__title">Citatieketen</h2>
			<p class="citation-flow__chain">
				Art. {root.article.article_number ?? '—'}
				{#if directTargets.length > 0}
					{#each showFullChain ? directTargets : directTargets.slice(0, 3) as t, i (i)}
						&nbsp;jo.&nbsp;{t.display_name ?? `Art. ${t.article_number}`}
					{/each}
					{#if !showFullChain && directTargets.length > 3}
						&nbsp;+{directTargets.length - 3} meer
					{/if}
				{:else}
					<span class="citation-flow__none">— geen directe citaties</span>
				{/if}
			</p>
			{#if directTargets.length > 3}
				<button type="button" class="chain-toggle" onclick={() => (showFullChain = !showFullChain)}>
					{showFullChain ? 'Toon compacte keten' : 'Toon volledige keten'}
				</button>
			{/if}
		</div>

		<div class="citation-flow__controls">
			<label class="toggle-control">
				<input type="checkbox" bind:checked={showReferencedText} />
				Toon geciteerde tekst
			</label>
			<label class="depth-control">
				<span>Diepte</span>
				<select bind:value={depth}>
					{#each Array(MAX_DEPTH) as _, i (i)}
						<option value={i + 1}>{i + 1}</option>
					{/each}
				</select>
			</label>
			{#if totalFetches > 0}
				<span class="fetch-progress">{totalFetches} / {MAX_FETCH} citaties geladen</span>
			{/if}
		</div>
	</header>

	{#if graphError}
		<p class="citation-flow__error">{graphError}</p>
	{/if}

	{#if totalFetches >= MAX_FETCH}
		<p class="citation-flow__error">
			Maximaal {MAX_FETCH} citaties geladen om de browser niet te overbelasten. Verklein de diepte voor
			een overzichtelijker resultaat.
		</p>
	{/if}

	{#if showReferencedText}
		<div class="citation-flow__expand-row">
			<button type="button" class="expand-btn" onclick={() => (expansionMode = 'expanded')}>
				Alles uitklappen
			</button>
			<button type="button" class="expand-btn" onclick={() => (expansionMode = 'collapsed')}>
				Alles inklappen
			</button>
		</div>

		<div class="citation-flow__list">
			{#if graphLoading && (!graph || treeNodes().length === 0)}
				<p class="citation-flow__placeholder">Citaties laden…</p>
			{:else if treeNodes().length === 0}
				<p class="citation-flow__placeholder">Geen geciteerde artikelen binnen deze diepte.</p>
			{:else}
				{#each treeNodes() as node (node.key)}
					{@const targetInfo = targetFromKey(node.key)}
					{#if targetInfo}
						<div class="citation-flow__item" style="padding-left: {(node.depth - 1) * 1.25}rem">
							<ReferencedArticleCard
								target={targetInfo}
								state={cardState(node.key)}
								article={graph?.nodes.get(node.key)?.article ?? null}
								depth={node.depth}
								maxDepth={MAX_DEPTH}
								errorMessage={graph?.errors.get(node.key)}
								onRetry={() => retryNode(node.key)}
								expanded={expansionMode === 'expanded'
									? true
									: expansionMode === 'collapsed'
										? false
										: undefined}
								onToggleExpanded={() => (expansionMode = 'default')}
							/>
						</div>
					{/if}
				{/each}
			{/if}
		</div>
	{/if}
</section>

<style>
	.citation-flow {
		border: 1px solid var(--border);
		border-radius: var(--radius-md);
		padding: var(--space-2) var(--space-2) var(--space-2);
		background: var(--surface);
	}

	.citation-flow__header {
		display: flex;
		justify-content: space-between;
		gap: var(--space-2);
		flex-wrap: wrap;
		align-items: flex-start;
		margin-bottom: var(--space-2);
	}

	.citation-flow__title-group {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.citation-flow__title {
		margin: 0;
		font-size: var(--text-lg);
		font-weight: 600;
	}

	.citation-flow__chain {
		margin: 0;
		font-size: var(--text-sm);
		color: var(--muted);
		font-family: var(--font-serif);
		line-height: 1.6;
	}

	.citation-flow__none {
		font-style: italic;
	}

	.chain-toggle {
		background: none;
		border: none;
		color: var(--accent);
		cursor: pointer;
		font-size: var(--text-xs);
		padding: 0;
		text-decoration: underline;
		align-self: flex-start;
	}

	.citation-flow__controls {
		display: flex;
		align-items: center;
		gap: var(--space-2);
		flex-wrap: wrap;
	}

	.toggle-control {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--text-sm);
		cursor: pointer;
		color: var(--ink-secondary);
	}

	.depth-control {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-size: var(--text-sm);
		color: var(--ink-secondary);
	}

	.depth-control select {
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		padding: 0.15rem 0.4rem;
		background: var(--surface);
		font-size: var(--text-sm);
	}

	.fetch-progress {
		font-size: var(--text-xs);
		color: var(--muted);
		white-space: nowrap;
	}

	.citation-flow__error {
		color: var(--error-fg);
		font-size: var(--text-sm);
		margin: 0 0 var(--space-1);
		padding: var(--space-1);
		background: var(--error-bg);
		border-radius: var(--radius-sm);
	}

	.citation-flow__expand-row {
		display: flex;
		gap: var(--space-1);
		margin-bottom: var(--space-2);
	}

	.expand-btn {
		padding: 0.25rem 0.75rem;
		border: 1px solid var(--border-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: var(--text-sm);
		cursor: pointer;
		color: var(--ink-secondary);
	}

	.expand-btn:hover {
		background: var(--accent-soft);
		border-color: var(--accent);
		color: var(--accent);
	}

	.citation-flow__list {
		display: flex;
		flex-direction: column;
		gap: var(--space-2);
	}

	.citation-flow__item {
		width: 100%;
	}

	.citation-flow__placeholder {
		color: var(--muted);
		font-style: italic;
		font-size: var(--text-sm);
		margin: 0;
	}
</style>

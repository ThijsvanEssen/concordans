<script lang="ts">
	import { onMount } from 'svelte';
	import { getCorpusStats, type FullCorpusStats } from '$lib/api/stats';

	let stats = $state<FullCorpusStats | null>(null);

	onMount(() => {
		getCorpusStats()
			.then((s) => {
				stats = s;
			})
			.catch(() => {});
	});

	function formatNum(n: number) {
		return n.toLocaleString('nl-NL');
	}
</script>

{#if stats}
	<div class="freshness">
		<span class="freshness-cell">
			<span class="freshness-num">{formatNum(stats.corpus.article_count)}</span>
			<span class="freshness-label">artikelen</span>
		</span>
		<span class="freshness-sep">·</span>
		<span class="freshness-cell">
			<span class="freshness-num">{formatNum(stats.corpus.judgment_count)}</span>
			<span class="freshness-label">arresten</span>
		</span>
		<span class="freshness-sep">·</span>
		<span class="freshness-cell">
			<span class="freshness-num">{formatNum(stats.corpus.connection_count)}</span>
			<span class="freshness-label">verbindingen</span>
		</span>
		{#if stats.corpus.last_updated}
			<span class="freshness-sep">·</span>
			<span class="freshness-cell">
				<span class="freshness-label">bijgewerkt {stats.corpus.last_updated}</span>
			</span>
		{/if}
	</div>
{/if}

<style>
	.freshness {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: baseline;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-4);
		padding: var(--s-3) 0;
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
	}
	.freshness-cell {
		display: inline-flex;
		align-items: baseline;
		gap: 5px;
	}
	.freshness-num {
		font-family: var(--font-mono);
		font-size: 12px;
		color: var(--ink-2);
		font-weight: 500;
	}
	.freshness-label {
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.freshness-sep {
		color: var(--ink-4);
		opacity: 0.5;
	}
</style>

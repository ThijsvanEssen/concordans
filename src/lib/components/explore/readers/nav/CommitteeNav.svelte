<script lang="ts">
	// Lezen navigation for a committee: its dossiers, open ones first.
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { committeeSlug, getCommittee } from '$lib/components/parliamentary/data';
	import { STAGE_LABEL, TRACK_LABEL } from '$lib/components/parliamentary/stages';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let items = $state<Schema<'DossierSummaryDTO'>[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const slug = committeeSlug(node);
		let stale = false;
		error = null;
		if (!slug) {
			error = 'Dossiers kunnen niet geladen worden.';
			return;
		}
		loading = true;
		getCommittee(slug)
			.then((c) => {
				if (stale) return;
				items = [...(c.dossiers ?? [])].sort(
					(a, b) =>
						Number(a.closed) - Number(b.closed) ||
						(b.opened_on ?? '').localeCompare(a.opened_on ?? '')
				);
			})
			.catch(() => {
				if (!stale) error = 'Dossiers kunnen niet geladen worden.';
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});
</script>

<header class="nav-head">
	<span class="nav-kind">COMMISSIE</span>
	<h3 class="nav-title">{node.label}</h3>
	{#if items.length > 0}<span class="nav-count">{items.length} dossiers</span>{/if}
</header>

{#if loading && items.length === 0}
	<p class="nav-empty">Laden…</p>
{:else if error}
	<p class="nav-error">{error}</p>
{:else if items.length === 0}
	<p class="nav-empty">Geen dossiers gekoppeld.</p>
{:else}
	<ol class="nav-list">
		{#each items as d (d.key)}
			<li>
				<button
					type="button"
					class="nav-row"
					class:is-closed={d.closed}
					onclick={() => onNavigate?.('dossiers', d.key)}
				>
					<span class="nav-num">{d.number}</span>
					<span class="nav-dossier-title">{d.title ?? d.number}</span>
					{#if d.current_stage}
						<span class="nav-stage">{STAGE_LABEL[d.current_stage]}</span>
					{:else if d.track}
						<span class="nav-stage">{TRACK_LABEL[d.track]}</span>
					{/if}
				</button>
			</li>
		{/each}
	</ol>
{/if}

<style>
	.nav-head {
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 8px var(--s-4) 4px;
	}
	.nav-kind {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.08em;
		color: var(--ink-4);
	}
	.nav-title {
		font-family: var(--font-serif);
		font-size: 14px;
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: 1.3;
	}
	.nav-count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
		margin-top: 2px;
	}
	.nav-empty,
	.nav-error {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 12px;
		color: var(--ink-4);
		margin: 6px var(--s-4);
	}
	.nav-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.nav-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: 6px;
		width: 100%;
		padding: 5px var(--s-4);
		background: none;
		border: none;
		border-bottom: 1px dotted var(--rule);
		text-align: left;
		cursor: pointer;
		font-family: var(--font-serif);
		align-items: baseline;
	}
	.nav-row:hover {
		background: var(--paper-2);
	}
	.nav-row.is-closed {
		opacity: 0.6;
	}
	.nav-num {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-3);
	}
	.nav-dossier-title {
		font-size: 12px;
		color: var(--ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.nav-stage {
		font-family: var(--font-sans);
		font-size: 9px;
		color: var(--spine);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
</style>

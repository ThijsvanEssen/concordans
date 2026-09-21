<script lang="ts">
	// Lezen navigation for a dossier: its documents, newest first (the API's order).
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { dossierNumber, getDossierDocuments } from '$lib/components/parliamentary/data';
	import { formatDate } from '../_shared';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let items = $state<Schema<'DossierDocumentDTO'>[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const number = dossierNumber(node.key);
		let stale = false;
		loading = true;
		error = null;
		getDossierDocuments(number)
			.then((r) => {
				if (!stale) items = r.items;
			})
			.catch(() => {
				if (!stale) error = 'Documenten kunnen niet geladen worden.';
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});
</script>

<header class="nav-head">
	<span class="nav-kind">DOSSIER</span>
	<h3 class="nav-title">{node.label}</h3>
	{#if items.length > 0}<span class="nav-count">{items.length} documenten</span>{/if}
</header>

{#if loading && items.length === 0}
	<p class="nav-empty">Laden…</p>
{:else if error}
	<p class="nav-error">{error}</p>
{:else if items.length === 0}
	<p class="nav-empty">Geen documenten in dit dossier.</p>
{:else}
	<ol class="nav-list">
		{#each items as it (it.key)}
			<li>
				<button type="button" class="nav-row" onclick={() => onNavigate?.('documents', it.key)}>
					{#if it.kind}<span class="nav-doc-kind">{it.kind}</span>{/if}
					<span class="nav-doc-title">{it.display_name ?? it.title ?? it.key}</span>
					{#if it.date}<span class="nav-date">{formatDate(it.date)}</span>{/if}
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
		grid-template-columns: minmax(60px, auto) 1fr;
		gap: 4px 8px;
		width: 100%;
		padding: 5px var(--s-4);
		background: none;
		border: none;
		border-bottom: 1px dotted var(--rule);
		text-align: left;
		cursor: pointer;
		font-family: var(--font-serif);
	}
	.nav-row:hover {
		background: var(--paper-2);
	}
	.nav-doc-kind {
		grid-column: 1;
		grid-row: 1;
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 500;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.nav-doc-title {
		grid-column: 1 / -1;
		grid-row: 2;
		font-size: 12px;
		color: var(--ink-2);
		line-height: 1.35;
	}
	.nav-date {
		grid-column: 2;
		grid-row: 1;
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
		justify-self: end;
	}
</style>

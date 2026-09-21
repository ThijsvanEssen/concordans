<script lang="ts">
	// CitationRail for fractie: leden (LID_VAN_FRACTIE).
	// The previous "Stemgedrag" section was dropped — the node endpoint caps
	// stemmingen at a per-relation sample, so the count was misleading.
	import type { GraphNode } from '$lib/graph/types';
	import { getNodeGraph } from '$lib/api/nodes';
	import type { Neighbor } from '$lib/api/types';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let leden = $state<Neighbor[]>([]);
	let loading = $state(false);
	let showAll = $state(false);
	let token = 0;

	$effect(() => {
		const t = ++token;
		loading = true;
		getNodeGraph(node.collection, node.key, { neighborLimit: 100 })
			.then((r) => {
				if (t !== token) return;
				const all = r.neighbors?.all ?? [];
				leden = all.filter(
					(n) =>
						(n.collection === 'leden' || n.collection === 'kamerleden') &&
						n.relation === 'LID_VAN_FRACTIE'
				);
			})
			.catch(() => {
				/* ignore */
			})
			.finally(() => {
				if (t === token) loading = false;
			});
	});
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Leden</h3>
	{#if loading && leden.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if leden.length === 0}
		<p class="rail-meta">Geen leden gekoppeld.</p>
	{:else}
		<ul class="rail-list">
			{#each showAll ? leden : leden.slice(0, 12) as l (l.id)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.(l.collection, l.key)}>
						<span class="rail-name">{l.display_name ?? l.key}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if leden.length > 12 && !showAll}
			<button type="button" class="rail-more" onclick={() => (showAll = true)}>
				+{leden.length - 12} meer
			</button>
		{/if}
	{/if}
</section>

<style>
	.rail-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
		padding: 0 var(--s-4);
	}
	.rail-section-title {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		margin: var(--s-3) 0 2px;
	}
	.rail-meta {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		color: var(--ink-4);
		margin: 0;
	}
	.rail-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.rail-row {
		display: flex;
		gap: 6px;
		align-items: baseline;
		width: 100%;
		padding: 3px 0;
		border: none;
		background: none;
		border-bottom: 1px dotted var(--rule);
		cursor: pointer;
		text-align: left;
	}
	.rail-row:hover {
		background: var(--paper-2);
	}
	.rail-name {
		flex: 1;
		font-family: var(--font-serif);
		font-size: 12px;
		color: var(--ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.rail-more {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		color: var(--spine);
		background: none;
		border: none;
		padding: 3px 0;
		cursor: pointer;
		text-align: left;
	}
	.rail-more:hover {
		color: var(--ink);
	}
</style>

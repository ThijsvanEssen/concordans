<script lang="ts">
	// CitationRail for a faction: its members. There is no vote section: the node
	// endpoint returns a sample of the votes per relation, so a count would mislead.
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { getFactionMembers, str } from '$lib/components/parliamentary/data';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	const PREVIEW = 12;

	let members = $state<Schema<'NeighborDTO'>[]>([]);
	let loading = $state(false);
	let showAll = $state(false);

	$effect(() => {
		let stale = false;
		loading = true;
		getFactionMembers(node.key)
			.then((m) => {
				if (!stale) members = m;
			})
			.catch(() => {})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Leden</h3>
	{#if loading && members.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if members.length === 0}
		<p class="rail-meta">Geen leden gekoppeld.</p>
	{:else}
		<ul class="rail-list">
			{#each showAll ? members : members.slice(0, PREVIEW) as m (m.id)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.(m.collection, m.key)}>
						<span class="rail-name">{str(m.props?.name) ?? m.key}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if members.length > PREVIEW && !showAll}
			<button type="button" class="rail-more" onclick={() => (showAll = true)}>
				+{members.length - PREVIEW} meer
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

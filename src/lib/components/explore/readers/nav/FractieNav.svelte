<script lang="ts">
	// Lezen-nav for fractie kind: leden via LID_VAN_FRACTIE.
	import type { GraphNode } from '$lib/graph/types';
	import { getNodeGraph } from '$lib/api/nodes';
	import type { Neighbor } from '$lib/api/types';
	import { initials } from '$lib/util/initials';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let items = $state<Neighbor[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let token = 0;

	$effect(() => {
		const t = ++token;
		loading = true;
		error = null;
		getNodeGraph(node.collection, node.key)
			.then((r) => {
				if (t !== token) return;
				const all = r.neighbors?.all ?? [];
				items = all.filter(
					(n) =>
						(n.collection === 'leden' || n.collection === 'kamerleden') &&
						n.relation === 'LID_VAN_FRACTIE'
				);
			})
			.catch(() => {
				if (t === token) error = 'Leden kunnen niet geladen worden.';
			})
			.finally(() => {
				if (t === token) loading = false;
			});
	});
</script>

<header class="nav-head">
	<span class="nav-kind">FRACTIE</span>
	<h3 class="nav-title">{node.label}</h3>
	{#if items.length > 0}<span class="nav-count">{items.length} leden</span>{/if}
</header>

{#if loading && items.length === 0}
	<p class="nav-empty">Laden…</p>
{:else if error}
	<p class="nav-error">{error}</p>
{:else if items.length === 0}
	<p class="nav-empty">Geen leden gekoppeld.</p>
{:else}
	<ul class="nav-list">
		{#each items as it (it.id)}
			<li>
				<button type="button" class="nav-row" onclick={() => onNavigate?.(it.collection, it.key)}>
					<span class="nav-avatar" aria-hidden="true">{initials(it.display_name)}</span>
					<span class="nav-name">{it.display_name ?? it.key}</span>
				</button>
			</li>
		{/each}
	</ul>
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
		display: flex;
		align-items: center;
		gap: 8px;
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
	.nav-avatar {
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: var(--paper-3);
		border: 1px solid var(--rule);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 10px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.nav-name {
		font-size: 12px;
		color: var(--ink-2);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>

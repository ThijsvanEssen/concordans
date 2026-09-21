<script lang="ts">
	// CitationRail for a member: committees, faction and the latest votes.
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { getMemberVotes, getNeighbors } from '$lib/components/parliamentary/data';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	const VOTES_SHOWN = 8;

	type Neighbor = Schema<'NeighborDTO'>;

	let committees = $state<Neighbor[]>([]);
	let faction = $state<Neighbor | null>(null);
	let votes = $state<Schema<'MemberVoteDTO'>[]>([]);
	let totalVotes = $state(0);
	let loading = $state(false);

	$effect(() => {
		let stale = false;
		loading = true;
		Promise.all([
			getNeighbors(node.collection, node.key, 50),
			getMemberVotes(node.key).catch(() => null)
		])
			.then(([neighbors, v]) => {
				if (stale) return;
				const memberships = neighbors.filter((n) => n.relation === 'MEMBER_OF');
				committees = memberships.filter((n) => n.collection === 'committees');
				faction = memberships.find((n) => n.collection === 'factions') ?? null;
				votes = v?.votes.slice(0, VOTES_SHOWN) ?? [];
				totalVotes = v?.count ?? 0;
			})
			.catch(() => {})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Commissies</h3>
	{#if loading && committees.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if committees.length === 0}
		<p class="rail-meta">Geen commissielidmaatschap.</p>
	{:else}
		<ul class="rail-list">
			{#each committees as c (c.id)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.(c.collection, c.key)}>
						<span class="rail-name">{c.display_name ?? c.key}</span>
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="rail-section">
	<h3 class="rail-section-title">Fractie</h3>
	{#if !faction}
		<p class="rail-meta">Geen fractie geregistreerd.</p>
	{:else}
		<button
			type="button"
			class="rail-row"
			onclick={() => faction && onNavigate?.(faction.collection, faction.key)}
		>
			<span class="rail-name">{faction.display_name ?? faction.key}</span>
		</button>
	{/if}
</section>

<section class="rail-section">
	<h3 class="rail-section-title">
		Recent stemgedrag{#if totalVotes > 0}
			· {totalVotes}{/if}
	</h3>
	{#if loading && votes.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if votes.length === 0}
		<p class="rail-meta">Geen stemmen geregistreerd.</p>
	{:else}
		<ul class="rail-list">
			{#each votes as v (v.decision_id)}
				<li>
					<button
						type="button"
						class="rail-row"
						onclick={() => onNavigate?.('decisions', v.decision_key)}
					>
						<span class="rail-name">{v.subject ?? '—'}</span>
						<span
							class="rail-rel"
							class:rail-rel--voor={v.choice === 'Voor'}
							class:rail-rel--tegen={v.choice === 'Tegen'}
						>
							{v.choice}
						</span>
					</button>
				</li>
			{/each}
		</ul>
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
		align-items: flex-start;
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
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.rail-rel {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
		flex-shrink: 0;
	}
	.rail-rel--voor {
		color: var(--green, #16a34a);
	}
	.rail-rel--tegen {
		color: var(--red, #dc2626);
	}
</style>

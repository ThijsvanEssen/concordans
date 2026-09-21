<script lang="ts">
	// Lezen navigation for a member: the recorded votes. No edge runs from a
	// member to a document, so the votes are the only member-specific activity.
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { getMemberVotes } from '$lib/components/parliamentary/data';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let items = $state<Schema<'MemberVoteDTO'>[]>([]);
	let total = $state(0);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		let stale = false;
		loading = true;
		error = null;
		getMemberVotes(node.key)
			.then((r) => {
				if (stale) return;
				items = r.votes;
				total = r.count;
			})
			.catch(() => {
				if (!stale) error = 'Stemgedrag kan niet geladen worden.';
			})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});
</script>

<header class="nav-head">
	<span class="nav-kind">KAMERLID</span>
	<h3 class="nav-title">{node.label}</h3>
	{#if total > 0}<span class="nav-count">{total} geregistreerde stem{total === 1 ? '' : 'men'}</span
		>{/if}
</header>

{#if loading && items.length === 0}
	<p class="nav-empty">Laden…</p>
{:else if error}
	<p class="nav-error">{error}</p>
{:else if items.length === 0}
	<p class="nav-empty">Geen stemmen geregistreerd voor dit lid.</p>
{:else}
	<ol class="nav-list">
		{#each items as v (v.decision_id)}
			<li>
				<button
					type="button"
					class="nav-row"
					onclick={() => onNavigate?.('decisions', v.decision_key)}
				>
					<span
						class="nav-choice"
						class:nav-choice--voor={v.choice === 'Voor'}
						class:nav-choice--tegen={v.choice === 'Tegen'}
					>
						{v.choice}
					</span>
					<span class="nav-vote-subject">{v.subject ?? '—'}</span>
					{#if v.date}<span class="nav-date">{v.date.slice(0, 10)}</span>{/if}
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
		grid-template-columns: minmax(60px, auto) 1fr auto;
		gap: 4px 8px;
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
	.nav-choice {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-4);
	}
	.nav-choice--voor {
		color: #2e6f3a;
	}
	.nav-choice--tegen {
		color: #8a2a2a;
	}
	.nav-vote-subject {
		font-size: 12px;
		color: var(--ink-2);
		line-height: 1.35;
	}
	.nav-date {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
		justify-self: end;
	}
</style>

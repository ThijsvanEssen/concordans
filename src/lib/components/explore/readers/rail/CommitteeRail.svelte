<script lang="ts">
	// CitationRail for a committee: open dossiers and current members.
	import type { GraphNode } from '$lib/graph/types';
	import type { Schema } from '$lib/api/types';
	import { committeeSlug, getCommittee } from '$lib/components/parliamentary/data';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	const PREVIEW = 10;

	let committee = $state<Schema<'CommitteeDetailDTO'> | null>(null);
	let loading = $state(false);
	let showAllDossiers = $state(false);
	let showAllMembers = $state(false);

	$effect(() => {
		const slug = committeeSlug(node);
		let stale = false;
		showAllDossiers = showAllMembers = false;
		if (!slug) return;
		loading = true;
		getCommittee(slug)
			.then((c) => {
				if (!stale) committee = c;
			})
			.catch(() => {})
			.finally(() => {
				if (!stale) loading = false;
			});
		return () => (stale = true);
	});

	const open = $derived(committee?.dossiers?.filter((d) => !d.closed) ?? []);
	const members = $derived(committee?.members ?? []);
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Lopende dossiers</h3>
	{#if loading && !committee}
		<p class="rail-meta">Laden…</p>
	{:else if open.length === 0}
		<p class="rail-meta">Geen open dossiers.</p>
	{:else}
		<ul class="rail-list">
			{#each showAllDossiers ? open : open.slice(0, PREVIEW) as d (d.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.('dossiers', d.key)}>
						<span class="rail-num">{d.number}</span>
						<span class="rail-name">{d.title ?? d.number}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if open.length > PREVIEW && !showAllDossiers}
			<button type="button" class="rail-more" onclick={() => (showAllDossiers = true)}>
				+{open.length - PREVIEW} meer
			</button>
		{/if}
	{/if}
</section>

<section class="rail-section">
	<h3 class="rail-section-title">Huidige leden</h3>
	{#if loading && !committee}
		<p class="rail-meta">Laden…</p>
	{:else if members.length === 0}
		<p class="rail-meta">Geen actieve leden.</p>
	{:else}
		<ul class="rail-list">
			{#each showAllMembers ? members : members.slice(0, PREVIEW) as m (m.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.('members', m.key)}>
						<span class="rail-name">{m.name ?? m.key}</span>
						{#if m.party}<span class="rail-rel">{m.party}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
		{#if members.length > PREVIEW && !showAllMembers}
			<button type="button" class="rail-more" onclick={() => (showAllMembers = true)}>
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
	.rail-num {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-3);
		flex-shrink: 0;
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
	.rail-rel {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
		flex-shrink: 0;
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

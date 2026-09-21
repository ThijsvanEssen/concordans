<script lang="ts">
	// CitationRail for a dossier:
	//   - Wijzigt artikelen: the articles the dossier's documents point at.
	//   - Behandeld door commissie: the committees of the dossier's activities
	//     (no edge runs from a committee to a dossier; an activity is LED_BY one).
	import type { GraphNode } from '$lib/graph/types';
	import { api, unwrap } from '$lib/api/client';
	import {
		dossierNumber,
		getDossierMutations,
		getNeighbors,
		mutatedArticles,
		type MutatedArticle
	} from '$lib/components/parliamentary/data';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type CommitteeRow = { key: string; label: string };

	let articles = $state<MutatedArticle[]>([]);
	let committees = $state<CommitteeRow[]>([]);
	let loading = $state(false);
	let showAllCommittees = $state(false);

	$effect(() => {
		const ac = new AbortController();
		loading = true;
		showAllCommittees = false;
		Promise.all([
			getDossierMutations(dossierNumber(node.key)).catch(() => null),
			getNeighbors(node.collection, node.key, 100).catch(() => []),
			unwrap(api.GET('/api/committees', { signal: ac.signal })).catch(() => [])
		]).then(([mutations, neighbors, all]) => {
			if (ac.signal.aborted) return;
			articles = mutations ? mutatedArticles(mutations) : [];

			// An activity names its committee by GUID with hyphens, a committee node key uses underscores.
			const ids = new Set<string>();
			for (const n of neighbors) {
				const id = n.collection === 'activities' ? n.props?.committee_id : null;
				if (typeof id === 'string' && id) ids.add(id.replaceAll('-', '_'));
			}
			committees = all
				.filter((c) => ids.has(c.key))
				.map((c) => ({ key: c.key, label: c.name ?? c.abbreviation ?? c.key }))
				.sort((a, b) => a.label.localeCompare(b.label));
			loading = false;
		});
	});
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Wijzigt artikelen</h3>
	{#if loading && articles.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if articles.length === 0}
		<p class="rail-meta">Geen artikelen.</p>
	{:else}
		<ul class="rail-list">
			{#each articles.slice(0, 10) as a (a.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.('articles', a.key)}>
						<span class="rail-name">{a.label}</span>
						{#if a.relation}<span class="rail-rel">{a.relation}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="rail-section">
	<h3 class="rail-section-title">Behandeld door commissie</h3>
	{#if loading && committees.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if committees.length === 0}
		<p class="rail-meta">Geen commissie gevonden.</p>
	{:else}
		<ul class="rail-list">
			{#each showAllCommittees ? committees : committees.slice(0, 8) as c (c.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.('committees', c.key)}>
						<span class="rail-name">{c.label}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if committees.length > 8 && !showAllCommittees}
			<button type="button" class="rail-more" onclick={() => (showAllCommittees = true)}>
				+{committees.length - 8} meer
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

<script lang="ts">
	// CitationRail for dossier kind:
	//   • Wijzigt artikelen   — from DossierMutations (article-typed targets)
	//   • Behandeld door commissie — derived from activiteit.commissie_id on the
	//     dossier's activiteit-neighbours, resolved against /api/commissies.
	//     No direct commissie → dossier edge exists in the graph.
	// The previous "Indieners" section was removed: lid → dossier edges aren't
	// modelled, so the section was always empty.
	import type { GraphNode } from '$lib/graph/types';
	import { fetchDossierMutations, fetchCommissies } from '$lib/api/parliamentary-client';
	import { getNodeGraph } from '$lib/api/nodes';
	import type { CommissieDTO, DossierMutationsResponse } from '$lib/api/parliamentary';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	type CommissieRow = { key: string; slug: string | null; label: string };

	let mutations = $state<DossierMutationsResponse | null>(null);
	let commissies = $state<CommissieRow[]>([]);
	let loading = $state(false);
	let showAllCommissies = $state(false);
	let token = 0;

	$effect(() => {
		const t = ++token;
		loading = true;
		Promise.all([
			fetchDossierMutations(node.key).catch(() => null),
			getNodeGraph(node.collection, node.key, { neighborLimit: 100 }).catch(() => null),
			fetchCommissies().catch(() => [] as CommissieDTO[])
		]).then(([m, g, all]) => {
			if (t !== token) return;
			mutations = m;

			const ids = new Set<string>();
			for (const n of g?.neighbors?.all ?? []) {
				if (n.collection !== 'activiteiten') continue;
				const cid = (n.props as Record<string, unknown> | null)?.['commissie_id'];
				if (typeof cid === 'string' && cid) ids.add(cid);
			}

			// Commissie node keys are uuid-with-underscores; activity commissie_id is uuid-with-hyphens.
			const byKey = new Map(all.map((c) => [c.key, c]));
			const resolved: CommissieRow[] = [];
			for (const cid of ids) {
				const key = cid.replace(/-/g, '_');
				const c = byKey.get(key);
				if (!c) continue;
				resolved.push({
					key: c.slug ?? c.key,
					slug: c.slug ?? null,
					label: c.naam ?? c.afkorting ?? c.key
				});
			}
			resolved.sort((a, b) => a.label.localeCompare(b.label));
			commissies = resolved;

			loading = false;
		});
	});

	const articleTargets = $derived.by(() => {
		const m = mutations;
		if (!m)
			return [] as { key: string; collection: string; label: string; relation: string | null }[];
		const seen = new Map<
			string,
			{ key: string; collection: string; label: string; relation: string | null }
		>();
		for (const e of m.edges) {
			if (!e.to_id) continue;
			const t = m.nodes.find((n) => n.id === e.to_id);
			if (!t || t.collection !== 'instrument_articles') continue;
			if (seen.has(t.id)) continue;
			seen.set(t.id, {
				key: t.key,
				collection: t.collection,
				label: t.display_name ?? t.key,
				relation: e.relation
			});
		}
		return [...seen.values()];
	});
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Wijzigt artikelen</h3>
	{#if loading && articleTargets.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if articleTargets.length === 0}
		<p class="rail-meta">Geen artikelen.</p>
	{:else}
		<ul class="rail-list">
			{#each articleTargets.slice(0, 10) as a (a.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.(a.collection, a.key)}>
						<span class="rail-name">{a.label}</span>
						{#if a.relation}<span class="rail-rel">{a.relation.toLowerCase()}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
	{/if}
</section>

<section class="rail-section">
	<h3 class="rail-section-title">Behandeld door commissie</h3>
	{#if loading && commissies.length === 0}
		<p class="rail-meta">Laden…</p>
	{:else if commissies.length === 0}
		<p class="rail-meta">Geen commissie gevonden.</p>
	{:else}
		<ul class="rail-list">
			{#each showAllCommissies ? commissies : commissies.slice(0, 8) as c (c.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.('commissies', c.key)}>
						<span class="rail-name">{c.label}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if commissies.length > 8 && !showAllCommissies}
			<button type="button" class="rail-more" onclick={() => (showAllCommissies = true)}>
				+{commissies.length - 8} meer
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

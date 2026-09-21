<script lang="ts">
	// CitationRail for commissie: lopende dossiers + leden.
	import type { GraphNode } from '$lib/graph/types';
	import { fetchCommissie } from '$lib/api/parliamentary-client';
	import type { CommissieDetailDTO } from '$lib/api/parliamentary';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let c = $state<CommissieDetailDTO | null>(null);
	let loading = $state(false);
	let showAllDossiers = $state(false);
	let showAllLeden = $state(false);
	let token = 0;

	$effect(() => {
		const t = ++token;
		loading = true;
		showAllDossiers = false;
		showAllLeden = false;
		fetchCommissie(node.key)
			.then((r) => {
				if (t === token) c = r;
			})
			.catch(() => {
				/* ignore */
			})
			.finally(() => {
				if (t === token) loading = false;
			});
	});

	const open = $derived(c ? c.dossiers.filter((d) => !d.afgedaan) : []);
</script>

<section class="rail-section">
	<h3 class="rail-section-title">Lopende dossiers</h3>
	{#if loading && !c}
		<p class="rail-meta">Laden…</p>
	{:else if open.length === 0}
		<p class="rail-meta">Geen open dossiers.</p>
	{:else}
		{@const shown = showAllDossiers ? open : open.slice(0, 10)}
		<ul class="rail-list">
			{#each shown as d (d.key)}
				<li>
					<button
						type="button"
						class="rail-row"
						onclick={() => onNavigate?.('kamerstukdossiers', d.key)}
					>
						<span class="rail-num">{d.kamerstuknummer}</span>
						<span class="rail-name">{d.titel ?? d.kamerstuknummer}</span>
					</button>
				</li>
			{/each}
		</ul>
		{#if open.length > 10 && !showAllDossiers}
			<button type="button" class="rail-more" onclick={() => (showAllDossiers = true)}>
				+{open.length - 10} meer
			</button>
		{/if}
	{/if}
</section>

<section class="rail-section">
	<h3 class="rail-section-title">Huidige leden</h3>
	{#if !c}
		<p class="rail-meta">Laden…</p>
	{:else if c.leden.length === 0}
		<p class="rail-meta">Geen actieve leden.</p>
	{:else}
		{@const shownLeden = showAllLeden ? c.leden : c.leden.slice(0, 10)}
		<ul class="rail-list">
			{#each shownLeden as lid (lid.key)}
				<li>
					<button type="button" class="rail-row" onclick={() => onNavigate?.('leden', lid.key)}>
						<span class="rail-name">{lid.naam ?? lid.key}</span>
						{#if lid.partij}<span class="rail-rel">{lid.partij}</span>{/if}
					</button>
				</li>
			{/each}
		</ul>
		{#if c.leden.length > 10 && !showAllLeden}
			<button type="button" class="rail-more" onclick={() => (showAllLeden = true)}>
				+{c.leden.length - 10} meer
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

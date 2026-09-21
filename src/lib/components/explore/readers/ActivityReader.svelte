<script lang="ts">
	// Reader for activiteit nodes — commissiedebatten, plenaire debatten,
	// procedurevergaderingen. Backend has no /activiteiten/{key} endpoint, so
	// we render from the node's own props (already loaded as raw on click)
	// plus a graph fetch for related dossier / commissie / publication links.
	import type { GraphNode } from '$lib/graph/types';
	import { getNodeGraph } from '$lib/api/nodes';
	import type { Neighbor } from '$lib/api/types';
	import { formatLongDate } from './_shared';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let neighbors = $state<Neighbor[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let token = 0;

	$effect(() => {
		const n = node;
		const t = ++token;
		loading = true;
		error = null;
		getNodeGraph(n.collection, n.key)
			.then((r) => {
				if (t === token) neighbors = r.neighbors?.all ?? [];
			})
			.catch(() => {
				if (t === token) error = 'Kon gerelateerde informatie niet laden.';
			})
			.finally(() => {
				if (t === token) loading = false;
			});
	});

	const nodeProps = $derived((node.raw?.props ?? {}) as Record<string, unknown>);
	const datum = $derived((nodeProps['datum'] as string | null) ?? null);
	const soort = $derived((nodeProps['soort'] as string | null) ?? null);
	const agenda = $derived((nodeProps['agenda_titel'] as string | null) ?? null);
	const tkUrl = $derived((nodeProps['tk_url'] as string | null) ?? null);
	const dossierNummers = $derived((nodeProps['dossier_nummers'] as string[] | null) ?? []);

	const dossiers = $derived(
		neighbors.filter((nb) => nb.collection === 'kamerstukdossiers' || nb.collection === 'dossiers')
	);
	const commissies = $derived(neighbors.filter((nb) => nb.collection === 'commissies'));
	const publications = $derived(neighbors.filter((nb) => nb.collection === 'publications'));
</script>

<div class="r-activity">
	{#if loading}
		<p class="r-status">Laden…</p>
	{:else if error}
		<p class="r-status r-status--error">{error}</p>
	{/if}
	<header class="head">
		<span class="kicker">
			{soort ?? 'Activiteit'}
			{#if datum}<span class="dot">·</span>{formatLongDate(datum)}{/if}
		</span>
		<h2 class="title">{agenda || node.label}</h2>
	</header>

	{#if commissies.length > 0}
		<section class="sec">
			<h3 class="sec-title">Commissie</h3>
			<ul class="ref-list">
				{#each commissies as c (c.id)}
					<li>
						<button type="button" class="ref-row" onclick={() => onNavigate?.(c.collection, c.key)}>
							<span class="ref-name">{c.display_name ?? c.key}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if dossiers.length > 0 || dossierNummers.length > 0}
		<section class="sec">
			<h3 class="sec-title">Behandelde dossiers</h3>
			<ul class="ref-list">
				{#if dossiers.length > 0}
					{#each dossiers as d (d.id)}
						<li>
							<button
								type="button"
								class="ref-row"
								onclick={() => onNavigate?.(d.collection, d.key)}
							>
								<span class="ref-name">{d.display_name ?? d.key}</span>
							</button>
						</li>
					{/each}
				{:else}
					{#each dossierNummers as nr, i (i)}
						<li>
							<button
								type="button"
								class="ref-row"
								onclick={() => onNavigate?.('kamerstukdossiers', nr)}
							>
								<span class="ref-name">Kamerstuk {nr}</span>
							</button>
						</li>
					{/each}
				{/if}
			</ul>
		</section>
	{/if}

	{#if publications.length > 0}
		<section class="sec">
			<h3 class="sec-title">Bijbehorende publicaties ({publications.length})</h3>
			<ul class="ref-list">
				{#each publications as p (p.id)}
					{@const psoort = (p.props as Record | null)?.['soort'] as string | null}
					<li>
						<button type="button" class="ref-row" onclick={() => onNavigate?.(p.collection, p.key)}>
							{#if psoort}<span class="ref-soort">{psoort}</span>{/if}
							<span class="ref-name">{p.display_name ?? p.key}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if tkUrl}
		<footer class="foot">
			<a href={tkUrl} target="_blank" rel="noopener noreferrer" class="full-link">
				Open op tweedekamer.nl →
			</a>
		</footer>
	{/if}
</div>

<style>
	.r-activity {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-5) var(--s-6);
		color: var(--ink-2);
		height: 100%;
		overflow-y: auto;
	}
	.r-status {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-4);
		margin: 0;
		font-size: 13px;
	}
	.r-status--error {
		color: var(--spine);
		font-style: normal;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		display: flex;
		gap: 5px;
		align-items: baseline;
	}
	.dot {
		opacity: 0.6;
	}
	.title {
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.3;
	}

	.sec {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.sec-title {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		margin: 0;
	}
	.ref-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.ref-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		width: 100%;
		padding: 4px 0;
		border: none;
		background: none;
		border-bottom: 1px dotted var(--rule);
		cursor: pointer;
		text-align: left;
		font-family: var(--font-serif);
	}
	.ref-row:hover {
		background: var(--paper-2);
	}
	.ref-soort {
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-4);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.ref-name {
		flex: 1;
		font-size: 13px;
		color: var(--ink-2);
		overflow-wrap: anywhere;
		line-height: 1.4;
	}

	.foot {
		display: flex;
	}
	.full-link {
		font-family: var(--font-sans);
		font-size: 12px;
		color: var(--spine);
		text-decoration: none;
		border-bottom: 1px solid var(--spine-faint);
	}
	.full-link:hover {
		border-bottom-color: var(--spine);
	}
</style>

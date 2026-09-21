<script lang="ts">
	// Reader for an activity: a committee debate, plenary debate or procedural
	// meeting. There is no endpoint for one activity, so the node's own props
	// are shown, plus its committee and dossiers from the neighbours.
	import type { GraphNode } from '$lib/graph/types';
	import { getNodeGraph } from '$lib/api/nodes';
	import type { Schema } from '$lib/api/types';
	import { formatLongDate } from './_shared';

	let {
		node,
		onNavigate
	}: {
		node: GraphNode;
		onNavigate?: (collection: string, key: string) => void;
	} = $props();

	let neighbors = $state<Schema<'NeighborDTO'>[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	$effect(() => {
		const ac = new AbortController();
		loading = true;
		error = null;
		getNodeGraph(node.collection, node.key, { signal: ac.signal })
			.then((r) => {
				neighbors = r.neighbors.all ?? [];
			})
			.catch(() => {
				if (!ac.signal.aborted) error = 'Kon gerelateerde informatie niet laden.';
			})
			.finally(() => {
				if (!ac.signal.aborted) loading = false;
			});
		return () => ac.abort();
	});

	// The schema leaves node props untyped.
	const attrs = $derived(
		(node.raw?.props ?? {}) as {
			kind?: string;
			date?: string;
			agenda_title?: string;
			tk_url?: string;
			dossier_numbers?: string[];
		}
	);
	const committees = $derived(neighbors.filter((n) => n.relation === 'LED_BY'));
	// The neighbours cap the dossiers of a plenary debate; the prop lists them all.
	const dossierNumbers = $derived(attrs.dossier_numbers ?? []);
</script>

<div class="r-activity">
	{#if loading}
		<p class="r-status">Laden…</p>
	{:else if error}
		<p class="r-status r-status--error">{error}</p>
	{/if}
	<header class="head">
		<span class="kicker">
			{attrs.kind ?? 'Activiteit'}
			{#if attrs.date}<span class="dot">·</span>{formatLongDate(attrs.date)}{/if}
		</span>
		<h2 class="title">{attrs.agenda_title || node.label}</h2>
	</header>

	{#if committees.length > 0}
		<section class="sec">
			<h3 class="sec-title">Commissie</h3>
			<ul class="ref-list">
				{#each committees as c (c.id)}
					<li>
						<button type="button" class="ref-row" onclick={() => onNavigate?.(c.collection, c.key)}>
							<span class="ref-name">{c.display_name ?? c.key}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if dossierNumbers.length > 0}
		<section class="sec">
			<h3 class="sec-title">Behandelde dossiers</h3>
			<ul class="ref-list">
				{#each dossierNumbers as number (number)}
					<li>
						<button type="button" class="ref-row" onclick={() => onNavigate?.('dossiers', number)}>
							<span class="ref-name">Kamerstuk {number}</span>
						</button>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if attrs.tk_url}
		<footer class="foot">
			<a href={attrs.tk_url} target="_blank" rel="noopener noreferrer" class="full-link">
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

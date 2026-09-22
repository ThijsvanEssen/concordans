<script lang="ts">
	// The verbindingen of the selected bron, in the groups of the table in groups.ts.
	// In the network the same groups are the layers: a group puts its bronnen on the
	// canvas or takes them off.
	import { page } from '$app/state';
	import { bronHref, refId } from '$lib/bron/href';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bucketTotals, neighborsOf } from '$lib/api/nodes';
	import type { GraphStore } from '$lib/graph/graph-store';
	import type { CanvasRow } from '$lib/graph/store/types';
	import type { GraphNode } from '$lib/graph/types';
	import { buildGroups, countLabel, type Group } from './groups';
	import { LOADERS } from './loaders';
	import type { Row } from './rows';

	let {
		store,
		selection,
		network = false
	}: {
		store: GraphStore;
		selection: GraphNode;
		/** The canvas is on screen: groups carry their layer control. */
		network?: boolean;
	} = $props();

	const PREVIEW = 6;

	let groups = $state<Group[]>([]);
	let failed = $state(false);
	let expanded = $state(new Set<string>());
	let collapsed = $state(new Set<string>());

	let onCanvas = $state(new Set<string>());
	$effect(() => store.nodes.subscribe((ns) => (onCanvas = new Set(ns.map((n) => n.id)))));

	// Primitives, so that a new selection object for the same bron does not reload.
	const collection = $derived(selection.collection);
	const key = $derived(selection.key);

	$effect(() => {
		const ac = new AbortController();
		groups = [];
		failed = false;
		expanded = new Set();
		collapsed = new Set();
		store
			.nodeResponse(collection, key)
			.then((response) => {
				if (ac.signal.aborted) return;
				const neighbors = neighborsOf(response);
				groups = buildGroups(collection, neighbors, bucketTotals(response));
				const ctx = {
					node: response.node,
					neighbors,
					totals: bucketTotals(response),
					nodeResponse: store.nodeResponse,
					signal: ac.signal
				};
				for (const def of groups) {
					if (!def.load) continue;
					LOADERS[def.load](ctx)
						.then(({ rows, total }) => {
							if (ac.signal.aborted) return;
							groups = groups.map((g) => (g.id === def.id ? { ...g, rows, total } : g));
						})
						.catch(() => {
							// A group that cannot be filled is left out, like an empty one.
						});
				}
			})
			.catch(() => {
				if (!ac.signal.aborted) failed = true;
			});
		return () => ac.abort();
	});

	const shown = $derived(groups.filter((g) => g.rows.length > 0));

	function toggle(set: Set<string>, id: string) {
		const next = new Set(set);
		if (!next.delete(id)) next.add(id);
		return next;
	}

	const drawable = (rows: Row[]) => rows.filter((r) => r.relation && r.direction);
	const isLayerOn = (g: Group) => {
		const rows = drawable(g.rows);
		return rows.length > 0 && rows.every((r) => onCanvas.has(refId(r.ref)));
	};

	function toggleLayer(g: Group) {
		const rows = drawable(g.rows);
		if (isLayerOn(g)) store.hideRows(rows.map((r) => refId(r.ref)));
		else store.showRows(selection.id, rows as CanvasRow[]);
	}

	// A row of an in-place group opens beside the selected bron, which stays selected.
	function inPlaceHref(row: Row) {
		const url = new URL(page.url);
		url.searchParams.set('naast', refId(row.ref));
		url.hash = '';
		return `${url.pathname}?${url.searchParams.toString().replaceAll('%2F', '/')}`;
	}
</script>

<aside class="verbonden" aria-label="Verbonden">
	{#if failed}
		<p class="verbonden__note">Verbindingen niet geladen.</p>
	{/if}
	{#each shown as g, i (g.id)}
		{@const open = !collapsed.has(g.id)}
		{@const all = expanded.has(g.id)}
		{#if g.section && g.section !== shown[i - 1]?.section}
			<h3 class="verbonden__section">{g.section}</h3>
		{/if}
		<section class="group">
			<div class="group__head">
				<button
					type="button"
					class="group__toggle"
					aria-expanded={open}
					onclick={() => (collapsed = toggle(collapsed, g.id))}
				>
					<span class="group__chevron" class:is-closed={!open} aria-hidden="true">›</span>
					<span class="group__label">{g.label}</span>
					<span class="group__count">{countLabel(g)}</span>
				</button>
				{#if network && drawable(g.rows).length > 0}
					<button
						type="button"
						class="group__layer"
						class:is-on={isLayerOn(g)}
						aria-pressed={isLayerOn(g)}
						aria-label="{g.label} in het netwerk"
						onclick={() => toggleLayer(g)}
					>
						<KindGlyph collection={g.rows[0].ref.collection} size={11} />
					</button>
				{/if}
			</div>
			{#if open}
				<ul class="group__rows">
					{#each all ? g.rows : g.rows.slice(0, PREVIEW) as row (refId(row.ref))}
						<li>
							<a
								class="row"
								href={g.inPlace ? inPlaceHref(row) : bronHref(row.ref, { at: row.at })}
								data-sveltekit-noscroll
							>
								<KindGlyph collection={row.ref.collection} />
								<span class="row__text">
									<span class="row__title">{row.title}</span>
									{#if row.context || row.proposed}
										<span class="row__context">
											{row.context}
											{#if row.proposed}<span class="row__tag">voorgesteld</span>{/if}
										</span>
									{/if}
								</span>
								{#if row.derived}
									<span class="derived" role="img" aria-label="afgeleid">≈</span>
								{/if}
							</a>
						</li>
					{/each}
				</ul>
				{#if g.rows.length > PREVIEW}
					<button
						type="button"
						class="group__more"
						onclick={() => (expanded = toggle(expanded, g.id))}
					>
						{all ? 'Minder' : `Alle ${g.rows.length}`}
					</button>
				{/if}
			{/if}
		</section>
	{/each}
</aside>

<style>
	.verbonden {
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-4) 0 var(--s-6);
		height: 100%;
		overflow-y: auto;
		font-family: var(--font-sans);
	}
	.verbonden__note {
		margin: 0;
		padding: 0 var(--s-4);
		font-size: 12px;
		color: var(--ink-4);
	}
	.verbonden__section {
		margin: var(--s-2) 0 0;
		padding: 0 var(--s-4);
		font-family: var(--font-serif);
		font-size: 13px;
		font-weight: 500;
		font-style: italic;
		color: var(--ink-3);
	}
	.group {
		display: flex;
		flex-direction: column;
	}
	.group__head {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 0 var(--s-3) 0 var(--s-4);
	}
	.group__toggle {
		flex: 1;
		min-width: 0;
		display: flex;
		align-items: baseline;
		gap: 6px;
		padding: 4px 0;
		background: none;
		border: 0;
		cursor: pointer;
		text-align: left;
		font: inherit;
		color: var(--ink-3);
	}
	.group__chevron {
		display: inline-block;
		width: 8px;
		transform: rotate(90deg);
		transition: transform var(--dur-1) var(--ease);
		color: var(--ink-4);
	}
	.group__chevron.is-closed {
		transform: none;
	}
	.group__label {
		font-size: 10px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.group__count {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
	}
	.group__layer {
		display: grid;
		place-items: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		background: none;
		cursor: pointer;
		opacity: 0.45;
	}
	.group__layer:hover {
		opacity: 0.8;
	}
	.group__layer.is-on {
		opacity: 1;
		background: var(--paper);
		border-color: var(--ink-3);
	}
	.group__rows {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 5px var(--s-4);
		text-decoration: none;
		color: var(--ink-2);
	}
	.row:hover,
	.row:focus-visible {
		background: var(--accent-soft);
		outline: none;
	}
	.row__text {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
	}
	.row__title {
		font-family: var(--font-serif);
		font-size: 14px;
		line-height: 1.3;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}
	.row__context {
		font-size: 11px;
		color: var(--ink-4);
	}
	.row__tag {
		margin-left: 4px;
		padding: 0 4px;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-size: 10px;
	}
	.derived {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
	}
	.group__more {
		align-self: flex-start;
		margin: 2px 0 0 var(--s-4);
		padding: 2px 0;
		background: none;
		border: 0;
		cursor: pointer;
		font: inherit;
		font-size: 11px;
		color: var(--accent);
	}
</style>

<script lang="ts">
	// The right column of ⌘K on a wide screen: the bron the keys are on, so it is chosen without
	// opening it (palette-preview.ts); under it what Enter does, in words, and what else can be done
	// with it, each with its key. Where nothing is chosen, what Enter does then. A phone has the
	// one column without it. Its foot stands still whatever comes in above it.
	import KeyCaps from '$lib/keys/KeyCaps.svelte';
	import { SHORTCUTS } from '$lib/keys/register';
	import type { DoRow } from '$lib/keys/doen.svelte';
	import { report } from '$lib/api/errors';
	import { page } from '$app/state';
	import { modeOf } from '$lib/bron/href';
	import type { ChosenBron } from './targets';
	import {
		collectionOfBron,
		rowSaysAll,
		loadPalettePreview,
		whatOpens,
		previewOfBron,
		type PreviewRest
	} from './palette-preview';

	let {
		row = null,
		bron = null,
		actions = [],
		query = '',
		opens = true,
		cited = null,
		ondo
	}: {
		/** A row Doen or Hier the keys are on. */
		row?: DoRow | null;
		/** Else the bron of the result the keys are on. */
		bron?: ChosenBron | null;
		/** What else can be done with that bron (keten, netwerk, verband, toevoegen). */
		actions?: readonly DoRow[];
		/** Else what Enter searches for; '' where there is no page of results to go to. */
		query?: string;
		/** Enter opens that bron; not where only the pointer is on it. */
		opens?: boolean;
		/** The citation Enter opens then, by its name. */
		cited?: string | null;
		ondo: (row: DoRow) => void;
	} = $props();

	/** Keys walk fast over a list: a row the keys only pass asks nothing. */
	const REST_MS = 120;

	let loaded = $state.raw<{ bron: ChosenBron; rest: PreviewRest | null } | null>(null);
	const rest = $derived(loaded?.bron === bron ? loaded.rest : null);
	const loading = $derived(!!bron && !rowSaysAll(bron) && !(loaded?.bron === bron && rest));
	const data = $derived(bron ? previewOfBron(bron, query, rest) : null);

	$effect(() => {
		const asked = bron;
		if (!asked || rowSaysAll(asked)) return;
		let stale = false;
		const timer = setTimeout(() => {
			loadPalettePreview(asked)
				.then((answer) => {
					if (!stale) loaded = { bron: asked, rest: answer };
				})
				.catch((e) => {
					report('Voorbeeld', e);
					if (!stale) loaded = { bron: asked, rest: { card: null, first: null, standing: [] } };
				});
		}, REST_MS);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
	});

	/** Where Enter opens it: a bron opens in the view that stands (bronHref). */
	const where = $derived(modeOf(page.url) === 'graph' ? 'in het netwerk' : 'in de lezer');
	const collection = $derived(bron ? collectionOfBron(bron) : null);

	const comboOf = (id: string | undefined) => SHORTCUTS.find((s) => s.id === id)?.keys[0];
	const whatEnterDoes = (r: DoRow) =>
		r.fill !== undefined
			? 'en typ verder'
			: r.group === 'Recent'
				? 'gaat hierheen terug'
				: 'voert dit uit';
</script>

{#snippet keyOf(r: DoRow)}{@const combo = comboOf(r.key)}{#if combo}<span class="combo"
			><KeyCaps {combo} /></span
		>{/if}{/snippet}

<aside class="preview" aria-label="Voorbeeld">
	{#if row}
		<div class="bron">
			{#if row.group}<p class="kind">{row.group}</p>{/if}
			<p class="title">{row.label}</p>
		</div>
		<div class="foot">
			{#if row.why}
				<p class="line quiet">{row.why}</p>
			{:else if row.now}
				<p class="line quiet">Zo staat het nu.</p>
			{:else}
				<p class="line"><kbd>Enter</kbd> {whatEnterDoes(row)}</p>
			{/if}
			{#if row.key || row.word}
				<p class="line quiet">
					{#if row.key}Of {@render keyOf(row)}{/if}{#if row.key && row.word}, typ{:else if row.word}Typ{/if}
					{#if row.word}<code>{row.word}</code>{/if}
				</p>
			{/if}
		</div>
	{:else if data && collection}
		<div class="bron">
			<p class="kind">{data.kind}</p>
			<p class="title">{data.name}</p>
			<!-- Its place is held, also while the passage comes and where there is none. -->
			<div class="rest">
				{#if data.status}<p class="line">{data.status}</p>{/if}
				{#each data.places as line (line)}<p class="line quiet">{line}</p>{/each}
				<div class="passage">
					{#if data.passage}
						<p>
							{#each data.passage as part, n (n)}{#if part.mark}<mark>{part.text}</mark
									>{:else}{part.text}{/if}{/each}
						</p>
					{:else if loading}
						<p class="quiet" role="status">laden…</p>
					{/if}
				</div>
			</div>
		</div>
		<div class="foot">
			{#if opens}
				<p class="line"><kbd>Enter</kbd> opent {whatOpens(collection)} {where}</p>
			{:else if cited}
				<p class="line"><kbd>Enter</kbd> opent {cited}</p>
			{:else}
				<p class="line"><kbd>Enter</kbd> zoekt "{query}" op de zoekpagina</p>
			{/if}
			{#if actions.length}
				<ul class="actions">
					{#each actions as a (a.id)}
						<li>
							<button type="button" tabindex="-1" onclick={() => ondo(a)}>{a.label}</button>
							{@render keyOf(a)}
						</li>
					{/each}
				</ul>
			{/if}
		</div>
	{:else if query}
		<div class="bron">
			<p class="line"><kbd>Enter</kbd> zoekt "{query}" op de zoekpagina</p>
			<p class="line quiet"><kbd>↓</kbd> kiest een regel uit de lijst</p>
		</div>
	{/if}
</aside>

<style>
	.preview {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-3);
		padding: var(--s-3) var(--s-4);
		border-left: 1px solid var(--rule);
		background: var(--paper-2);
		overflow: hidden;
		font-family: var(--font-serif);
		overflow-wrap: anywhere;
	}
	.bron {
		flex: 1;
		min-height: 0;
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}
	.foot {
		flex-shrink: 0;
	}
	.kind {
		margin: 0 0 var(--s-1);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.title {
		flex-shrink: 0;
		margin: 0 0 var(--s-2);
		font-size: var(--t-body-2);
		font-weight: 600;
		color: var(--ink);
		display: -webkit-box;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 4;
		line-clamp: 4;
		overflow: hidden;
	}
	.line {
		margin: 0 0 var(--s-1);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.rest {
		flex: 1;
		min-height: 0;
		overflow: hidden;
		/* Text longer than its place fades out, not cut through a line. */
		mask-image: linear-gradient(to bottom, black calc(100% - 2em), transparent);
	}
	.passage {
		margin-top: var(--s-2);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
		color: var(--ink-2);
	}
	.passage p {
		margin: 0;
	}
	.passage mark {
		background: none;
		color: var(--ink);
		font-weight: 600;
	}
	.quiet {
		color: var(--ink-3);
	}
	.actions {
		list-style: none;
		margin: var(--s-2) 0 0;
		padding: var(--s-2) 0 0;
		border-top: 1px solid var(--rule);
	}
	.actions li {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: var(--s-2);
		padding: var(--s-1) 0;
	}
	.actions button {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		font-size: var(--t-meta);
		color: var(--ink);
		text-align: left;
		cursor: pointer;
	}
	.actions button:hover {
		text-decoration: underline;
	}
	.combo {
		flex-shrink: 0;
		font-size: var(--t-micro);
	}
	code {
		font-family: var(--font-serif);
	}
</style>

<script lang="ts">
	import { uniqueBy } from '$lib/util/unique';
	// Reader for a bijlage: its title, the law it belongs to, its text, its entries in order
	// and the articles that refer to it.
	import ReaderFrame from './ReaderFrame.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import { ensureInstrumentName, instrumentMetaStore } from '$lib/api/instrument-cache';
	import { formatCount } from '$lib/verbonden/filter';
	import { annexGroups, type AnnexItem } from './annex';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; detail: Schema<'AnnexDetailResponse'> };

	let view = $state<State>({ kind: 'loading' });
	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/annexes/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((detail) => {
				if (ac.signal.aborted) return;
				view = { kind: 'loaded', detail };
				ensureInstrumentName(detail.annex.bwb_id);
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Bijlage kon niet worden geladen.' };
			});
		return () => ac.abort();
	});

	const lawName = (bwbId: string) => {
		const meta = $instrumentMetaStore.get(bwbId);
		return meta?.citationTitle ?? meta?.title ?? bwbId;
	};

	// The text line by line. A line ending in a colon heads the entries of one law.
	const linesOf = (text: string | null | undefined) =>
		(text ?? '')
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => ({ line, heading: line.endsWith(':') }));
</script>

<ReaderFrame>
	<div class="r-annex">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const a = view.detail.annex}
			{@const entries = a.entries ?? []}
			{@const refs = view.detail.referenced_by ?? []}
			<header class="head">
				<span class="kicker"
					><KindGlyph collection="annexes" />{bronLabel('annexes')}{a.label
						? ` ${a.label}`
						: ''}</span
				>
				<h1 class="title">{a.title ?? a.display_name ?? a.key}</h1>
				{#if a.bwb_id}
					<p class="law">
						<BronLink ref={{ collection: 'instruments', key: a.bwb_id.toLowerCase() }}
							>{lawName(a.bwb_id)}</BronLink
						>
					</p>
				{/if}
			</header>

			{#if a.stub}
				<p class="empty">Van deze bijlage staat alleen de naam in de gegevens.</p>
			{/if}

			{#if refs.length}
				<section class="refs">
					<h2>Aangehaald in</h2>
					<ul>
						{#each uniqueBy(refs, (r) => r.article.id) as r (r.article.id)}
							<li>
								<BronLink ref={{ collection: 'articles', key: r.article.key }}
									>{r.article.display_name ?? r.article.key}</BronLink
								>{#if r.explanation}<span class="entry-note">{r.explanation}</span>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if a.description}
				<div class="text">
					{#each linesOf(a.description) as { line, heading }, i (i)}
						<p class:heading>{line}</p>
					{/each}
				</div>
			{/if}

			{#if entries.length}
				<!-- The entries in the bijlage's own order: per line they stand under, nested. -->
				<details class="entries">
					<summary>{formatCount(entries.length)} onderdelen</summary>
					{#each annexGroups(entries) as g, i (i)}
						<section class="law-group">
							{#if g.heading}<h2 class="law-name">{g.heading}</h2>{/if}
							{@render items(g.items)}
						</section>
					{/each}
				</details>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<!-- The provisions under a law, each with the ones nested under it. -->
{#snippet items(list: AnnexItem[])}
	<ul class="law-items">
		{#each list as item, i (i)}
			<li>
				{item.name}{#if item.note}<span class="entry-note">{item.note}</span
					>{/if}{#if item.children.length}{@render items(item.children)}{/if}
			</li>
		{/each}
	</ul>
{/snippet}

<style>
	.r-annex {
		display: flex;
		flex-direction: column;
		gap: var(--s-5);
		color: var(--ink-2);
	}
	.loading,
	.error,
	.empty {
		margin: 0;
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.title {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-h1);
		font-weight: 600;
		line-height: 1.25;
		color: var(--ink);
	}
	.law {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.text {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		max-width: 68ch;
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: 1.6;
		color: var(--ink);
	}
	.text p {
		margin: 0;
	}
	/* A law and the provisions of it the bijlage names: the law as the head of its part. */
	.law-group {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin-top: var(--s-3);
	}
	.law-name {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-2);
	}
	.law-items {
		margin: 0;
		padding: 0 0 0 var(--s-5);
		list-style: none;
	}
	/* A nested provision: under the one it belongs to, one step further in. */
	.law-items .law-items {
		padding-left: var(--s-5);
	}
	/* A law whose entries follow: set apart as the head of its part of the list. */
	.text .heading {
		margin-top: var(--s-3);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-2);
	}
	.entries summary,
	.refs h2 {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink-2);
		cursor: pointer;
	}
	.refs h2 {
		cursor: default;
	}
	.refs ul {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin: var(--s-2) 0 0;
		padding: 0;
		list-style: none;
		max-width: 68ch;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.entry-note {
		display: block;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>

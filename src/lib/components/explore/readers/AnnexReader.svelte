<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { naamVan } from '$lib/bron/menselijk';
	import { page } from '$app/state';
	import { permalink } from '$lib/bron/landing';
	import { citeItems } from '$lib/components/ui/cite-items';
	import ReaderHead from './ReaderHead.svelte';
	import { uniqueBy } from '$lib/util/unique';
	// Reader for a bijlage: its title, the law it belongs to, the articles that refer to it and
	// its text as the text of an article reads (ArticleText: its tables, headings and links).
	// A bijlage the data holds no text of yet reads by its description and entries.
	import ReaderFrame from './ReaderFrame.svelte';
	import ArticleText from '$lib/components/articles/ArticleText.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { getAnnex } from '$lib/api/documents';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import { ensureInstrumentName, instrumentMetaStore, lawName } from '$lib/api/instrument-cache';
	import { formatCount } from '$lib/text/getal';
	import { annexGroups, type AnnexItem } from './annex';
	import { load } from '$lib/util/load.svelte';

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: a new node of the same bron (its light node, then the full one)
	// does not load it again and empty the reader for a moment (UX-toets 0.79.43, #33).
	const annex = load(
		() => node.key,
		async (key, signal) => {
			const detail = await getAnnex(key, signal);
			ensureInstrumentName(detail.annex.bwb_id);
			return detail;
		},
		'Bijlage'
	);

	/** Its heading as printed, without its title: `Bijlage 1`, `Lijst I`. */
	const headingOf = (a: { key: string; display_name: string | null; label: string | null }) =>
		naamVan('annexes', Object.assign({}, a, { title: null }));

	const nameOf = (bwbId: string) => lawName($instrumentMetaStore.get(bwbId), bwbId);

	// The text line by line. A line ending in a colon heads the entries of one law.
	const linesOf = (text: string | null | undefined) =>
		(text ?? '')
			.split('\n')
			.map((line) => line.trim())
			.filter(Boolean)
			.map((line) => ({ line, heading: line.endsWith(':') }));
</script>

<ReaderFrame state={annex.state} what="Bijlage" retry={annex.retry}>
	{#snippet children(detail)}
		{@const a = detail.annex}
		{@const entries = a.entries ?? []}
		{@const refs = detail.referenced_by ?? []}
		<!-- Its heading as printed (Bijlage 1, Lijst I), and its title where it has one. -->
		{@const heading = headingOf(a)}
		{@const titel = a.title ?? heading}
		{@const kort = [heading, a.bwb_id ? nameOf(a.bwb_id) : null].filter(Boolean).join(', ')}
		<div class="r-annex">
			<ReaderHead
				collection="annexes"
				title={titel}
				acties={{
					bewaar: bewaarItem(
						node.id,
						{ kort, voluit: a.title ? `${kort}: ${a.title}` : kort },
						{ groep: a.bwb_id ? nameOf(a.bwb_id) : kort }
					),
					cite: citeItems(
						{ kort, voluit: a.title ? `${kort}: ${a.title}` : kort },
						permalink(page.url, '')
					),
					naam: kort
				}}
			>
				<!-- The bijlage names itself once (UX-toets 0.79.43, #30): its heading (Bijlage 1,
				     Lijst I) in the kind line only where the title is one of its own; its law stands
				     in the band. -->
				{#snippet kindLine()}
					<KindGlyph collection="annexes" />{a.title ? heading : bronLabel('annexes')}
				{/snippet}
			</ReaderHead>

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
									>{naamVan('articles', r.article)}</BronLink
								>{#if r.explanation}<span class="entry-note">{r.explanation}</span>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}

			{#if a.text}
				<ArticleText
					text={a.text}
					parts={a.parts}
					tables={a.tables}
					headings={a.headings}
					footnoteMarks={a.footnote_marks}
					references={detail.references ?? []}
					law={a.bwb_id}
				/>
			{:else if a.description}
				<div class="text">
					{#each linesOf(a.description) as { line, heading }, i (i)}
						<p class:heading>{line}</p>
					{/each}
				</div>
			{/if}

			{#if !a.text && entries.length}
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
		</div>
	{/snippet}
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
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-5);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.empty {
		margin: 0;
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
		font-size: var(--t-body-2);
		color: var(--ink);
	}
	.entry-note {
		display: block;
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
</style>

<script lang="ts">
	import type { Snippet } from 'svelte';
	// Verbonden at a glance (mockups V1): per soort a heading with its count over the whole, the
	// three to read as a title and one line, and "Alle N" that opens the soort with its groups,
	// its order and its filters. A click on a title opens the row in place, with its passage,
	// its identifier and where it comes from; the bron is one step further (a modified click,
	// or the row opened). Judgments that cite an article carry their instanties as a bar.
	import { openHref, refId } from '$lib/bron/href';
	import { terPlekke } from '$lib/actions/klik';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { formatCount } from '$lib/text/getal';
	import type { GraphNode } from '$lib/graph/types';
	import { PREVIEW_ROWS } from './view';
	import { ankerVanRij, caseNumberOf, isNested, repeatedTitles, rowKey, type Row } from './rows';
	import { shortLine, type Kind } from './summary';
	import type { TierCount } from './tiers';
	import VerbondenRow from './VerbondenRow.svelte';
	import TierBar from './TierBar.svelte';
	import TierSwatch from './TierSwatch.svelte';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { shapeOfTier } from './tiers';

	let {
		kinds,
		selection,
		tiers = null,
		tiersPending = false,
		tiersVan = null,
		open = new Set<string>(),
		kindTools,
		hasMore = () => false,
		onMore,
		stap = () => null,
		onOpen,
		onRetry,
		onProposedText,
		onAddToNetwerk,
		inNetwerk,
		telt = true
	}: {
		kinds: Kind[];
		selection: GraphNode;
		/** The judgments that cite the article per instantie, over the soort's count. */
		tiers?: TierCount[] | null;
		/** The bar is asked and not in: its room stands, so the soorten under it do not move. */
		tiersPending?: boolean;
		/** The strook counts `geteld` of the `van` judgments: the rows that are in. */
		tiersVan?: { geteld: number; van: number } | null;
		/** "Alle N": the soort with its groups. */
		/** The soorten opened in place with all their rows. */
		open?: Set<string>;
		/** What a soort opened in place shows over its rows: the order of the judgments. */
		kindTools?: Snippet<[string]>;
		/** Whether a soort opened in place has a further page of rows to ask. */
		hasMore?: (id: string) => boolean;
		/** Ask the next page of a soort's rows (fifty a bucket, T11). */
		onMore?: (id: string) => void;
		/** How many rows the next page of a soort brings, at most. */
		stap?: (id: string) => number | null;
		onOpen: (id: string) => void;
		/** Ask a group whose rows did not come again. */
		onRetry?: () => void;
		onProposedText?: (row: Row) => void;
		onAddToNetwerk?: (row: Row) => void;
		inNetwerk?: (row: Row) => boolean;
		/** Every group in: a heading counts only then, its place kept until (F5). */
		telt?: boolean;
	} = $props();

	const lijsten: Record<string, HTMLUListElement | null> = $state({});
	/** The row opened in place: one at a time. */
	let opened = $state<string | null>(null);
	$effect(() => {
		void selection.id;
		opened = null;
	});
	/** The vlak of the instantie of a judgment's row; none for another bron. */
	const tierShapeOf = (row: Row) =>
		row.ref.collection === 'judgments' && typeof row.props?.tier === 'string'
			? shapeOfTier(row.props.tier)
			: null;
	const toggle = (row: Row) => (opened = opened === rowKey(row) ? null : rowKey(row));

	/**
	 * The count of a soort as its rows stand once every page of its own buckets is in: the
	 * bronnen it lists, each once (T11: "Alle 13" listed 7). A loader's group keeps the API's
	 * count: its pages are its own.
	 */
	const countOf = (k: Kind) =>
		open.has(k.id) && !hasMore(k.id) && k.groups.every((g) => !g.load) && k.settled
			? k.rows.length
			: k.count;

	/** Whether the group of a row is read beside the selected bron (a judgment at its r.o.). */
	const inPlace = (k: Kind, row: Row) =>
		k.groups.some((g) => g.inPlace && g.rows.some((r) => refId(r.ref) === refId(row.ref)));
</script>

{#each kinds as k (k.id)}
	<!-- Two judgments of one court and day: the case number tells them apart, as in the groups. -->
	{@const repeated = repeatedTitles(k.rows.slice(0, PREVIEW_ROWS))}
	<section class="kind" data-kind={k.id}>
		<h3 class="kind__head">
			<span>{k.label}</span><span class="kind__count">{telt ? formatCount(countOf(k)) : ''}</span>
		</h3>
		{#if k.id === 'judgments' && (tiers?.length || tiersPending)}
			<TierBar parts={tiers} pending={tiersPending} van={tiersVan} />
		{/if}
		{#if k.failed && k.rows.length === 0}
			<LoadState
				state={{ status: 'error', error: k.failed.error }}
				what={k.failed.noun ? `De ${k.failed.noun}` : 'Deze groep'}
				plural={!!k.failed.noun}
				retry={onRetry}
			/>
		{/if}
		{#if open.has(k.id)}{@render kindTools?.(k.id)}{/if}
		<ul class="kind__rows" bind:this={lijsten[k.id]}>
			{#each open.has(k.id) ? k.rows : k.rows
						.filter((r) => !isNested(r))
						.slice(0, PREVIEW_ROWS) as row (rowKey(row))}
				{#if opened === rowKey(row)}
					<li class="kind__open" class:kind__onder={isNested(row)}>
						<ul class="rows">
							<VerbondenRow
								{row}
								{selection}
								inPlace={inPlace(k, row)}
								sister={repeated.has(row.title) ? caseNumberOf(row) : null}
								open
								onToggle={() => toggle(row)}
								{onProposedText}
								{onAddToNetwerk}
								{inNetwerk}
							/>
						</ul>
					</li>
				{:else}
					{@const shape = tierShapeOf(row)}
					<li class="kind__row" class:kind__onder={isNested(row)}>
						<div class="kind__kop">
							<span class="kind__vlak"
								>{#if shape}<TierSwatch {shape} />{:else}<KindGlyph
										collection={row.ref.collection}
										vorm={row.filterGroup === 'wetsvoorstellen' ? 'voorstel' : undefined}
										size={11}
									/>{/if}</span
							>
							<a
								class="kind__title"
								title={typeof row.props?.instrument_citation_title === 'string' &&
								row.ref.collection === 'articles'
									? row.props.instrument_citation_title
									: undefined}
								href={openHref(row.ref, { at: ankerVanRij(row) })}
								aria-expanded="false"
								onclick={(e) => terPlekke(e, () => toggle(row))}
								>{row.title}{#if repeated.has(row.title) && caseNumberOf(row)}, {caseNumberOf(
										row
									)}{/if}</a
							>
						</div>
						{#if shortLine(row)}<span class="kind__line kind__line--vlak">{shortLine(row)}</span
							>{/if}
					</li>
				{/if}
			{:else}
				{#each { length: k.failed ? 0 : Math.min(PREVIEW_ROWS, k.count) } as _, i (i)}
					<li class="kind__row kind__row--pending" aria-hidden="true">
						<span class="pending"></span><span class="pending pending--short"></span>
					</li>
				{/each}
			{/each}
		</ul>
		<!-- Opened, the rows come a page at a time: the next page one click further, with how
		     many still wait, never the whole at once (T11). -->
		{#if open.has(k.id) && hasMore(k.id)}
			<p class="kind__all kind__vervolg">
				<AlleN
					volgende
					noun={k.noun}
					stap={stap(k.id)}
					rest={k.count > k.rows.length ? k.count - k.rows.length : null}
					geladen={k.rows.length}
					lijst={lijsten[k.id]}
					onclick={() => onMore?.(k.id)}
				/>
			</p>
		{/if}
		<!-- Alle N is the way to the rest: with nothing more than the rows above it opens nothing. -->
		{#if k.count > PREVIEW_ROWS}
			<p class="kind__all">
				<AlleN
					aantal={countOf(k)}
					noun={k.noun}
					open={open.has(k.id)}
					onclick={() => onOpen(k.id)}
				/>
			</p>
		{/if}
	</section>
{/each}

<style>
	/* A soort between two rules, on the panel's own edges (mockups V1: `.soort`). */
	.kind {
		padding: var(--s-4) 0;
		border-top: 1px solid var(--rule);
	}
	.kind__head {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: var(--s-3);
		margin: 0 0 var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		font-weight: 600;
		line-height: 24px;
		color: var(--ink);
	}
	.kind__vervolg {
		display: flex;
		gap: var(--s-4);
		align-items: baseline;
	}
	.kind__count {
		font-weight: 400;
		color: var(--ink-3);
	}
	.kind__rows,
	.rows {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.kind__row,
	.kind__open {
		padding: var(--s-2) 0;
		border-top: 1px solid var(--wassing);
	}
	.kind__row:first-child,
	.kind__open:first-child {
		border-top: 0;
	}
	/* The row opens on the line its title stood on: the row has the padding of the closed one. */
	.kind__open {
		margin: 0 calc(-1 * var(--s-4));
		padding-block: 0;
	}
	/* A regulation issued under the one above it. */
	.kind__onder {
		padding-left: var(--s-4);
	}
	.kind__kop {
		display: flex;
		align-items: flex-start;
		gap: var(--s-2);
	}
	/* On the first line of the title (24 px). */
	.kind__vlak {
		flex: none;
		margin-top: var(--s-2);
	}
	.kind__line--vlak {
		padding-left: calc(var(--s-3) + var(--s-2));
	}
	.kind__title {
		display: block;
		font-size: var(--t-body-2);
		line-height: 24px;
		color: var(--ink);
		text-decoration: none;
	}
	.kind__title:hover,
	.kind__title:focus-visible {
		text-decoration: underline;
		text-underline-offset: var(--onderstreping);
	}
	.kind__line {
		display: block;
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.kind__all {
		margin: var(--s-2) 0 0;
		font-size: var(--t-meta);
	}
	.pending {
		display: block;
		height: var(--s-3);
		margin: var(--s-1) 0;
		width: 80%;
		background: var(--wassing);
	}
	.pending--short {
		width: 45%;
	}
	/* A finger's 44 px: a title is a line of its own that high. */
	@media (pointer: coarse), (max-width: 768px) {
		.kind__title {
			display: flex;
			align-items: center;
			min-height: var(--veld-h-raak);
		}
	}
</style>

<script lang="ts">
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
	import { ankerVanRij, rowKey, type Row } from './rows';
	import { shortLine, type Kind } from './summary';
	import type { TierCount } from './tiers';
	import VerbondenRow from './VerbondenRow.svelte';

	let {
		kinds,
		selection,
		tiers = null,
		onOpen,
		onRetry,
		onProposedText,
		onAddToNetwerk,
		inNetwerk
	}: {
		kinds: Kind[];
		selection: GraphNode;
		/** The judgments that cite the article per instantie, over the soort's count. */
		tiers?: TierCount[] | null;
		/** "Alle N": the soort with its groups. */
		onOpen: (id: string) => void;
		/** Ask a group whose rows did not come again. */
		onRetry?: () => void;
		onProposedText?: (row: Row) => void;
		onAddToNetwerk?: (row: Row) => void;
		inNetwerk?: (row: Row) => boolean;
	} = $props();

	/** The share of each part of the bar, the largest darkest. */
	const SHADES = [1, 0.7, 0.45, 0.22];

	/** The row opened in place: one at a time. */
	let opened = $state<string | null>(null);
	$effect(() => {
		void selection.id;
		opened = null;
	});
	const toggle = (row: Row) => (opened = opened === rowKey(row) ? null : rowKey(row));

	/** Whether the group of a row is read beside the selected bron (a judgment at its r.o.). */
	const inPlace = (k: Kind, row: Row) =>
		k.groups.some((g) => g.inPlace && g.rows.some((r) => refId(r.ref) === refId(row.ref)));
</script>

{#each kinds as k (k.id)}
	<section class="kind" data-kind={k.id}>
		<h3 class="kind__head">
			<span>{k.label}</span><span class="kind__count"
				>{formatCount(k.count)}{k.id === 'laws' ? ` ${k.noun}` : ''}</span
			>
		</h3>
		{#if k.id === 'judgments' && tiers?.length}
			<div class="bar" aria-hidden="true">
				{#each tiers as t, j (t.label)}
					<i style:flex="{t.count} 1 0" style:opacity={SHADES[j] ?? 0.22}></i>
				{/each}
			</div>
			<ul class="parts" aria-label="Per instantie">
				{#each tiers as t, j (t.label)}
					<li>
						<span><span class="swatch" style:opacity={SHADES[j] ?? 0.22}></span>{t.label}</span
						><span class="parts__count">{formatCount(t.count)}</span>
					</li>
				{/each}
			</ul>
		{/if}
		{#if k.failed && k.rows.length === 0}
			<LoadState
				state={{ status: 'error', error: k.failed.error }}
				what={k.failed.noun ? `De ${k.failed.noun}` : 'Deze groep'}
				plural={!!k.failed.noun}
				retry={onRetry}
			/>
		{/if}
		<ul class="kind__rows">
			{#each k.rows.slice(0, PREVIEW_ROWS) as row (rowKey(row))}
				{#if opened === rowKey(row)}
					<li class="kind__open">
						<ul class="rows">
							<VerbondenRow
								{row}
								{selection}
								inPlace={inPlace(k, row)}
								open
								onToggle={() => toggle(row)}
								{onProposedText}
								{onAddToNetwerk}
								{inNetwerk}
							/>
						</ul>
					</li>
				{:else}
					<li class="kind__row">
						<a
							class="kind__title"
							href={openHref(row.ref, { at: ankerVanRij(row) })}
							aria-expanded="false"
							onclick={(e) => terPlekke(e, () => toggle(row))}>{row.title}</a
						>
						{#if shortLine(row)}<span class="kind__line">{shortLine(row)}</span>{/if}
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
		<p class="kind__all">
			<AlleN aantal={k.count} noun={k.noun} onclick={() => onOpen(k.id)} />
		</p>
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
	.kind__count {
		font-weight: 400;
		color: var(--ink-3);
	}
	.bar {
		display: flex;
		gap: 2px;
		height: var(--s-2);
		margin: 0 0 var(--s-2);
	}
	.bar i {
		display: block;
		height: 100%;
		background: var(--indigo);
	}
	.parts {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0 var(--s-4);
		margin: 0 0 var(--s-3);
		padding: 0;
		list-style: none;
		font-size: var(--t-micro);
		line-height: 20px;
		color: var(--ink-3);
	}
	.parts li {
		display: flex;
		justify-content: space-between;
		gap: var(--s-2);
	}
	.swatch {
		display: inline-block;
		width: var(--s-2);
		height: var(--s-2);
		margin-right: var(--s-2);
		background: var(--indigo);
	}
	.parts__count {
		color: var(--ink);
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
	.kind__open {
		margin: 0 calc(-1 * var(--s-4));
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
		text-underline-offset: var(--underline-offset);
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
	/* A finger's 44 px: a title's place to tap is its line and the one under it. */
	@media (pointer: coarse), (max-width: 768px) {
		.kind__title {
			padding-block: var(--s-1);
		}
	}
</style>

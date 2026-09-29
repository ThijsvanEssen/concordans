<script lang="ts">
	import { uniqueBy } from '$lib/util/unique';
	import BronLink from '$lib/bron/BronLink.svelte';
	import { dossierCounts } from '$lib/components/parliamentary/counts';
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { getDossier, str } from '$lib/components/parliamentary/data';
	import {
		OUTCOME_LABEL,
		STAGE_LABEL,
		TRACK_LABEL,
		isBill
	} from '$lib/components/parliamentary/stages';
	import { formatLongDate } from './_shared';
	import LegislativeStepper from '$lib/components/parliamentary/LegislativeStepper.svelte';
	import LegislativeTimeline from '$lib/components/parliamentary/LegislativeTimeline.svelte';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				dossier: Schema<'DossierDetailResponse'>;
				timeline: Schema<'DossierTimelineResponse'> | null;
		  };

	const TIMELINE_LIMIT = 200;

	let view = $state<State>({ kind: 'loading' });

	type Reading = Schema<'DossierRelationDTO'>['dossier'];
	/**
	 * A change in the Grondwet passes two readings, each its own dossier. The memorie van
	 * toelichting is in the dossier of the first reading; the second only refers to it.
	 */
	const readings = $derived.by(() => {
		const relations = view.kind === 'loaded' ? (view.dossier.relations ?? []) : [];
		const of = (direction: 'outgoing' | 'incoming'): Reading[] =>
			relations
				.filter((r) => r.relation === 'second_reading_of' && r.direction === direction)
				.map((r) => r.dossier);
		return { first: of('outgoing'), second: of('incoming') };
	});

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		// The API addresses a dossier by its number (`37020-XV`), the node's `label`.
		const number = str(node.raw?.props?.label);
		if (!number) {
			view = { kind: 'error', message: 'Dossier kon niet geladen worden.' };
			return;
		}
		const ac = new AbortController();
		view = { kind: 'loading' };
		// The timeline is optional: when it fails its section is left out.
		Promise.all([
			getDossier(number),
			unwrap(
				api.GET('/api/dossiers/{number}/timeline', {
					params: { path: { number }, query: { limit: TIMELINE_LIMIT } },
					signal: ac.signal
				})
			).catch(() => null)
		])
			.then(([dossier, timeline]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', dossier, timeline };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Dossier kon niet geladen worden.' };
			});
		return () => ac.abort();
	});
</script>

{#snippet dossierLinks(all: Reading[])}
	{@const dossiers = uniqueBy(all, (r) => r.key)}
	{dossiers.length === 1 ? 'Kamerstuk' : 'Kamerstukken'}
	{#each dossiers as r, i (r.key)}{#if i > 0}{i === dossiers.length - 1
				? ' en '
				: ', '}{/if}<BronLink
			ref={{ collection: 'dossiers', key: r.key, number: r.number }}
			title={r.title ?? undefined}>{r.number}</BronLink
		>{/each}
{/snippet}

<ReaderFrame>
	<div class="r-dossier">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const d = view.dossier}
			{@const track = d.track ?? 'overig'}

			<header class="head">
				<span class="kicker">
					<KindGlyph collection="dossiers" />
					{bronLabel('dossiers')} · Kamerstuk {d.number}
				</span>
				<h2 class="title">{d.title ?? d.number}</h2>
				<div class="chips">
					<span class="track-chip track-chip--{track}">{TRACK_LABEL[track]}</span>
					{#if d.outcome}
						<span class="stage-chip"
							>{OUTCOME_LABEL[d.outcome]}{d.closed_on
								? `, ${formatLongDate(d.closed_on)}`
								: ''}</span
						>
					{:else if d.current_stage}
						<span class="stage-chip">Nu: {STAGE_LABEL[d.current_stage]}</span>
					{/if}
				</div>
				{#if readings.first.length > 0}
					<p class="reading">
						Tweede lezing van {@render dossierLinks(readings.first)}
					</p>
				{/if}
				{#if readings.second.length > 0}
					<p class="reading">
						Eerste lezing. Tweede lezing in {@render dossierLinks(readings.second)}
					</p>
				{/if}
			</header>

			{#if isBill(d.track) && d.stages?.length}
				<div class="stepper-wrap">
					<LegislativeStepper
						stages={d.stages}
						current={d.current_stage ?? null}
						complete={d.stages_complete}
					/>
				</div>
			{/if}

			<p class="counts">
				{dossierCounts({
					documents: d.document_count,
					decisions: d.decision_count,
					activities: d.activity_count
				})}
			</p>

			{#if view.timeline && view.timeline.entries.length > 0}
				<section class="sec sec--timeline">
					<h3 class="sec-title">
						Tijdlijn
						{#if view.timeline.total > view.timeline.entries.length}
							<span class="sec-count">{view.timeline.entries.length} / {view.timeline.total}</span>
						{/if}
					</h3>
					<LegislativeTimeline entries={view.timeline.entries} />
				</section>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-dossier {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		color: var(--ink-2);
	}
	.loading,
	.error {
		font-family: var(--font-serif);
		font-style: italic;
		color: var(--ink-3);
		margin: 0;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: var(--s-3);
		align-items: baseline;
	}

	/* The track, the current stage and the outcome are words, not tags. */
	.track-chip,
	.stage-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}
	.stage-chip {
		color: var(--ink-2);
	}

	.reading {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		margin: 0;
	}
	.reading :global(a) {
		color: inherit;
		text-decoration: underline;
		text-decoration-color: var(--rule);
		text-underline-offset: 2px;
	}
	.reading :global(a:hover) {
		text-decoration-color: currentColor;
	}

	.stepper-wrap {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: var(--s-3) 0;
	}

	/* What the dossier holds, as a sentence: no tiles, and a zero is said as "geen". */
	.counts {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}

	.sec {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.sec-title {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
		margin: 0;
	}

	.sec-count {
		font-family: var(--font-sans);
		font-weight: 400;
		margin-left: 6px;
	}
	.sec--timeline {
		gap: 0;
	}
</style>

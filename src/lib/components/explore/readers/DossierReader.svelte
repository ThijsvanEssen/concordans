<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel, bronPlural } from '$lib/vocabulary';
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

	$effect(() => {
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

<div class="r-dossier">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
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
						>{OUTCOME_LABEL[d.outcome]}{d.closed_on ? `, ${formatLongDate(d.closed_on)}` : ''}</span
					>
				{:else if d.current_stage}
					<span class="stage-chip">Nu: {STAGE_LABEL[d.current_stage]}</span>
				{/if}
			</div>
		</header>

		{#if isBill(d.track) && d.stages?.length}
			<div class="stepper-wrap">
				<LegislativeStepper stages={d.stages} current={d.current_stage ?? null} />
			</div>
		{/if}

		<ul class="stats">
			<li>
				<span class="stat-num">{d.document_count}</span><span class="stat-label"
					>{bronPlural('documents')}</span
				>
			</li>
			<li>
				<span class="stat-num">{d.decision_count}</span><span class="stat-label"
					>{bronPlural('decisions')}</span
				>
			</li>
			<li>
				<span class="stat-num">{d.activity_count}</span><span class="stat-label"
					>{bronPlural('activities')}</span
				>
			</li>
		</ul>

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

<style>
	.r-dossier {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
		padding: var(--s-5) var(--s-5) var(--s-6);
		color: var(--ink-2);
		height: 100%;
		overflow-y: auto;
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

	.stepper-wrap {
		border-top: 1px solid var(--rule);
		border-bottom: 1px solid var(--rule);
		padding: var(--s-3) 0;
	}

	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: var(--s-2);
	}
	.stats .stat-label {
		line-height: 1.2;
	}
	.stats li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: var(--s-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
	}
	.stat-num {
		font-family: var(--font-sans);
		font-size: 17px;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
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
		font-variant-numeric: tabular-nums;
		font-weight: 400;
		margin-left: 6px;
	}
	.sec--timeline {
		gap: 0;
	}
</style>

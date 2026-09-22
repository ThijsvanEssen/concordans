<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel, bronPlural } from '$lib/vocabulary';
	import { dossierNumber } from '$lib/components/parliamentary/data';
	import { STAGE_LABEL, TRACK_LABEL } from '$lib/components/parliamentary/stages';
	import LegislativeStepper from '$lib/components/parliamentary/LegislativeStepper.svelte';
	import LegislativeTimeline from '$lib/components/parliamentary/LegislativeTimeline.svelte';
	import GlossaryPill from './GlossaryPill.svelte';

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
		const number = dossierNumber(node.key);
		const ac = new AbortController();
		view = { kind: 'loading' };
		// The timeline is optional: when it fails its section is left out.
		Promise.all([
			unwrap(
				api.GET('/api/dossiers/{number}', { params: { path: { number } }, signal: ac.signal })
			),
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
				{bronLabel('dossiers')} · <GlossaryPill term="Kamerstuk" label={`Kamerstuk ${d.number}`} />
			</span>
			<h2 class="title">{d.title ?? d.number}</h2>
			<div class="chips">
				<span class="track-chip track-chip--{track}">{TRACK_LABEL[track]}</span>
				{#if d.current_stage}
					<span class="stage-chip">Nu: {STAGE_LABEL[d.current_stage]}</span>
				{/if}
				{#if d.closed}<span class="closed-chip">Afgehandeld</span>{/if}
			</div>
		</header>

		{#if d.stages?.length}
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
		color: var(--ink-4);
		margin: 0;
	}
	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
		display: flex;
		align-items: baseline;
		gap: 6px;
	}
	.title {
		font-family: var(--font-serif);
		font-size: 19px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.25;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		align-items: center;
	}

	.track-chip,
	.stage-chip,
	.closed-chip {
		display: inline-flex;
		align-items: center;
		height: 18px;
		padding: 0 7px;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		border: 1px solid var(--rule);
		background: var(--paper-3);
		color: var(--ink-3);
	}
	.track-chip--wetsvoorstel {
		background: color-mix(in srgb, #7a1f1a 10%, var(--paper));
		color: #7a1f1a;
		border-color: color-mix(in srgb, #7a1f1a 25%, transparent);
	}
	.track-chip--initiatiefwetsvoorstel {
		background: color-mix(in srgb, #4f46e5 10%, var(--paper));
		color: #4f46e5;
		border-color: color-mix(in srgb, #4f46e5 25%, transparent);
	}
	.track-chip--begroting {
		background: color-mix(in srgb, #d97706 10%, var(--paper));
		color: #d97706;
		border-color: color-mix(in srgb, #d97706 25%, transparent);
	}
	.track-chip--motie {
		background: color-mix(in srgb, #16a34a 10%, var(--paper));
		color: #16a34a;
		border-color: color-mix(in srgb, #16a34a 25%, transparent);
	}
	.track-chip--overig {
		background: var(--paper-3);
		color: var(--ink-4);
		border-style: dashed;
	}
	.stage-chip {
		color: var(--spine);
		border-color: var(--spine-faint);
		background: var(--spine-faint);
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
		font-family: var(--font-mono);
		font-size: 17px;
		font-weight: 600;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-sans);
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: var(--ink-4);
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

	.sec-count {
		font-family: var(--font-mono);
		letter-spacing: 0;
		margin-left: 6px;
	}
	.sec--timeline {
		gap: 0;
	}
</style>

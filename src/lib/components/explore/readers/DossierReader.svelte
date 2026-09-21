<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import {
		dossierNumber,
		getDossierDocuments,
		getDossierMutations,
		mutatedArticles
	} from '$lib/components/parliamentary/data';
	import { STAGE_LABEL, TRACK_LABEL } from '$lib/components/parliamentary/stages';
	import LegislativeStepper from '$lib/components/parliamentary/LegislativeStepper.svelte';
	import LegislativeTimeline from '$lib/components/parliamentary/LegislativeTimeline.svelte';
	import GlossaryPill from './GlossaryPill.svelte';
	import { formatDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				dossier: Schema<'DossierDetailResponse'>;
				documents: Schema<'DossierDocumentsResponse'> | null;
				mutations: Schema<'DossierMutationsResponse'> | null;
				timeline: Schema<'DossierTimelineResponse'> | null;
		  };

	// The schema leaves a timeline entry's `body` untyped.
	type DecisionBody = { passed?: boolean; subject?: string };
	const decisionOf = (entry: Schema<'TimelineEntryDTO'>) => (entry.body ?? {}) as DecisionBody;

	const TIMELINE_LIMIT = 200;
	const PREVIEW = 8;

	let view = $state<State>({ kind: 'loading' });
	let showAllArticles = $state(false);
	let showAllDecisions = $state(false);

	$effect(() => {
		const number = dossierNumber(node.key);
		const ac = new AbortController();
		view = { kind: 'loading' };
		showAllArticles = showAllDecisions = false;
		// Everything but the header is optional: a failed part leaves its section out.
		Promise.all([
			unwrap(
				api.GET('/api/dossiers/{number}', { params: { path: { number } }, signal: ac.signal })
			),
			getDossierDocuments(number).catch(() => null),
			getDossierMutations(number).catch(() => null),
			unwrap(
				api.GET('/api/dossiers/{number}/timeline', {
					params: { path: { number }, query: { limit: TIMELINE_LIMIT } },
					signal: ac.signal
				})
			).catch(() => null)
		])
			.then(([dossier, documents, mutations, timeline]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', dossier, documents, mutations, timeline };
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
		{@const articles = view.mutations ? mutatedArticles(view.mutations) : []}
		{@const decisions = view.timeline?.entries.filter((e) => e.node_type === 'decision') ?? []}

		<header class="head">
			<div class="kicker-row">
				<span class="kicker"
					>Dossier · <GlossaryPill term="Kamerstuk" label={`Kamerstuk ${d.number}`} /></span
				>
				<a
					class="graph-link"
					href="/explore?focus=dossiers/{d.key}&overlay=dossier:{dossierNumber(d.key)}"
					>Toon in netwerk →</a
				>
			</div>
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
				<span class="stat-num">{d.document_count}</span><span class="stat-label">Documenten</span>
			</li>
			<li>
				<span class="stat-num">{d.decision_count}</span><span class="stat-label">Stemmingen</span>
			</li>
			<li>
				<span class="stat-num">{d.activity_count}</span><span class="stat-label">Activiteiten</span>
			</li>
		</ul>

		{#if articles.length > 0}
			<section class="sec">
				<h3 class="sec-title">Betrokken artikelen</h3>
				<ul class="art-list">
					{#each showAllArticles ? articles : articles.slice(0, PREVIEW) as a (a.key)}
						<li class="art-item">
							<a class="art-name" href="/explore?focus=articles/{a.key}">{a.label}</a>
							{#if a.relation}<span class="art-rel">{a.relation}</span>{/if}
						</li>
					{/each}
				</ul>
				{#if articles.length > PREVIEW && !showAllArticles}
					<button type="button" class="more-btn" onclick={() => (showAllArticles = true)}>
						+{articles.length - PREVIEW} meer
					</button>
				{/if}
			</section>
		{/if}

		{#if view.documents && view.documents.items.length > 0}
			<section class="sec">
				<h3 class="sec-title">Documenten ({view.documents.total})</h3>
				<ul class="doc-list doc-list--full">
					{#each view.documents.items as doc (doc.key)}
						<li class="doc-item">
							<span class="doc-kind">{doc.kind ?? '—'}</span>
							{#if doc.tk_url}
								<a
									class="doc-title doc-title--link"
									href={doc.tk_url}
									target="_blank"
									rel="noopener noreferrer"
								>
									{doc.display_name ?? doc.title ?? doc.key}
								</a>
							{:else}
								<span class="doc-title">{doc.display_name ?? doc.title ?? doc.key}</span>
							{/if}
							{#if doc.date}<span class="doc-date">{formatDate(doc.date)}</span>{/if}
						</li>
					{/each}
				</ul>
			</section>
		{/if}

		{#if decisions.length > 0}
			<section class="sec">
				<h3 class="sec-title">Stemmingen ({d.decision_count})</h3>
				<ul class="decision-list">
					{#each showAllDecisions ? decisions : decisions.slice(0, PREVIEW) as e (e.node_id)}
						{@const decision = decisionOf(e)}
						{@const passed = decision.passed}
						<li class="decision-item">
							<span
								class="decision-result"
								class:decision-result--passed={passed === true}
								class:decision-result--failed={passed === false}
							>
								{passed ? 'Aangenomen' : passed === false ? 'Verworpen' : '—'}
							</span>
							<span class="decision-subject">{decision.subject ?? e.title ?? '—'}</span>
							{#if e.date}<span class="decision-date">{formatDate(e.date)}</span>{/if}
						</li>
					{/each}
				</ul>
				{#if decisions.length > PREVIEW && !showAllDecisions}
					<button type="button" class="more-btn" onclick={() => (showAllDecisions = true)}>
						+{decisions.length - PREVIEW} eerdere stemmingen
					</button>
				{/if}
			</section>
		{/if}

		{#if view.timeline && view.timeline.entries.length > 0}
			<section class="sec sec--timeline">
				<h3 class="sec-title">Tijdlijn</h3>
				{#if view.timeline.total > view.timeline.entries.length}
					<p class="timeline-note">
						De {view.timeline.entries.length} meest recente van {view.timeline.total} items.
					</p>
				{/if}
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
	.kicker-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--s-3);
	}
	.graph-link {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 500;
		color: var(--ink-3);
		text-decoration: none;
		white-space: nowrap;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		padding: 2px 8px;
	}
	.graph-link:hover {
		color: var(--ink);
		border-color: var(--ink-3);
	}
	.kicker {
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--ink-4);
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
	.more-btn {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: 11px;
		color: var(--spine);
		background: none;
		border: none;
		padding: 3px 0;
		cursor: pointer;
		text-align: left;
	}
	.more-btn:hover {
		color: var(--ink);
	}

	.art-list,
	.doc-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.art-item,
	.doc-item {
		display: grid;
		gap: var(--s-2);
		align-items: baseline;
		padding: 4px 0;
		border-bottom: 1px dotted var(--rule);
		font-size: 12px;
	}
	.art-item {
		grid-template-columns: 1fr auto;
		align-items: baseline;
	}
	.doc-item {
		grid-template-columns: minmax(70px, auto) 1fr auto;
	}
	.decision-item {
		align-items: start;
		padding: 6px 0;
	}

	.art-name,
	.doc-title {
		font-family: var(--font-serif);
		color: var(--ink-2);
		text-decoration: none;
		overflow-wrap: anywhere;
		line-height: 1.4;
	}
	.art-name:hover {
		color: var(--spine);
	}
	.doc-title--link:hover {
		color: var(--spine);
	}
	.timeline-note {
		margin: 0;
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--ink-4);
	}
	.sec--timeline {
		gap: 0;
	}
	.art-rel {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
	}
	.doc-kind {
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-4);
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.doc-date {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
	}

	/* Stemmingen list — recent votes for this dossier */
	.decision-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.decision-item {
		display: grid;
		grid-template-columns: minmax(80px, auto) 1fr auto;
		gap: 8px;
		align-items: baseline;
		padding: 5px 0;
		border-bottom: 1px dotted var(--rule);
		font-size: 12px;
	}
	.decision-result {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 1px 6px;
		border-radius: var(--r-1);
		border: 1px solid var(--rule);
		color: var(--ink-3);
		background: var(--paper-3);
		text-align: center;
	}
	.decision-result--passed {
		color: var(--green, #16a34a);
		border-color: color-mix(in srgb, var(--green, #16a34a) 25%, transparent);
		background: color-mix(in srgb, var(--green, #16a34a) 8%, var(--paper));
	}
	.decision-result--failed {
		color: var(--red, #dc2626);
		border-color: color-mix(in srgb, var(--red, #dc2626) 25%, transparent);
		background: color-mix(in srgb, var(--red, #dc2626) 8%, var(--paper));
	}
	.decision-subject {
		font-family: var(--font-serif);
		color: var(--ink-2);
		overflow-wrap: anywhere;
		min-width: 0;
		line-height: 1.4;
	}
	.decision-date {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
	}
</style>

<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import { formatLongDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				decision: Schema<'DecisionDTO'>;
				// The motion, amendment or bill that was voted on.
				document: Schema<'DocumentTextResponse'> | null;
		  };

	let view = $state<State>({ kind: 'loading' });

	$effect(() => {
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		Promise.all([
			unwrap(api.GET('/api/decisions/{key}', { params: { path: { key } }, signal: ac.signal })),
			unwrap(
				api.GET('/api/decisions/{key}/document', { params: { path: { key } }, signal: ac.signal })
			).catch(() => null)
		])
			.then(([decision, document]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', decision, document };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Stemming kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	const side = (choice: string) =>
		choice === 'Voor' ? 'for' : choice === 'Tegen' ? 'against' : 'other';

	/** The inverse of `dossierNumber`: `36600-VIII` is the node key `36600_viii`. */
	const dossierKey = (number: string) => number.replace('-', '_').toLowerCase();

	/** A voter id is `factions/vvd` or `members/…`; the key alone does not say which. */
	const voterHref = (v: Schema<'VoteDTO'>) =>
		v.voter_id.includes('/') ? bronHref(v.voter_id) : null;
</script>

<div class="r-decision">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const d = view.decision}
		{@const doc = view.document}
		{@const tally = d.tally ?? {}}
		{@const inFavour = tally['Voor'] ?? 0}
		{@const against = tally['Tegen'] ?? 0}
		{@const inFavourPct =
			inFavour + against > 0 ? Math.round((inFavour / (inFavour + against)) * 100) : 50}
		{@const others = Object.entries(tally).filter(
			([choice]) => choice !== 'Voor' && choice !== 'Tegen'
		)}
		{@const dossierNumbers = (node.raw?.props?.dossier_numbers ?? []) as string[]}
		{@const voters = [...(d.votes ?? [])].sort((a, b) => (b.seats ?? 0) - (a.seats ?? 0))}

		<header class="head">
			<span class="kicker">
				<KindGlyph collection="decisions" />
				{bronLabel('decisions')}
				{#if d.date}<span class="dot">·</span>{formatLongDate(d.date)}{/if}
			</span>
			<h2 class="title">{d.subject ?? doc?.title ?? 'Onderwerp niet beschikbaar'}</h2>
			<div class="chips">
				<span
					class="result-chip"
					class:result-chip--passed={d.passed}
					class:result-chip--failed={!d.passed}
				>
					{d.passed ? 'Aangenomen' : 'Verworpen'}
				</span>
				{#each dossierNumbers.slice(0, 3) as number (number)}
					<a
						href={bronHref({ collection: 'dossiers', key: dossierKey(number) })}
						class="dossier-chip"
						data-sveltekit-noscroll>{number}</a
					>
				{/each}
			</div>
		</header>

		{#if doc?.text}
			<section class="sec">
				<h3 class="sec-title">{doc.kind ?? 'Document'}</h3>
				<p class="document-text">{doc.text}</p>
			</section>
		{:else}
			<p class="document-unavailable">Tekst niet beschikbaar.</p>
		{/if}

		<div class="vote-summary">
			<div class="vote-bar">
				<div class="vote-bar-for" style="width: {inFavourPct}%"></div>
			</div>
			<div class="vote-totals">
				<span class="vote-total vote-total--for">{inFavour} voor</span>
				<span class="vote-total-sep">·</span>
				<span class="vote-total vote-total--against">{against} tegen</span>
				{#each others as [choice, seats] (choice)}
					<span class="vote-total-sep">·</span>
					<span class="vote-total vote-total--other">{seats} {choice.toLowerCase()}</span>
				{/each}
			</div>
		</div>

		{#if voters.length > 0}
			<section class="sec">
				<h3 class="sec-title">
					{d.vote_kind === 'member' ? 'Stemverdeling per lid' : 'Stemverdeling per fractie'}
				</h3>
				<ul class="voter-list">
					{#each voters as v (v.voter_id)}
						{@const href = voterHref(v)}
						<li class="voter-row voter-row--{side(v.choice)}">
							<span class="voter-choice">{v.choice}</span>
							{#if href}
								<a class="voter-name" {href} data-sveltekit-noscroll>{v.name ?? v.voter_key}</a>
							{:else}
								<span class="voter-name">{v.name ?? v.voter_key}</span>
							{/if}
							<span class="voter-seats">{v.seats}</span>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	{/if}
</div>

<style>
	.r-decision {
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
	.dot {
		opacity: 0.6;
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
		gap: var(--s-3);
		flex-wrap: wrap;
		align-items: baseline;
	}

	/* The outcome and the dossier numbers are words, not tags. */
	.result-chip,
	.dossier-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		text-decoration: none;
	}
	.result-chip--passed,
	.result-chip--failed {
		color: var(--ink-2);
	}
	.dossier-chip {
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.dossier-chip:hover {
		color: var(--accent);
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
	.document-text {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		line-height: var(--lh-body);
		color: var(--ink);
		white-space: pre-wrap;
		margin: 0;
	}
	.document-unavailable {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 0;
	}

	.vote-summary {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}
	/* Seats for and against are told apart by the word; the bar shows the share only. */
	.vote-bar {
		height: 14px;
		background: var(--rule);
		border-radius: var(--r-2);
		overflow: hidden;
	}
	.vote-bar-for {
		height: 100%;
		background: var(--ink-2);
		transition: width var(--dur-2) var(--ease);
	}
	.vote-totals {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
	}
	.vote-total--for,
	.vote-total--against {
		color: var(--ink-2);
		font-weight: 500;
	}
	.vote-total--other {
		color: var(--ink-3);
	}
	.vote-total-sep {
		color: var(--ink-3);
	}

	.voter-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.voter-row {
		display: grid;
		grid-template-columns: 50px 1fr auto;
		gap: 8px;
		padding: 4px var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		align-items: baseline;
		border-radius: var(--r-1);
		font-size: var(--t-meta);
	}
	.voter-row:hover {
		background: var(--paper-2);
	}
	.voter-choice {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
	}
	.voter-row--for .voter-choice,
	.voter-row--against .voter-choice {
		color: var(--ink-2);
	}
	.voter-row--other .voter-choice {
		color: var(--ink-3);
	}
	.voter-name {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-decoration: none;
	}
	a.voter-name:hover {
		color: var(--accent);
	}
	.voter-seats {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
</style>

<script lang="ts">
	import { getDecision, getDecisionDocument } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import DossierNaam from '$lib/bron/DossierNaam.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import ReaderFrame from './ReaderFrame.svelte';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import { formatLongDate } from './_shared';
	import { ekFactionGroups, votersOf } from './voters';
	import { decisionMethod, decisionOutcome } from '$lib/components/explore/index/decision-kind';
	import { EK_SOURCE, chamberName } from '$lib/components/parliamentary/chamber';

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

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the record is not asked again for that.
	const bronKey = $derived(node.key);

	$effect(() => {
		void attempt;
		const key = bronKey;
		const ac = new AbortController();
		view = { kind: 'loading' };
		Promise.all([getDecision(key), getDecisionDocument(key).catch(() => null)])
			.then(([decision, document]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', decision, document };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Stemming kon niet worden geladen.' };
			});
		return () => ac.abort();
	});

	const side = (choice: string) =>
		choice === 'Voor' ? 'for' : choice === 'Tegen' ? 'against' : 'other';

	/** A voter id is `factions/vvd` or `members/…`; the key alone does not say which. */
	const voterHref = (id: string) => (id.includes('/') ? bronHref(id) : null);
</script>

<ReaderFrame>
	<div class="r-decision">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
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
			{@const voters = votersOf(d)}
			{@const chamber = d.chamber ?? 'TK'}

			<header class="head">
				<span class="kicker">
					<KindGlyph collection="decisions" />
					{bronLabel('decisions')}
					{chamberName(chamber)}
					{#if d.date}<span class="komma">,</span>{formatLongDate(d.date)}{/if}
				</span>
				<h2 class="title">{d.subject ?? doc?.title ?? 'Onderwerp niet in de gegevens'}</h2>
				<div class="chips">
					{#if decisionOutcome(d)}
						<!-- A hamerstuk is passed without a vote; a postponed decision is no outcome. -->
						<span
							class="result-chip"
							class:result-chip--passed={d.passed === true}
							class:result-chip--failed={d.passed === false}
						>
							{decisionOutcome(d)}
						</span>
					{/if}
					<!-- What was voted on, in the source's words: Wetgeving (the bill itself), Amendement, Motie. -->
					{#if d.primary_case_kind}<span class="case-chip">{d.primary_case_kind}</span>{/if}
					{#each uniqueBy(dossierNumbers, (n) => n).slice(0, 3) as number (number)}
						<BronLink ref={`dossiers/${number}`} class="dossier-chip"
							><DossierNaam dossier={number} /></BronLink
						>
					{/each}
				</div>
			</header>

			{#if doc?.text}
				<Sectie titel={doc.kind ?? 'Document'} soort="documents">
					<p class="document-text">{doc.text}</p>
				</Sectie>
			{:else if chamber !== 'EK'}
				<p class="document-unavailable">Tekst niet in de gegevens.</p>
			{/if}

			{#if d.vote_kind}
				<div class="vote-summary">
					<div class="vote-bar">
						<div class="vote-bar-for" style="width: {inFavourPct}%"></div>
					</div>
					<!-- A sentence: 33 voor, 116 tegen, 1 niet deelgenomen. -->
					<p class="vote-totals">
						<span class="vote-total vote-total--for">{inFavour} voor</span>,
						<span class="vote-total vote-total--against">{against} tegen</span
						>{#each others as [choice, seats] (choice)}, <span class="vote-total vote-total--other"
								>{seats} {choice.toLowerCase()}</span
							>{/each}
					</p>
				</div>
			{:else if chamber === 'EK' && decisionMethod(d)}
				<p class="vote-totals">{decisionMethod(d)}</p>
			{:else if d.decision_kind}
				<!-- A decision without votes (a hamerstuk): no tally, the Kamer's own words. -->
				<p class="vote-totals">{d.decision_kind}</p>
			{/if}

			{#if chamber === 'EK'}
				{@const groups = ekFactionGroups(d)}
				{#if groups.length > 0}
					<Sectie titel="Fracties" soort="factions">
						<dl class="ek-factions">
							{#each groups as g (g.label)}
								<dt>{g.label}</dt>
								<dd>{g.names.join(', ')}</dd>
							{/each}
						</dl>
					</Sectie>
				{/if}
				<p class="source">
					Bron: <a href={d.source_url ?? EK_SOURCE.url} rel="external"
						>{EK_SOURCE.name}, {EK_SOURCE.site}</a
					>{d.retrieved_on ? `, geraadpleegd op ${formatLongDate(d.retrieved_on)}` : ''}.
				</p>
			{/if}

			{#if voters.length > 0}
				<Sectie
					titel={d.vote_kind === 'member' ? 'Stemverdeling per lid' : 'Stemverdeling per fractie'}
				>
					<ul class="voter-list">
						{#each voters as v (v.id)}
							{@const href = voterHref(v.id)}
							<li class="voter-row voter-row--{side(v.choice)}">
								<span class="voter-choice"><Stem keuze={v.choice} /></span>
								{#if href}
									<a class="voter-name" {href} data-sveltekit-noscroll>{v.name}</a>
								{:else}
									<span class="voter-name">{v.name}</span>
								{/if}
								{#if v.seats !== null}<span class="voter-seats">{v.seats}</span>{/if}
							</li>
						{/each}
					</ul>
				</Sectie>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-decision {
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
	/* A comma against the word before it: the kicker's gap only after it. */
	.komma {
		margin-left: calc(-1 * 6px);
	}
	.ek-factions {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.ek-factions dt {
		font-weight: 500;
		color: var(--ink);
	}
	.ek-factions dd {
		margin: 0;
		color: var(--ink-2);
	}
	.source {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h2);
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

	/* The outcome, the kind of case and the dossier numbers are words, not tags. */
	.result-chip,
	.case-chip,
	:global(.dossier-chip) {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		text-decoration: none;
	}
	.result-chip--passed,
	.result-chip--failed {
		color: var(--ink-2);
	}
	.case-chip {
		color: var(--ink-3);
	}
	:global(.dossier-chip) {
		color: var(--ink-3);
	}
	:global(.dossier-chip:hover) {
		color: var(--accent);
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
		gap: var(--s-1);
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
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.vote-total--for,
	.vote-total--against {
		color: var(--ink-2);
		font-weight: 500;
	}
	.vote-total--other {
		color: var(--ink-3);
	}

	.voter-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.voter-row {
		display: grid;
		grid-template-columns: max(calc(var(--reader-term, 0px) - var(--s-2)), 50px) 1fr auto;
		gap: var(--s-2);
		padding: var(--s-1) var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		align-items: baseline;
		border-radius: var(--r-1);
		font-size: var(--t-meta);
	}
	.voter-row:hover {
		background: var(--paper-2);
	}
	/* The stem in shape, colour and word (Stem), as on a member's page. */
	.voter-choice {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
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

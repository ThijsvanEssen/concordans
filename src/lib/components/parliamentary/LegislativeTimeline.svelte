<script lang="ts">
	import { uniqueBy } from '$lib/util/unique';
	import { isEkDecision, timelineKind } from './timeline-kind';
	import type { Schema } from '$lib/api/types';
	import { bronHref } from '$lib/bron/href';
	import KindChipFilter from './KindChipFilter.svelte';
	import { CHAMBER_NAME, chamberFromParam } from './chamber';

	type Entry = Schema<'DossierTimelineResponse'>['entries'][number];
	type Tally = Record<string, number>;

	// The body differs per kind of entry; these are the props the entries below read.
	type Body = {
		tally?: Tally;
		/** Null for a decision that is no vote (`Stemmen - uitstellen`). */
		passed?: boolean | null;
		/** Null for a decision without votes: a hamerstuk. */
		vote_kind?: string | null;
		primary_case_kind?: string | null;
		agenda_title?: string;
		minister_name?: string;
		text?: string;
		status?: string;
		url?: string;
		/** A paper's Kamer. */
		chamber?: string | null;
	};
	const bodyOf = (entry: Entry) => (entry.body ?? {}) as unknown as Body;
	const otherChoices = (tally: Tally) =>
		Object.entries(tally).filter(([choice]) => choice !== 'Voor' && choice !== 'Tegen');

	// `entries` arrive newest first, as the API orders them by default.
	let { entries }: { entries: Entry[] } = $props();

	let kindFilter = $state(new Set<string>());
	let newestFirst = $state(true);

	// Kinds by frequency, most common first.
	const kinds = $derived.by(() => {
		const freq = new Map<string, number>();
		for (const e of entries) freq.set(timelineKind(e), (freq.get(timelineKind(e)) ?? 0) + 1);
		return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([kind]) => kind);
	});

	const shown = $derived.by(() => {
		const all = uniqueBy(entries, (e) => e.node_id);
		const rows = kindFilter.size > 0 ? all.filter((e) => kindFilter.has(timelineKind(e))) : all;
		return newestFirst ? rows : [...rows].reverse();
	});

	// An activity carries its `Activiteit.Status` (API 0.9). Without one, an entry dated
	// after today is planned: the Kamer agenda runs ahead.
	// Today in the reader's own time zone, not in UTC.
	const today = new Date().toLocaleDateString('sv-SE');
	// What did not take place is labelled as the source writes it: Gepland, Geannuleerd,
	// Verplaatst, Vervallen.
	const notHeld = (entry: Entry): string | null => {
		const status = entry.node_type === 'activity' ? bodyOf(entry).status : null;
		if (status) return status === 'Uitgevoerd' ? null : status;
		return entry.date && entry.date.slice(0, 10) > today ? 'Gepland' : null;
	};

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

	const COMMITMENT_STATUS: Record<string, string> = {
		open: 'Open',
		done: 'Nagekomen',
		vervallen: 'Vervallen'
	};
</script>

<div class="timeline">
	<div class="timeline-toolbar">
		<KindChipFilter {kinds} selected={kindFilter} onChange={(next) => (kindFilter = next)} />
		<button
			type="button"
			class="order-btn"
			onclick={() => (newestFirst = !newestFirst)}
			aria-label={newestFirst ? 'Sorteer oud naar nieuw' : 'Sorteer nieuw naar oud'}
		>
			<svg width="13" height="13" viewBox="0 0 13 13" fill="none" aria-hidden="true">
				{#if newestFirst}
					<path
						d="M2 3h9M4 6.5h5M6 10h1"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
					/>
				{:else}
					<path
						d="M2 10h9M4 6.5h5M6 3h1"
						stroke="currentColor"
						stroke-width="1.4"
						stroke-linecap="round"
					/>
				{/if}
			</svg>
		</button>
	</div>

	{#if shown.length === 0}
		<p class="timeline-empty">Geen items voor deze selectie.</p>
	{:else}
		<ol class="timeline-list">
			{#each shown as entry (entry.node_id)}
				{@const body = bodyOf(entry)}
				{@const planned = notHeld(entry)}
				<li class="entry" class:entry--planned={!!planned} data-kind={entry.node_type}>
					<div class="entry-meta">
						{#if entry.date}
							<time class="entry-date" datetime={entry.date}>{formatDate(entry.date)}</time>
						{/if}
						{#if planned}<span class="entry-planned">{planned}</span>{/if}
						<span class="entry-kind">{timelineKind(entry)}</span>
						{#if entry.node_type === 'document' && chamberFromParam(body.chamber)}
							{@const c = chamberFromParam(body.chamber)!}
							<abbr class="entry-chamber" title={CHAMBER_NAME[c]}>{c}</abbr>
						{/if}
					</div>

					{#if entry.node_type === 'decision'}
						{@const tally = body.tally ?? {}}
						{@const inFavour = tally['Voor'] ?? 0}
						{@const against = tally['Tegen'] ?? 0}
						{@const passed = body.passed ?? null}
						{@const voted = !!body.vote_kind}
						<!-- The Eerste Kamer votes too, but its site gives no seats: no tally is no hamerstuk. -->
						{@const ek = isEkDecision(entry.node_id)}
						{@const outcome =
							passed === null
								? null
								: !voted && passed && !ek
									? 'Zonder stemming aangenomen'
									: passed
										? 'Aangenomen'
										: 'Verworpen'}
						{@const inFavourPct =
							inFavour + against > 0 ? Math.round((inFavour / (inFavour + against)) * 100) : 50}
						<div class="entry-body">
							{#if entry.title}
								<a
									class="entry-title entry-title--link"
									href={bronHref(entry.node_id)}
									data-sveltekit-noscroll>{entry.title}</a
								>
							{/if}

							{#if voted}
								<div class="decision-bar">
									<div class="decision-bar-for" style="width: {inFavourPct}%"></div>
								</div>
							{/if}
							<div class="decision-totals">
								<!-- A sentence: 33 voor, 116 tegen, 1 niet deelgenomen. A hamerstuk has none. -->
								{#if voted}
									<span
										><span class="decision-total--for">{inFavour} voor</span>,
										<span class="decision-total--against">{against} tegen</span
										>{#each otherChoices(tally) as [choice, seats] (choice)}, <span
												class="decision-total--other">{seats} {choice.toLowerCase()}</span
											>{/each}</span
									>
								{/if}
								<!-- What was voted on (Wetgeving, Amendement, Motie), then the result. -->
								<span class="decision-outcome">
									{#if ek}<span class="decision-kind">Eerste Kamer</span
										>{:else if body.primary_case_kind}<span class="decision-kind"
											>{body.primary_case_kind}</span
										>{/if}
									{#if outcome}
										<span
											class:outcome--passed={passed === true}
											class:outcome--failed={passed === false}>{outcome}</span
										>
									{/if}
								</span>
							</div>
						</div>
					{:else if entry.node_type === 'activity'}
						{@const title = body.agenda_title || entry.title || ''}
						<div class="entry-body">
							{#if title}
								<a
									class="entry-title entry-title--link"
									href={bronHref(entry.node_id)}
									data-sveltekit-noscroll>{title}</a
								>
							{/if}
							{#if entry.tk_url}
								<a href={entry.tk_url} class="entry-link" target="_blank" rel="noopener noreferrer"
									>Bekijk op tweedekamer.nl ↗</a
								>
							{/if}
						</div>
					{:else if entry.node_type === 'commitment'}
						{@const status = body.status ?? 'open'}
						<div class="entry-body">
							{#if body.minister_name}<p class="entry-minister">{body.minister_name}</p>{/if}
							{#if body.text}<p class="entry-commitment">{body.text}</p>{/if}
							<span class="commitment-status status--{status}">
								{COMMITMENT_STATUS[status] ?? 'Onbekend'}
							</span>
						</div>
					{:else}
						{@const url = entry.tk_url ?? body.url}
						<div class="entry-body">
							{#if entry.title}
								<a
									class="entry-title entry-title--link"
									href={bronHref(entry.node_id)}
									data-sveltekit-noscroll>{entry.title}</a
								>
							{/if}
							{#if url}
								<a href={url} class="entry-link" target="_blank" rel="noopener noreferrer">
									Document openen →
								</a>
							{/if}
						</div>
					{/if}
				</li>
			{/each}
		</ol>
	{/if}
</div>

<style>
	.timeline {
		display: flex;
		flex-direction: column;
		gap: var(--s-4);
	}

	.timeline-toolbar {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
		flex-wrap: wrap;
	}

	.timeline-toolbar :global(.chip-row) {
		flex: 1;
	}

	.order-btn {
		flex-shrink: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		height: 28px;
		background: transparent;
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink-2);
		cursor: pointer;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}

	.order-btn:hover {
		background: var(--paper-2);
		color: var(--ink);
	}

	.timeline-empty {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-3);
		padding: var(--s-5) 0;
	}

	.timeline-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0;
		border-left: 1.5px solid var(--rule);
		padding-left: var(--s-5);
	}

	/* Entries keep apart by padding and the hover field; no rule between them. */
	.entry {
		position: relative;
		padding: var(--s-4) var(--s-2) var(--s-5);
		margin: 0 calc(-1 * var(--s-2));
		border-radius: var(--r-1);
	}

	.entry:hover {
		background: var(--paper-2);
	}

	/* The dot on the rail; the kind is told by the word next to the date. */
	.entry::before {
		content: '';
		position: absolute;
		left: calc(-1 * var(--s-5) - 4px - var(--s-2));
		top: calc(var(--s-4) + 5px);
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--rule-strong);
		border: 1.5px solid var(--paper);
	}

	.entry[data-kind='decision']::before {
		background: var(--ink);
	}
	.entry[data-kind='commitment']::before,
	.entry[data-kind='activity']::before {
		background: var(--ink-2);
	}

	.entry-meta {
		display: flex;
		align-items: baseline;
		gap: var(--s-3);
		margin-bottom: var(--s-2);
	}

	.entry-date {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		flex-shrink: 0;
	}

	.entry-kind {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		font-weight: 500;
	}
	/* TK or EK, the full name on hover: where a paper was lodged. */
	.entry-chamber {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
		text-decoration: none;
		border-bottom: 1px dotted var(--rule-strong);
		cursor: help;
	}

	.entry-body {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}

	.entry-title {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	.entry-title--link {
		text-decoration: none;
		align-self: flex-start;
	}
	.entry-title--link:hover {
		color: var(--accent);
	}

	.entry-link {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
		text-decoration: none;
		align-self: flex-start;
	}

	.entry-link:hover {
		color: var(--accent);
	}

	/* ── Decision ─────────────────────────────────────────────────────────── */
	/* Bar and totals as in DecisionReader; for and against are told apart by the word. */
	.decision-bar {
		height: 6px;
		background: var(--rule);
		border-radius: var(--r-1);
		overflow: hidden;
		margin-top: var(--s-2);
	}
	.decision-bar-for {
		height: 100%;
		background: var(--ink-2);
		border-radius: var(--r-1) 0 0 var(--r-1);
		transition: width var(--dur-2) var(--ease);
	}

	.decision-totals {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: var(--s-1);
		font-family: var(--font-sans);
		font-size: var(--t-micro);
	}
	.decision-total--for,
	.decision-total--against {
		color: var(--ink-2);
		font-weight: 500;
	}
	.decision-total--other {
		color: var(--ink-3);
	}

	/* The outcome is a word, not a tag. */
	.decision-outcome {
		margin-left: auto;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
	}
	.decision-kind {
		color: var(--ink-3);
		font-weight: 400;
		margin-right: 6px;
	}
	.outcome--passed,
	.outcome--failed {
		color: var(--ink-2);
	}

	/* Commitment */
	.entry-minister {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink-2);
		margin: 0;
	}

	.entry-commitment {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		margin: 0;
		line-height: var(--lh-body);
	}

	/* The status is a word, not a tag. */
	.commitment-status {
		align-self: flex-start;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	.status--open,
	.status--unknown,
	.status--done,
	.status--vervallen {
		color: var(--ink-3);
	}

	.entry--planned {
		opacity: 0.7;
	}

	.entry-planned {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
</style>

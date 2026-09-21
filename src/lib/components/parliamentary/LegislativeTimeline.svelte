<script lang="ts">
	import type { Schema } from '$lib/api/types';
	import { parseNodeId } from '$lib/vocabulary';
	import KindChipFilter from './KindChipFilter.svelte';

	type Entry = Schema<'TimelineEntryDTO'>;
	type Tally = Record<string, number>;

	// The schema leaves `body` untyped; these are the props the entries below read.
	type Body = {
		tally?: Tally;
		passed?: boolean;
		agenda_title?: string;
		minister_name?: string;
		text?: string;
		status?: string;
		url?: string;
	};
	const bodyOf = (entry: Entry) => (entry.body ?? {}) as Body;
	const otherChoices = (tally: Tally) =>
		Object.entries(tally).filter(([choice]) => choice !== 'Voor' && choice !== 'Tegen');

	// `entries` arrive newest first, as the API orders them by default.
	let { entries }: { entries: Entry[] } = $props();

	let kindFilter = $state(new Set<string>());
	let newestFirst = $state(true);

	// Kinds by frequency, most common first.
	const kinds = $derived.by(() => {
		const freq = new Map<string, number>();
		for (const e of entries) freq.set(e.kind, (freq.get(e.kind) ?? 0) + 1);
		return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([kind]) => kind);
	});

	const shown = $derived.by(() => {
		const rows = kindFilter.size > 0 ? entries.filter((e) => kindFilter.has(e.kind)) : entries;
		return newestFirst ? rows : [...rows].reverse();
	});

	const formatDate = (iso: string) =>
		new Date(iso).toLocaleDateString('nl-NL', { day: 'numeric', month: 'long', year: 'numeric' });

	const COMMITMENT_STATUS: Record<string, string> = {
		open: 'Open',
		done: 'Nagekomen',
		vervallen: 'Vervallen'
	};

	/** The agenda title starts with the date, which is shown above it already. */
	const withoutDate = (title: string) => title.replace(/^\d{4}-\d{2}-\d{2}\s*[–—-]+\s*/, '');
</script>

<div class="timeline">
	<div class="timeline-toolbar">
		<KindChipFilter {kinds} selected={kindFilter} onChange={(next) => (kindFilter = next)} />
		<button
			type="button"
			class="order-btn"
			onclick={() => (newestFirst = !newestFirst)}
			aria-label={newestFirst ? 'Sorteer oud naar nieuw' : 'Sorteer nieuw naar oud'}
			title={newestFirst ? 'Sorteer oud naar nieuw' : 'Sorteer nieuw naar oud'}
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
				<li class="entry" data-kind={entry.node_type}>
					<div class="entry-meta">
						{#if entry.date}
							<time class="entry-date" datetime={entry.date}>{formatDate(entry.date)}</time>
						{/if}
						<span class="entry-kind">{entry.kind}</span>
					</div>

					{#if entry.node_type === 'decision'}
						{@const tally = body.tally ?? {}}
						{@const inFavour = tally['Voor'] ?? 0}
						{@const against = tally['Tegen'] ?? 0}
						{@const passed = !!body.passed}
						{@const inFavourPct =
							inFavour + against > 0 ? Math.round((inFavour / (inFavour + against)) * 100) : 50}
						{@const decisionKey = parseNodeId(entry.node_id)?.key}
						<div class="entry-body">
							{#if entry.title}<p class="entry-title">{entry.title}</p>{/if}

							<div class="decision-bar" title="Voor: {inFavour} · Tegen: {against}">
								<div class="decision-bar-for" style="width: {inFavourPct}%"></div>
							</div>
							<div class="decision-totals">
								<span class="decision-total--for">{inFavour} voor</span>
								<span class="decision-total-sep">·</span>
								<span class="decision-total--against">{against} tegen</span>
								{#each otherChoices(tally) as [choice, seats] (choice)}
									<span class="decision-total-sep">·</span>
									<span class="decision-total--other">{seats} {choice.toLowerCase()}</span>
								{/each}
								<span
									class="decision-outcome"
									class:outcome--passed={passed}
									class:outcome--failed={!passed}
								>
									{passed ? 'Aangenomen' : 'Verworpen'}
								</span>
							</div>

							{#if decisionKey}
								<a class="decision-link" href="/explore?mode=split&focus=decisions/{decisionKey}"
									>Open stemming →</a
								>
							{/if}
						</div>
					{:else if entry.node_type === 'activity'}
						{@const title = withoutDate(body.agenda_title || entry.title || '')}
						<div class="entry-body">
							{#if title}<p class="entry-title">{title}</p>{/if}
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
							{#if entry.title}<p class="entry-title">{entry.title}</p>{/if}
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
		background: var(--paper-2);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		color: var(--ink-3);
		cursor: pointer;
		transition:
			background 80ms,
			color 80ms;
	}

	.order-btn:hover {
		background: var(--paper-3);
		color: var(--ink);
	}

	.timeline-empty {
		font-family: var(--font-serif);
		font-style: italic;
		font-size: var(--t-body-2);
		color: var(--ink-4);
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

	.entry {
		position: relative;
		padding: var(--s-4) 0 var(--s-5);
		border-bottom: 1px solid var(--rule);
	}

	.entry:last-child {
		border-bottom: none;
	}

	/* timeline dot */
	.entry::before {
		content: '';
		position: absolute;
		left: calc(-1 * var(--s-5) - 4px);
		top: calc(var(--s-4) + 5px);
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: var(--rule-strong);
		border: 1.5px solid var(--paper);
	}

	.entry[data-kind='decision']::before {
		background: var(--spine);
	}
	.entry[data-kind='commitment']::before {
		background: var(--warn);
	}
	.entry[data-kind='activity']::before {
		background: var(--indigo);
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
		color: var(--ink-4);
		letter-spacing: 0.02em;
		flex-shrink: 0;
	}

	.entry-kind {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		color: var(--ink-4);
		font-weight: 500;
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

	.entry-author {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-3);
		margin: 0;
	}

	.entry-summary {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
		margin: 0;
		line-height: var(--lh-body);
	}

	.entry-targets {
		display: flex;
		align-items: center;
		gap: var(--s-2);
		flex-wrap: wrap;
	}

	.entry-targets-label {
		font-family: var(--font-sans);
		font-size: 10px;
		text-transform: uppercase;
		letter-spacing: var(--track-caps);
		color: var(--ink-4);
	}

	.article-chip {
		display: inline-flex;
		align-items: center;
		height: 20px;
		padding: 0 8px;
		background: var(--paper-3);
		border: 1px solid var(--rule-strong);
		border-radius: var(--r-1);
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-2);
		text-decoration: none;
		transition:
			background 80ms,
			color 80ms;
	}

	.article-chip:hover {
		background: var(--spine-faint);
		color: var(--spine);
	}

	.entry-link {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--spine);
		text-decoration: none;
		border-bottom: 1px solid var(--spine-faint);
		align-self: flex-start;
	}

	.entry-link:hover {
		border-bottom-color: var(--spine);
	}

	/* ── Decision ─────────────────────────────────────────────────────────── */
	/* Bar and totals as in DecisionReader. */
	.decision-bar {
		height: 6px;
		background: color-mix(in srgb, var(--red, #dc2626) 18%, var(--paper-3));
		border-radius: 3px;
		overflow: hidden;
		margin-top: var(--s-2);
	}
	.decision-bar-for {
		height: 100%;
		background: var(--green, #16a34a);
		border-radius: 3px 0 0 3px;
		transition: width 200ms ease;
	}

	.decision-totals {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		margin-top: 4px;
		font-family: var(--font-sans);
		font-size: 12px;
	}
	.decision-total--for {
		color: var(--green, #16a34a);
		font-weight: 600;
	}
	.decision-total--against {
		color: var(--red, #dc2626);
		font-weight: 600;
	}
	.decision-total--other {
		color: var(--ink-3);
	}
	.decision-total-sep {
		color: var(--ink-4);
	}

	.decision-outcome {
		margin-left: auto;
		padding: 2px 8px;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 600;
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
		border: 1px solid var(--rule);
	}
	.outcome--passed {
		background: color-mix(in srgb, var(--green, #16a34a) 8%, var(--paper));
		color: var(--green, #16a34a);
		border-color: color-mix(in srgb, var(--green, #16a34a) 22%, transparent);
	}
	.outcome--failed {
		background: color-mix(in srgb, var(--red, #dc2626) 8%, var(--paper));
		color: var(--red, #dc2626);
		border-color: color-mix(in srgb, var(--red, #dc2626) 22%, transparent);
	}

	.decision-link {
		font-family: var(--font-sans);
		font-size: 11px;
		color: var(--spine);
		text-decoration: none;
		border-bottom: 1px solid var(--spine-faint);
		align-self: flex-start;
		margin-top: var(--s-2);
	}
	.decision-link:hover {
		border-bottom-color: var(--spine);
	}

	/* Commitment */
	.entry-minister {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 600;
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

	.commitment-status {
		align-self: flex-start;
		padding: 2px 8px;
		border-radius: var(--r-1);
		font-family: var(--font-sans);
		font-size: 10px;
		font-weight: 500;
		letter-spacing: var(--track-caps);
		text-transform: uppercase;
	}

	.status--open,
	.status--unknown {
		background: var(--paper-3);
		color: var(--ink-3);
	}

	.status--done {
		background: #e5efe4;
		color: var(--positive);
	}

	.status--vervallen {
		background: var(--warn-faint);
		color: var(--warn);
	}
</style>

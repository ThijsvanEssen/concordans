<script lang="ts">
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronLabel } from '$lib/vocabulary';
	import { str } from '$lib/components/parliamentary/data';
	import { EK_SOURCE, chamberName } from '$lib/components/parliamentary/chamber';
	import { formatDate, formatLongDate } from './_shared';
	import { ekVoteLine } from './voters';

	/** A member of the fractie's board, as the Eerste Kamer lists it (API 0.65). */
	type BoardSeat = { function?: string; name?: string; member?: string | null; since?: string };
	const boardOf = (props: Record<string, unknown> | null | undefined): BoardSeat[] =>
		Array.isArray(props?.board) ? (props.board as BoardSeat[]) : [];

	let { node }: { node: GraphNode } = $props();

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; faction: Schema<'FactionDetailDTO'> };

	let view = $state<State>({ kind: 'loading' });

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/factions/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((faction) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', faction };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Fractie kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	// How an Eerste Kamer fractie voted on the bills (API 0.68); the Tweede Kamer's are
	// with its members.
	let votes = $state<Schema<'EkFactionVotesResponse'> | null>(null);
	$effect(() => {
		const f = view.kind === 'loaded' ? view.faction : null;
		votes = null;
		if (!f || str(f.props?.chamber) !== 'EK') return;
		const ac = new AbortController();
		unwrap(
			api.GET('/api/factions/{key}/votes', { params: { path: { key: f.key } }, signal: ac.signal })
		)
			.then((r) => {
				if (!ac.signal.aborted) votes = r;
			})
			.catch(() => {});
		return () => ac.abort();
	});

	const CHOICE: Record<string, string> = {
		voor: 'Voor',
		tegen: 'Tegen',
		'aantekening gevraagd': 'Aantekening'
	};
</script>

<ReaderFrame>
	<div class="r-faction">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const f = view.faction}
			{@const name = str(f.props?.name)}
			{@const abbreviation = str(f.props?.abbreviation)}
			{@const seats = f.props?.seats}
			{@const chamber = str(f.props?.chamber)}
			{@const ek = chamber === 'EK'}
			{@const read = str(f.props?.retrieved_on)}
			{@const since = str(f.props?.data_since)}
			{@const board = boardOf(f.props)}
			{@const composed = read
				? `Samenstelling op ${formatLongDate(read)}${since ? `, gegevens sinds ${formatLongDate(since)}` : ''}. `
				: ''}
			<header class="head">
				<span class="kicker"
					><KindGlyph collection="factions" />{bronLabel('factions')} · {chamberName(chamber)}</span
				>
				<h2 class="title">{abbreviation ?? name ?? f.key}</h2>
				{#if name && abbreviation && name !== abbreviation}
					<p class="sub">{name}</p>
				{/if}
				{#if typeof seats === 'number'}
					<div class="chips">
						<span class="seats-chip"
							>{seats}
							{seats === 1 ? 'zetel' : 'zetels'}{ek && read
								? ` op ${formatLongDate(read)}`
								: ''}</span
						>
					</div>
				{/if}
			</header>

			{#if board.length > 0}
				<Sectie titel="Fractiebestuur" soort="members">
					<dl class="board">
						{#each board as seat, i (i)}
							<dt>{seat.function ?? ''}</dt>
							<dd>
								{#if seat.member}<BronLink ref={`members/${seat.member}`}>{seat.name}</BronLink
									>{:else}{seat.name}{/if}{#if seat.since}<span class="since"
										>, sinds {formatLongDate(seat.since)}</span
									>{/if}
							</dd>
						{/each}
					</dl>
				</Sectie>
			{/if}

			{#if votes && votes.total > 0}
				<Sectie titel="Stemgedrag in de Eerste Kamer" soort="decisions">
					<p class="vote-line">{ekVoteLine(votes.counts, votes.total)}.</p>
					<ul class="votes">
						{#each votes.items as v (v.decision_key)}
							<li class="vote">
								<span class="vote-choice vote-choice--{v.choice.split(' ')[0]}"
									>{CHOICE[v.choice] ?? v.choice}</span
								>
								<BronLink ref={`decisions/${v.decision_key}`} class="vote-subject"
									>{v.subject ?? v.dossier_numbers?.[0] ?? '—'}</BronLink
								>
								<span class="vote-meta"
									>{v.date ? formatDate(v.date) : ''}{v.result
										? `, ${v.result.toLowerCase()}`
										: ''}</span
								>
							</li>
						{/each}
					</ul>
				</Sectie>
			{/if}

			{#if ek}
				<p class="source">
					{composed}Bron:
					<a href={str(f.props?.url) ?? EK_SOURCE.url} rel="external"
						>{EK_SOURCE.name}, {EK_SOURCE.site}</a
					>.
				</p>
			{/if}
		{/if}
	</div>
</ReaderFrame>

<style>
	.r-faction {
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
		font-size: var(--t-h2);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
	}
	.sub {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 0;
	}
	.chips {
		display: flex;
		gap: var(--s-1);
	}
	.board {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.board dt {
		color: var(--ink-3);
	}
	.board dt::first-letter {
		text-transform: uppercase;
	}
	.board dd {
		margin: 0;
		color: var(--ink);
	}
	.since {
		color: var(--ink-3);
	}
	.vote-line {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		color: var(--ink-2);
	}
	.votes {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
	}
	.vote {
		display: grid;
		grid-template-columns: 88px minmax(0, 1fr);
		gap: var(--s-1) var(--s-3);
		padding: var(--s-2) 0;
		border-top: 1px solid var(--rule);
	}
	.vote-choice {
		grid-row: span 2;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
	}
	.vote-choice--tegen {
		color: var(--accent);
	}
	.votes :global(.vote-subject) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.vote-meta {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.source {
		margin: 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The seat count is a word, not a tag. */
	.seats-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
</style>

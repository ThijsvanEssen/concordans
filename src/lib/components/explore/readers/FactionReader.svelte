<script lang="ts">
	import { bewaarItem } from '$lib/map/map';
	import { naamVan } from '$lib/bron/menselijk';
	import ReaderHead from './ReaderHead.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { str } from '$lib/components/parliamentary/data';
	import { EK_SOURCE } from '$lib/components/parliamentary/chamber';
	import { formatDate, formatLongDate } from './_shared';
	import { ekVoteLine } from './voters';
	import { stemmingNaam } from '$lib/components/parliamentary/stemming';

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
	// The key, not the node: a new node of the same bron (its light node, then the full one)
	// does not load it again and empty the reader for a moment (UX-toets 0.79.43, #33).
	const bronKey = $derived(node.key);

	$effect(() => {
		void attempt;
		const key = bronKey;
		const ac = new AbortController();
		view = { kind: 'loading' };
		unwrap(api.GET('/api/factions/{key}', { params: { path: { key } }, signal: ac.signal }))
			.then((faction) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', faction };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Fractie kon niet worden geladen.' };
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

	// The members of a Tweede Kamer fractie, in a request of their own after the head: the
	// chair as the source names a membership (`Fractievoorzitter`), the members by name. A phone
	// shows the reader alone; without this it held the name and the seats only (Thijs, 9 Oct).
	type Lid = Schema<'MemberDTO'>;
	let leden = $state<{ staat: 'laden' | 'klaar' | 'fout'; lijst: Lid[] }>({
		staat: 'laden',
		lijst: []
	});
	$effect(() => {
		const f = view.kind === 'loaded' ? view.faction : null;
		leden = { staat: 'laden', lijst: [] };
		if (!f || str(f.props?.chamber) === 'EK') return;
		const ac = new AbortController();
		unwrap(
			api.GET('/api/members', {
				params: { query: { party: f.key, active: true, limit: 200 } },
				signal: ac.signal
			})
		)
			.then((r) => {
				if (ac.signal.aborted) return;
				const lijst = [...(r as Lid[])].sort((a, b) =>
					(a.family_name ?? a.name ?? '').localeCompare(b.family_name ?? b.name ?? '', 'nl')
				);
				leden = { staat: 'klaar', lijst };
			})
			.catch(() => {
				if (!ac.signal.aborted) leden = { staat: 'fout', lijst: [] };
			});
		return () => ac.abort();
	});
	/** Its current membership of this fractie names the chair (`Fractievoorzitter`). */
	const isVoorzitter = (m: Lid, key: string) =>
		(m.faction_memberships ?? []).some(
			(fm) => fm.faction_key === key && !fm.to_date && /voorzitter/i.test(fm.role ?? '')
		);

	const CHOICE: Record<string, string> = {
		voor: 'Voor',
		tegen: 'Tegen',
		'aantekening gevraagd': 'Aantekening'
	};
</script>

<ReaderFrame>
	<div class="r-faction">
		{#if view.kind === 'loading'}
			<p class="loading stil">Laden…</p>
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
			{@const sinds = str(f.props?.active_from)}
			{@const composed = read
				? `Samenstelling op ${formatLongDate(read)}${since ? `, gegevens sinds ${formatLongDate(since)}` : ''}. `
				: ''}
			{@const titel = abbreviation ?? name ?? naamVan('factions', f)}
			<!-- The Kamer stands in the band (Kamer: Tweede Kamer), not again here (Thijs, 10 Oct). -->
			<ReaderHead
				collection="factions"
				title={titel}
				acties={{
					bewaar: bewaarItem(node.id, { kort: titel, voluit: name ?? titel })
				}}
			>
				{#snippet onderTitel()}
					{#if name && abbreviation && name !== abbreviation}<p class="sub">{name}</p>{/if}
				{/snippet}
				{#snippet status()}
					{#if typeof seats === 'number'}
						<p class="woorden">
							<span class="zetels"
								>{seats}
								{seats === 1 ? 'zetel' : 'zetels'}{ek && read
									? ` op ${formatLongDate(read)}`
									: ''}</span
							>{#if sinds && !ek}, <span class="sinds">fractie sinds {formatLongDate(sinds)}</span
								>{/if}
						</p>
					{/if}
				{/snippet}
			</ReaderHead>

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

			{#if !ek}
				{@const voorzitters = leden.lijst.filter((m) => isVoorzitter(m, f.key))}
				{#if voorzitters.length > 0}
					<dl class="board">
						{#each voorzitters as m (m.key)}
							<dt>Fractievoorzitter</dt>
							<dd><BronLink ref={`members/${m.key}`}>{m.name}</BronLink></dd>
						{/each}
					</dl>
				{/if}
				<Sectie
					titel="Leden"
					soort="members"
					aantal={leden.staat === 'klaar' ? leden.lijst.length : null}
				>
					{#if leden.staat === 'laden'}
						<p class="loading stil">Laden…</p>
					{:else if leden.staat === 'fout'}
						<p class="error">Leden konden niet worden geladen.</p>
					{:else if leden.lijst.length === 0}
						<p class="loading stil">Geen leden in de gegevens.</p>
					{:else}
						<ul class="leden">
							{#each leden.lijst as m (m.key)}
								<li><BronLink ref={`members/${m.key}`}>{m.name}</BronLink></li>
							{/each}
						</ul>
					{/if}
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
									>{stemmingNaam(v.subject, v.dossiers?.[0] ?? v.dossier_numbers?.[0])}</BronLink
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
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading,
	.error {
		margin: 0;
	}

	.head {
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.sub {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink-3);
		margin: 0;
	}
	.woorden {
		margin: 0;
	}
	.board {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
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
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
	}
	.vote-choice--tegen {
		color: var(--uitkomst-nee);
	}
	.votes :global(.vote-subject) {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
		color: var(--ink);
	}
	.vote-meta {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.source {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The seat count is a word, not a tag. */
	.zetels {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-2);
	}
	.sinds {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	/* The members in two columns where the line is wide enough, one on a phone. */
	.leden {
		list-style: none;
		margin: 0;
		padding: 0;
		columns: 2 12rem;
		column-gap: var(--s-6);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
	}
	.leden li {
		break-inside: avoid;
	}
</style>

<script lang="ts">
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { plural, textOf } from '$lib/text/words';
	import { korteDatum, langeDatum } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	import { naamVan } from '$lib/bron/menselijk';
	import ReaderHead from './ReaderHead.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import { getFaction, getFactionVotes } from '$lib/api/factions';
	import { getMembers } from '$lib/api/members';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { EK_SOURCE } from '$lib/components/parliamentary/chamber';
	import { ekVoteLine } from './voters';
	import { stemmingNaam } from '$lib/components/parliamentary/stemming';
	import { load } from '$lib/util/load.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	/** A member of the fractie's board, as the Eerste Kamer lists it (API 0.65). */
	type BoardSeat = { function?: string; name?: string; member?: string | null; since?: string };
	const boardOf = (props: Record<string, unknown> | null | undefined): BoardSeat[] =>
		Array.isArray(props?.board) ? (props.board as BoardSeat[]) : [];

	let { node }: { node: GraphNode } = $props();

	// The key, not the node: a new node of the same bron (its light node, then the full one)
	// does not load it again and empty the reader for a moment (UX-toets 0.79.43, #33).
	const faction = load(
		() => node.key,
		(key, signal) => getFaction(key, signal),
		'Fractie'
	);
	const loaded = $derived(faction.state.status === 'ready' ? faction.state.data : null);
	const isEk = $derived(textOf(loaded?.props?.chamber) === 'EK');

	// How an Eerste Kamer fractie voted on the bills (API 0.68); the Tweede Kamer's are
	// with its members.
	const votes = load(
		() => (loaded && isEk ? loaded.key : null),
		(key, signal) => (key ? getFactionVotes(key, signal) : Promise.resolve(null)),
		'Stemgedrag van de fractie'
	);

	// The members of a Tweede Kamer fractie, in a request of their own after the head: the
	// chair as the source names a membership (`Fractievoorzitter`), the members by name. A phone
	// shows the reader alone; without this it held the name and the seats only (Thijs, 9 Oct).
	type Lid = Schema<'MemberDTO'>;
	const leden = load(
		() => (loaded && !isEk ? loaded.key : null),
		async (key, signal): Promise<Lid[]> => {
			if (!key) return [];
			const r = await getMembers({ party: key, active: true, limit: 200 }, signal);
			return [...r].sort((a, b) =>
				(a.family_name ?? a.name ?? '').localeCompare(b.family_name ?? b.name ?? '', 'nl')
			);
		},
		'Leden van de fractie'
	);
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

<ReaderFrame state={faction.state} what="Fractie" retry={faction.retry}>
	{#snippet children(f)}
		{@const name = textOf(f.props?.name)}
		{@const abbreviation = textOf(f.props?.abbreviation)}
		{@const seats = f.props?.seats}
		{@const chamber = textOf(f.props?.chamber)}
		{@const ek = chamber === 'EK'}
		{@const read = textOf(f.props?.retrieved_on)}
		{@const since = textOf(f.props?.data_since)}
		{@const board = boardOf(f.props)}
		{@const sinds = textOf(f.props?.active_from)}
		{@const titel = abbreviation ?? name ?? naamVan('factions', f)}
		<div class="r-faction">
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
				{#snippet statusLine()}
					{#if typeof seats === 'number'}
						<p class="woorden">
							<span class="zetels"
								>{seats}
								{plural(seats, 'zetel', 'zetels')}{ek && read
									? ` op ${langeDatum(read)}`
									: ''}</span
							>{#if sinds && !ek}, <span class="sinds">fractie sinds {langeDatum(sinds)}</span>{/if}
						</p>
					{/if}
				{/snippet}
			</ReaderHead>

			{#if board.length > 0}
				<Sectie title="Fractiebestuur" collection="members">
					<dl class="board">
						{#each board as seat, i (i)}
							<dt>{seat.function ?? ''}</dt>
							<dd>
								{#if seat.member}<BronLink ref={`members/${seat.member}`}>{seat.name}</BronLink
									>{:else}{seat.name}{/if}{#if seat.since}<span class="since"
										>, sinds {langeDatum(seat.since)}</span
									>{/if}
							</dd>
						{/each}
					</dl>
				</Sectie>
			{/if}

			{#if !ek}
				{@const lijst = leden.state.status === 'ready' ? leden.state.data : []}
				{@const voorzitters = lijst.filter((m) => isVoorzitter(m, f.key))}
				{#if voorzitters.length > 0}
					<dl class="board">
						{#each voorzitters as m (m.key)}
							<dt>Fractievoorzitter</dt>
							<dd><BronLink ref={`members/${m.key}`}>{m.name}</BronLink></dd>
						{/each}
					</dl>
				{/if}
				<Sectie
					title="Leden"
					collection="members"
					aantal={leden.state.status === 'ready' ? lijst.length : null}
				>
					<LoadState state={leden.state} what="De ledenlijst" retry={leden.retry}>
						{#snippet empty()}<p class="stil">Geen leden in de gegevens.</p>{/snippet}
						{#snippet children(lijst)}
							<ul class="leden">
								{#each lijst as m (m.key)}
									<li><BronLink ref={`members/${m.key}`}>{m.name}</BronLink></li>
								{/each}
							</ul>
						{/snippet}
					</LoadState>
				</Sectie>
			{/if}

			{#if votes.state.status === 'error'}
				<Sectie title="Stemgedrag in de Eerste Kamer" collection="decisions">
					<LoadState state={votes.state} what="Het stemgedrag" retry={votes.retry} />
				</Sectie>
			{:else if votes.state.status === 'ready' && votes.state.data && votes.state.data.total > 0}
				{@const stemmen = votes.state.data}
				<Sectie title="Stemgedrag in de Eerste Kamer" collection="decisions">
					<p class="vote-line">{ekVoteLine(stemmen.counts, stemmen.total)}.</p>
					<ul class="votes">
						{#each stemmen.items as v (v.decision_key)}
							<li class="vote">
								<span class="vote-choice vote-choice--{v.choice.split(' ')[0]}"
									>{CHOICE[v.choice] ?? v.choice}</span
								>
								<BronLink ref={`decisions/${v.decision_key}`} class="vote-subject"
									>{stemmingNaam(v.subject, v.dossiers?.[0] ?? v.dossier_numbers?.[0])}</BronLink
								>
								<span class="vote-meta"
									>{v.date ? korteDatum(v.date) : ''}{v.result
										? `, ${v.result.toLowerCase()}`
										: ''}</span
								>
							</li>
						{/each}
					</ul>
				</Sectie>
			{/if}

			{#if ek}
				<BronRegel
					composedOn={read}
					dataSince={since}
					label={`${EK_SOURCE.name}, ${EK_SOURCE.site}`}
					href={textOf(f.props?.url) ?? EK_SOURCE.url}
				/>
			{/if}
		</div>
	{/snippet}
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

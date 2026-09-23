<script lang="ts">
	import { api, unwrap } from '$lib/api/client';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref } from '$lib/bron/href';
	import { bronLabel } from '$lib/vocabulary';
	import { getMemberVotes } from '$lib/components/parliamentary/data';
	import { initials } from '$lib/util/initials';
	import { formatDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type Vote = Schema<'MemberVoteDTO'>;

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				member: Schema<'MemberDTO'>;
				votes: Schema<'MemberVotesResponse'> | null;
		  };

	const VOTES_PREVIEW = 20;
	const CHOICE_ORDER = ['Voor', 'Tegen'];

	let view = $state<State>({ kind: 'loading' });
	let showAllVotes = $state(false);

	$effect(() => {
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		showAllVotes = false;
		Promise.all([
			unwrap(api.GET('/api/members/{key}', { params: { path: { key } }, signal: ac.signal })),
			getMemberVotes(key).catch(() => null)
		])
			.then(([member, votes]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', member, votes };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Kamerlid kon niet geladen worden.' };
			});
		return () => ac.abort();
	});

	// Votes are grouped by the faction the member belonged to at the time, so a
	// switch of faction reads as separate blocks, and then by choice.
	type PartyGroup = { party: string; total: number; byChoice: [string, Vote[]][] };
	function groupVotes(votes: Vote[]): PartyGroup[] {
		const byParty = Map.groupBy(votes, (v) => v.party ?? '—');
		const rank = (choice: string) => {
			const i = CHOICE_ORDER.indexOf(choice);
			return i === -1 ? CHOICE_ORDER.length : i;
		};
		return [...byParty]
			.map(([party, rows]) => ({
				party,
				total: rows.length,
				byChoice: [...Map.groupBy(rows, (v) => v.choice)].sort(
					([a], [b]) => rank(a) - rank(b) || a.localeCompare(b)
				)
			}))
			.sort((a, b) => b.total - a.total);
	}

	const formatYear = (d: string | null | undefined) => (d ? d.slice(0, 4) : '?');
</script>

<div class="r-member">
	{#if view.kind === 'loading'}
		<p class="loading">Laden…</p>
	{:else if view.kind === 'error'}
		<p class="error">{view.message}</p>
	{:else}
		{@const m = view.member}
		{@const memberships = m.faction_memberships ?? []}
		{@const current = memberships.filter((f) => !f.to_date)}
		{@const former = memberships
			.filter((f) => f.to_date)
			.sort(
				(a, b) =>
					(b.to_date ?? '').localeCompare(a.to_date ?? '') ||
					(b.from_date ?? '').localeCompare(a.from_date ?? '')
			)}

		<header class="head">
			<span class="kicker"><KindGlyph collection="members" />{bronLabel('members')}</span>
			<div class="member-head-row">
				<span class="member-avatar" aria-hidden="true">{initials(m.name)}</span>
				<div class="member-meta">
					<h2 class="title">{m.name ?? m.key}</h2>
					<div class="chips">
						{#if m.party}<span class="party-chip">{m.party}</span>{/if}
						<span class="status-chip" class:status-chip--inactive={!m.active}>
							{m.active ? 'Actief' : 'Inactief'}
						</span>
					</div>
				</div>
			</div>
		</header>

		{#if memberships.length > 0}
			{#if current.length > 0}
				<section class="sec">
					<h3 class="sec-title">
						Huidige fractie
						<span class="faction-active-dot" aria-hidden="true"></span>
					</h3>
					<ul class="faction-list">
						{#each current as f (f.faction_id + (f.from_date ?? ''))}
							<li class="faction-row">
								<a
									class="faction-name"
									href={bronHref({ collection: 'factions', key: f.faction_key })}
									data-sveltekit-noscroll
								>
									{f.name ?? f.abbreviation ?? f.faction_key}
								</a>
								<span class="faction-range">
									{#if f.from_date}Lid sinds {formatYear(f.from_date)}{:else}Huidig lid{/if}
								</span>
								{#if f.role && f.role !== 'Lid'}<span class="faction-role">{f.role}</span>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
			{#if former.length > 0}
				<section class="sec">
					<h3 class="sec-title sec-title--former">Vorige fracties ({former.length})</h3>
					<ul class="faction-list faction-list--former">
						{#each former as f (f.faction_id + (f.from_date ?? ''))}
							<li class="faction-row">
								<a
									class="faction-name"
									href={bronHref({ collection: 'factions', key: f.faction_key })}
									data-sveltekit-noscroll
								>
									{f.name ?? f.abbreviation ?? f.faction_key}
								</a>
								<span class="faction-range"
									>{formatYear(f.from_date)} – {formatYear(f.to_date)}</span
								>
								{#if f.role && f.role !== 'Lid'}<span class="faction-role">{f.role}</span>{/if}
							</li>
						{/each}
					</ul>
				</section>
			{/if}
		{/if}

		{#if view.votes && view.votes.votes.length > 0}
			{@const votes = view.votes.votes}
			{@const groups = groupVotes(showAllVotes ? votes : votes.slice(0, VOTES_PREVIEW))}
			<section class="sec">
				<h3 class="sec-title">Stemgeschiedenis ({view.votes.count})</h3>
				{#each groups as group (group.party)}
					{#if groups.length > 1}
						<div class="party-head">
							<span class="party-name">{group.party}</span>
							<span class="party-total">{group.total} stemmen</span>
						</div>
					{/if}
					{#each group.byChoice as [choice, rows] (choice)}
						<div class="vote-group">
							<div class="vote-group-head">
								<span class="vote-choice vote-choice--{choice.toLowerCase()}">{choice}</span>
								<span class="vote-group-count">{rows.length}</span>
							</div>
							<ul class="vote-list">
								{#each rows as v (v.decision_id)}
									<li class="vote-row">
										<a
											class="vote-link"
											href={bronHref({ collection: 'decisions', key: v.decision_key })}
											data-sveltekit-noscroll
										>
											<span class="vote-subject">{v.subject ?? '—'}</span>
											<span class="vote-meta">
												{#if (v.seats ?? 0) > 1}<span class="vote-seats">{v.seats} zetels</span
													>{/if}
												{#if v.passed != null}
													<span
														class="vote-outcome"
														class:vote-outcome--passed={v.passed}
														class:vote-outcome--failed={!v.passed}
													>
														{v.passed ? 'Aangenomen' : 'Verworpen'}
													</span>
												{/if}
												{#if v.date}<span class="vote-date">{formatDate(v.date)}</span>{/if}
											</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/each}
				{/each}
				{#if votes.length > VOTES_PREVIEW && !showAllVotes}
					<button type="button" class="more-btn" onclick={() => (showAllVotes = true)}>
						+{votes.length - VOTES_PREVIEW} meer stemmen
					</button>
				{/if}
			</section>
		{/if}
	{/if}
</div>

<style>
	.r-member {
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
	}
	.member-head-row {
		display: flex;
		align-items: flex-start;
		gap: var(--s-3);
	}
	.member-avatar {
		width: 44px;
		height: 44px;
		border-radius: 50%;
		background: var(--paper-2);
		border: 1px solid var(--rule);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-serif);
		font-size: 17px;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.member-meta {
		flex: 1;
		min-width: 0;
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding-top: 2px;
	}
	.title {
		font-family: var(--font-serif);
		font-size: var(--t-h3);
		font-weight: 500;
		color: var(--ink);
		margin: 0;
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}
	.chips {
		display: flex;
		gap: var(--s-3);
		flex-wrap: wrap;
		align-items: baseline;
	}

	/* The faction and the status are words, not tags. */
	.party-chip,
	.status-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
	}
	.party-chip {
		color: var(--ink-2);
	}
	.status-chip,
	.status-chip--inactive {
		color: var(--ink-3);
	}

	/* ── Sections ── */
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
	.sec-title--former {
		color: var(--ink-3);
		opacity: 0.7;
	}
	.faction-active-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--ink-2);
		margin-left: 5px;
		vertical-align: middle;
	}

	/* ── Fractielidmaatschappen ── */
	.faction-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.faction-list--former {
		opacity: 0.6;
	}
	.faction-row {
		display: flex;
		align-items: baseline;
		gap: 8px;
		padding: 5px var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		border-radius: var(--r-1);
		flex-wrap: wrap;
	}
	.faction-row:hover {
		background: var(--paper-2);
	}
	.faction-name {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.faction-name:hover {
		color: var(--accent);
	}
	.faction-range {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
		flex-shrink: 0;
	}
	.faction-role {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}

	/* ── Votes ── */
	.vote-choice {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-3);
	}
	.vote-choice--voor,
	.vote-choice--tegen {
		color: var(--ink-2);
	}
	.vote-choice--onthouden {
		color: var(--ink-3);
	}

	.vote-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.vote-row {
		padding: 0;
	}
	.vote-link {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 6px var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		border-radius: var(--r-1);
		text-decoration: none;
	}
	.vote-link:hover {
		background: var(--paper-2);
	}
	.vote-link:hover .vote-subject {
		color: var(--accent);
	}
	.vote-subject {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}
	.vote-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.vote-seats {
		font-variant-numeric: tabular-nums;
	}
	.vote-outcome {
		font-weight: 500;
	}
	.vote-outcome--passed,
	.vote-outcome--failed {
		color: var(--ink-2);
	}
	.vote-date {
		font-variant-numeric: tabular-nums;
	}

	.vote-group {
		display: flex;
		flex-direction: column;
		gap: 4px;
		margin-top: 6px;
	}
	.vote-group-head {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 2px 0;
	}
	.vote-group-count {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}

	.party-head {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		margin-top: var(--s-3);
		padding-bottom: 4px;
		border-bottom: 1px solid var(--rule);
	}
	.party-name {
		font-family: var(--font-sans);
		font-size: var(--t-meta);
		font-weight: 500;
		color: var(--ink-2);
	}
	.party-total {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}

	/* A text button: no border, the hover as a paper-2 field. */
	.more-btn {
		align-self: flex-start;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
		background: none;
		border: none;
		border-radius: var(--r-1);
		padding: 4px;
		margin-left: -4px;
		cursor: pointer;
		text-align: left;
		transition:
			background var(--dur-1) var(--ease),
			color var(--dur-1) var(--ease);
	}
	.more-btn:hover {
		background: var(--paper-2);
		color: var(--ink);
	}
</style>

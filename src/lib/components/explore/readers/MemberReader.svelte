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
		background: var(--paper-3);
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
		font-size: 18px;
		font-weight: 400;
		color: var(--ink);
		margin: 0;
		line-height: 1.25;
		overflow-wrap: anywhere;
	}
	.chips {
		display: flex;
		gap: 4px;
		flex-wrap: wrap;
	}

	.party-chip,
	.status-chip {
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
	}
	.party-chip {
		background: var(--paper-2);
		color: var(--ink-2);
	}
	.status-chip {
		color: var(--moss);
		border-color: color-mix(in srgb, var(--moss) 25%, transparent);
		background: color-mix(in srgb, var(--moss) 10%, var(--paper));
	}
	.status-chip--inactive {
		color: var(--ink-4);
		border-color: var(--rule);
		background: var(--paper-3);
	}

	/* ── Sections ── */
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
	.sec-title--former {
		color: var(--ink-4);
		opacity: 0.7;
	}
	.faction-active-dot {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--moss);
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
		padding: 4px 0;
		border-bottom: 1px dotted var(--rule);
		flex-wrap: wrap;
	}
	.faction-name {
		flex: 1;
		min-width: 0;
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		text-decoration: none;
		overflow-wrap: anywhere;
	}
	.faction-name:hover {
		color: var(--spine);
	}
	.faction-range {
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
		flex-shrink: 0;
	}
	.faction-role {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--ink-3);
		padding: 0 6px;
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
		background: var(--paper-2);
	}

	/* ── Votes ── */
	.vote-choice {
		font-family: var(--font-sans);
		font-size: 9px;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		padding: 1px 5px;
		border-radius: var(--r-1);
		border: 1px solid var(--rule);
		color: var(--ink-3);
		background: var(--paper-3);
	}
	.vote-choice--voor {
		color: var(--moss);
		border-color: color-mix(in srgb, var(--moss) 25%, transparent);
		background: color-mix(in srgb, var(--moss) 8%, var(--paper));
	}
	.vote-choice--tegen {
		color: var(--spine);
		border-color: color-mix(in srgb, var(--spine) 25%, transparent);
		background: color-mix(in srgb, var(--spine) 8%, var(--paper));
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
		border-bottom: 1px dotted var(--rule);
	}
	.vote-link {
		display: flex;
		flex-direction: column;
		gap: 3px;
		padding: 5px 0;
		text-decoration: none;
	}
	.vote-link:hover .vote-subject {
		color: var(--spine);
	}
	.vote-subject {
		font-family: var(--font-serif);
		font-size: 13px;
		color: var(--ink-2);
		line-height: 1.4;
		overflow-wrap: anywhere;
	}
	.vote-meta {
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: 8px;
		font-family: var(--font-sans);
		font-size: 10px;
		color: var(--ink-4);
	}
	.vote-seats {
		font-family: var(--font-mono);
	}
	.vote-outcome {
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}
	.vote-outcome--passed {
		color: var(--moss);
	}
	.vote-outcome--failed {
		color: var(--spine);
	}
	.vote-date {
		font-family: var(--font-mono);
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
		font-family: var(--font-mono);
		font-size: 11px;
		color: var(--ink-4);
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
		font-size: 11px;
		font-weight: 600;
		color: var(--ink-2);
		letter-spacing: 0.02em;
	}
	.party-total {
		font-family: var(--font-mono);
		font-size: 10px;
		color: var(--ink-4);
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
</style>

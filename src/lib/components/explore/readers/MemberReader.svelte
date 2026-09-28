<script lang="ts">
	import ReaderFrame from './ReaderFrame.svelte';
	import { api, unwrap } from '$lib/api/client';
	import { neighborsOf, type Neighbor } from '$lib/api/nodes';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import KindGlyph from '$lib/bron/KindGlyph.svelte';
	import { bronHref } from '$lib/bron/href';
	import { getMemberVotes } from '$lib/components/parliamentary/data';
	import {
		careerOf,
		currentTitle,
		inYears,
		yearsOf,
		type Signature
	} from '$lib/components/parliamentary/career';
	import { parseFilter } from '$lib/verbonden/filter';
	import { page } from '$app/state';
	import { initials } from '$lib/util/initials';
	import { formatDate } from './_shared';

	let { node }: { node: GraphNode } = $props();

	type Vote = Schema<'MemberVoteDTO'>;

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| {
				kind: 'loaded';
				member: Schema<'MemberDetailDTO'>;
				votes: Schema<'MemberVotesResponse'> | null;
				/** What the person signed stukken as, and when (AUTHORED meta). */
				signatures: Signature[];
		  };

	const VOTES_PREVIEW = 20;
	const CHOICE_ORDER = ['Voor', 'Tegen'];

	let view = $state<State>({ kind: 'loading' });
	let showAllVotes = $state(false);

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	$effect(() => {
		void attempt;
		const key = node.key;
		const ac = new AbortController();
		view = { kind: 'loading' };
		showAllVotes = false;
		Promise.all([
			unwrap(api.GET('/api/members/{key}', { params: { path: { key } }, signal: ac.signal })),
			getMemberVotes(key).catch(() => null),
			unwrap(
				api.GET('/api/nodes/{collection}/{key}', {
					params: {
						path: { collection: 'members', key },
						query: { relations: 'AUTHORED', limit: 200 }
					},
					signal: ac.signal
				})
			)
				.then((r) => neighborsOf(r).map(signatureOf))
				.catch(() => [])
		])
			.then(([member, votes, signatures]) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', member, votes, signatures };
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

	const signatureOf = (n: Neighbor): Signature => {
		const meta = (n.meta ?? {}) as Record<string, unknown>;
		const text = (v: unknown) => (typeof v === 'string' && v ? v : null);
		return {
			function: text(meta.function),
			capacity: text(meta.capacity),
			date: text(n.props?.date)
		};
	};

	// The years of the bronfilter: a step of the career outside them steps back.
	const years = $derived(parseFilter(page.url.searchParams));
</script>

<ReaderFrame>
	<div class="r-member">
		{#if view.kind === 'loading'}
			<p class="loading">Laden…</p>
		{:else if view.kind === 'error'}
			<p class="error">
				{view.message}
				<button type="button" class="btn is-text" onclick={() => attempt++}>Opnieuw</button>
			</p>
		{:else}
			{@const m = view.member}
			{@const career = careerOf(
				m.faction_memberships ?? [],
				view.signatures,
				m.government_functions ?? []
			)}
			{@const sitting = (m.faction_memberships ?? []).some((f) => !f.to_date)}

			<header class="head">
				<span class="kicker"><KindGlyph collection="members" />{currentTitle(career, sitting)}</span
				>
				<div class="member-head-row">
					<span class="member-avatar" aria-hidden="true">{initials(m.name)}</span>
					<div class="member-meta">
						<h2 class="title">{m.name ?? m.key}</h2>
						{#if m.party}
							<div class="chips"><span class="party-chip">{m.party}</span></div>
						{/if}
					</div>
				</div>
			</header>

			{#if career.length > 0}
				<section class="sec">
					<h3 class="sec-title">Loopbaan</h3>
					<ul class="career">
						{#each career as step (step.kind + (step.kind === 'seat' ? step.factionKey : step.function) + step.from)}
							<li
								class="career-step"
								class:is-out={!inYears(step.from, step.to, years.van, years.tot)}
							>
								<span class="career-years">{yearsOf(step.from, step.to)}</span>
								{#if step.kind === 'seat'}
									<span class="career-what">
										Kamerlid,
										<a
											href={bronHref({ collection: 'factions', key: step.factionKey })}
											data-sveltekit-noscroll>{step.faction}</a
										>
										{#each step.roles as r (r.role + r.from)}
											<span class="career-role">{r.role.toLowerCase()} {yearsOf(r.from, r.to)}</span
											>
										{/each}
									</span>
								{:else}
									<span class="career-what">
										{step.function.charAt(0).toUpperCase() + step.function.slice(1)}
										{#if step.cabinet}<span class="career-role">{step.cabinet}</span>{/if}
										{#if step.count > 0}
											<span class="career-role"
												>{step.count}
												{step.count === 1 ? 'stuk' : 'stukken'} ondertekend</span
											>
										{/if}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
					{#if career.some((step) => step.kind === 'function' && !step.cabinet)}
						<p class="career-note">
							Een functie zonder kabinet is alleen bekend uit ondertekende stukken. De jaren zijn
							die van de stukken, niet de ambtstermijn.
						</p>
					{/if}
				</section>
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
													{#if (v.seats ?? 0) > 1}<span class="vote-seats"
															>stem van de fractie, {v.seats} zetels</span
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
</ReaderFrame>

<style>
	.r-member {
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
		font-size: var(--t-body);
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

	/* The faction is a word, not a tag. */
	.party-chip {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-weight: 500;
		color: var(--ink-2);
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
	/* ── Loopbaan: newest first, the years in the margin ── */
	.career {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: var(--s-2);
	}
	.career-step {
		display: grid;
		grid-template-columns: 5.5em 1fr;
		gap: var(--s-2);
		align-items: baseline;
		transition: opacity var(--dur-1) var(--ease);
	}
	.career-step.is-out {
		opacity: 0.4;
	}
	.career-years {
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		font-variant-numeric: tabular-nums;
		color: var(--ink-3);
	}
	.career-what {
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		overflow-wrap: anywhere;
	}
	.career-what a {
		color: inherit;
	}
	.career-what a:hover {
		color: var(--accent);
	}
	.career-role {
		display: block;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
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
		gap: var(--s-2);
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
		gap: var(--s-1);
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
		padding-bottom: var(--s-1);
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
		padding: var(--s-1);
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

	.career-note {
		margin: var(--s-2) 0 0;
		font-family: var(--font-sans);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

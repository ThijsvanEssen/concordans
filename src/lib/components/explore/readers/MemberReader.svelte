<script lang="ts">
	import { formatCount } from '$lib/text/getal';
	import { vandaag } from '$lib/text/datum';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import { getMember, getMemberAuthored } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import NameLink from '$lib/bron/NameLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import type { Neighbor } from '$lib/api/nodes';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { getMemberVotes } from '$lib/components/parliamentary/data';
	import {
		careerOf,
		currentTitle,
		inYears,
		seatWord,
		yearsOf,
		type Signature
	} from '$lib/components/parliamentary/career';
	import { parseFilter } from '$lib/verbonden/filter';
	import { page } from '$app/state';
	import { initials } from '$lib/util/initials';
	import { formatDate, formatLongDate } from './_shared';
	import BewindspersoonOverzicht from '$lib/components/parliamentary/BewindspersoonOverzicht.svelte';
	import BewindspersoonKop from './BewindspersoonKop.svelte';
	import { stemmingNaam } from '$lib/components/parliamentary/stemming';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';

	let { node }: { node: GraphNode } = $props();

	const today = vandaag();

	type Vote = Schema<'MemberVoteDTO'>;

	type State =
		| { kind: 'loading' }
		| { kind: 'error'; message: string }
		| { kind: 'loaded'; member: Schema<'MemberDetailDTO'> };

	const VOTES_PREVIEW = 20;
	const CHOICE_ORDER = ['Voor', 'Tegen'];

	let view = $state<State>({ kind: 'loading' });
	// The votes (8.8 s on prod, 9 Oct) and the signatures (from the full node) come after
	// the person: the reader stands as soon as the person is in, and these fill in.
	let votes = $state<Schema<'MemberVotesResponse'> | null>(null);
	let votesLaden = $state(true);
	/** What the person signed stukken as, and when (AUTHORED meta). */
	let signatures = $state<Signature[]>([]);
	let showAllVotes = $state(false);

	// Raised by Opnieuw, to load the bron again after an error.
	let attempt = $state(0);

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the records are not asked again for that.
	const bronKey = $derived(node.key);

	$effect(() => {
		void attempt;
		const key = bronKey;
		const ac = new AbortController();
		view = { kind: 'loading' };
		showAllVotes = false;
		votes = null;
		votesLaden = true;
		signatures = [];
		getMember(key)
			.then((member) => {
				if (!ac.signal.aborted) view = { kind: 'loaded', member };
			})
			.catch(() => {
				if (!ac.signal.aborted)
					view = { kind: 'error', message: 'Persoon kon niet worden geladen.' };
			});
		getMemberVotes(key)
			.catch(() => null)
			.then((v) => {
				if (ac.signal.aborted) return;
				votes = v;
				votesLaden = false;
			});
		getMemberAuthored(key)
			.then((authored) => {
				if (!ac.signal.aborted) signatures = authored.map(signatureOf);
			})
			.catch(() => {});
		return () => ac.abort();
	});

	// Votes are grouped by the faction the member belonged to at the time, so a
	// switch of faction reads as separate blocks, and then by choice.
	type PartyGroup = { party: string | null; total: number; byChoice: [string, Vote[]][] };
	function groupVotes(votes: Vote[]): PartyGroup[] {
		const byParty = Map.groupBy(votes, (v) => v.party ?? null);
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
				signatures,
				m.government_functions ?? []
			)}
			<!-- An end date is the last day in the seat (TotEnMet): on it, the member still sits. -->
			{@const sitting = (m.faction_memberships ?? []).some(
				(f) => !f.to_date || f.to_date.slice(0, 10) >= today
			)}

			<!-- A seat in the Eerste Kamer, as its site lists it (API 0.65); none before our first read. -->
			{@const ek = m.ek ?? null}
			{@const ekSitting = !!ek && !ek.observed_until}

			{#if (m.government_functions ?? []).length > 0}
				<BewindspersoonKop {m} />
			{:else}
				<header class="head">
					<span class="lezer-soort"
						><SoortLink
							collection="members"
							lijst={(m.government_functions ?? []).length > 0 ? 'ministers' : 'members'}
							>{ekSitting && !sitting
								? 'Lid van de Eerste Kamer'
								: currentTitle(career, sitting)}</SoortLink
						></span
					>
					<div class="member-head-row">
						<span class="member-avatar" aria-hidden="true">{initials(m.name)}</span>
						<div class="member-meta">
							<h2 class="lezer-titel">{m.name ?? m.key}</h2>
							{#if m.party}
								<div class="woorden">
									<NameLink collection="factions" name={m.party} class="fractie-woord" />
								</div>
							{:else if ek?.faction && ek.abbreviation}
								<div class="woorden">
									<BronLink ref={{ collection: 'factions', key: ek.faction }} class="fractie-woord"
										>{ek.abbreviation}</BronLink
									>
								</div>
							{/if}
						</div>
					</div>
				</header>
			{/if}

			{#if ek}
				<Sectie titel="Eerste Kamer">
					<Feiten klein>
						<Veld label="Fractie" value={ek.faction}>
							<BronLink ref={{ collection: 'factions', key: ek.faction ?? '' }}
								>{ek.abbreviation ?? ek.faction}</BronLink
							>
						</Veld>
						<Veld label="Anciënniteit" value={ek.seniority_days}>
							{ek.seniority_days != null ? formatCount(ek.seniority_days) : ''} dagen
						</Veld>
						<Veld label="Woonplaats" value={ek.residence} />
					</Feiten>
					{#if ek.source}
						<p class="ek-source">
							{`Samenstelling op ${formatLongDate(ek.source.composition_date ?? null)}, gegevens sinds ${formatLongDate(ek.source.data_since ?? null)}. `}Bron:
							<a href={ek.source.url} rel="external">{ek.source.attribution}</a>.
						</p>
					{/if}
				</Sectie>
			{/if}

			{#if (m.government_functions ?? []).length > 0}
				<BewindspersoonOverzicht memberKey={m.key} ruim />
			{/if}

			{#if career.length > 0}
				<Sectie titel="Loopbaan" id="loopbaan">
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
										<BronLink ref={{ collection: 'factions', key: step.factionKey }}
											>{step.faction}</BronLink
										>
										{#each uniqueBy(step.roles, (r) => r.role + r.from) as r (r.role + r.from)}
											<span class="career-role">{r.role.toLowerCase()} {yearsOf(r.from, r.to)}</span
											>
										{/each}
									</span>
								{:else}
									<span
										class="career-what"
										title={step.cabinet
											? undefined
											: 'Bekend uit ondertekende stukken; de jaren zijn die van de stukken'}
									>
										{step.function.charAt(0).toUpperCase() + step.function.slice(1)}
										{#if step.cabinet}<NameLink
												collection="cabinets"
												name={step.cabinet}
												class="career-role"
											/>{/if}
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
				</Sectie>
			{/if}

			{#if (m.committees ?? []).length > 0}
				<!-- The committees they sat on (API 0.75, BE-30), those they sit on now first: the
				     seat that stands for them, its role where it is more than a seat, and the other
				     periods beside it, as Loopbaan names a role. -->
				<Sectie titel="Commissies" soort="committees" aantal={m.committees?.length}>
					<ul class="career">
						{#each m.committees ?? [] as c (c.key)}
							{@const others = (c.periods ?? []).filter(
								(p) => p.from_date !== c.from_date || p.to_date !== c.to_date
							)}
							<li
								class="career-step"
								class:is-out={!inYears(
									c.from_date ?? null,
									c.to_date ?? null,
									years.van,
									years.tot
								)}
							>
								<span class="career-years">{yearsOf(c.from_date ?? null, c.to_date ?? null)}</span>
								<span class="career-what">
									<BronLink ref={{ collection: 'committees', key: c.key }}
										>{c.name ?? c.key}</BronLink
									>{seatWord(c.role, c.substitute)
										? `, ${seatWord(c.role, c.substitute)}`
										: ''}{c.chamber === 'EK' ? ', Eerste Kamer' : ''}
									{#each others as p ((p.from_date ?? '') + (p.role ?? '') + (p.substitute ? 'v' : ''))}
										<span class="career-role"
											>{seatWord(p.role, p.substitute) ?? 'lid'}
											{yearsOf(p.from_date ?? null, p.to_date ?? null)}</span
										>
									{/each}
								</span>
							</li>
						{/each}
					</ul>
				</Sectie>
			{/if}

			{#if votesLaden}
				<p class="laden">Stemmen laden…</p>
			{:else if votes && votes.votes.length > 0}
				{@const alle = votes.votes}
				{@const groups = groupVotes(showAllVotes ? alle : alle.slice(0, VOTES_PREVIEW))}
				<!-- Their own votes on a roll-call, and their faction's while they sat in it (API
				     0.75, BE-43); a bewindspersoon's are what they voted as a Kamerlid. -->
				<Sectie
					titel={(m.government_functions ?? []).length > 0 ? 'Als Kamerlid' : 'Stemgeschiedenis'}
					soort="decisions"
					aantal={votes.count}
				>
					{#each groups as group (group.party)}
						{#if groups.length > 1}
							<div class="party-head">
								{#if group.party}<NameLink
										collection="factions"
										name={group.party}
										class="party-name"
									/>{:else}<span class="party-name">Zonder fractie</span>{/if}
								<span class="party-total">{group.total} stemmen</span>
							</div>
						{/if}
						{#each group.byChoice as [choice, rows] (choice)}
							<div class="vote-group">
								<div class="vote-group-head">
									<Stem keuze={choice} />
									<span class="vote-group-count">{rows.length}</span>
								</div>
								<ul class="vote-list">
									{#each uniqueBy(rows, (v) => v.decision_id) as v (v.decision_id)}
										<li class="vote-row">
											<BronLink
												ref={{ collection: 'decisions', key: v.decision_key }}
												class="vote-link"
											>
												<!-- The stem beside each row as well: a long group scrolls its head away. -->
												<span class="vote-mark"><Stem keuze={choice} woord={false} /></span>
												<span class="vote-subject">{stemmingNaam(v.subject)}</span>
												<span class="vote-meta">
													{#if v.vote_source === 'faction'}<span class="vote-seats"
															>stem van de fractie{v.party ? ` (${v.party})` : ''}{(v.seats ?? 0) >
															1
																? `, ${v.seats} zetels`
																: ''}</span
														>{:else}<span class="vote-seats">eigen stem, hoofdelijk</span>{/if}
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
											</BronLink>
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					{/each}
					{#if alle.length > VOTES_PREVIEW && !showAllVotes}
						<p class="alle">
							<AlleN aantal={alle.length} noun="stemmen" onclick={() => (showAllVotes = true)} />
						</p>
					{/if}
				</Sectie>
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
		gap: var(--s-2);
		padding-top: 2px;
	}
	.woorden {
		display: flex;
		gap: var(--s-3);
		flex-wrap: wrap;
		align-items: baseline;
	}

	/* The faction is a word, not a tag. */
	/* Also on the link NameLink renders. */
	.r-member :global(.fractie-woord) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
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
		grid-template-columns: max(calc(var(--reader-term, 0px) - var(--s-2)), 5.5em) minmax(0, 1fr);
		gap: var(--s-2);
		align-items: baseline;
		transition: opacity var(--dur-1) var(--ease);
	}
	.career-step.is-out {
		opacity: 0.4;
	}
	.career-years {
		font-family: var(--font-serif);
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
	.career-what :global(a) {
		color: inherit;
	}
	.career-what :global(a:hover) {
		color: var(--accent);
	}
	/* Also on the link NameLink renders. */
	.r-member :global(.career-role) {
		display: block;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* ── Votes ──
	   The ladder of docs/typografie.md: section (Sectie) > group (the stem, rung 3) > the
	   motie (rung 4) > its meta line (rung 5). */

	.vote-list {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.vote-row {
		padding: 0;
	}
	.vote-list :global(.vote-link) {
		display: grid;
		grid-template-columns: var(--s-4) minmax(0, 1fr);
		column-gap: var(--s-2);
		row-gap: var(--s-1);
		padding: var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		border-radius: var(--r-1);
		text-decoration: none;
	}
	.vote-list :global(.vote-link:hover) {
		background: var(--paper-2);
	}
	.vote-list :global(.vote-link:hover .vote-subject) {
		color: var(--accent);
	}
	.vote-mark {
		grid-row: 1;
		grid-column: 1;
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.vote-subject {
		grid-column: 2;
		font-family: var(--font-serif);
		font-size: var(--t-body-2);
		color: var(--ink);
		line-height: var(--lh-snug);
		overflow-wrap: anywhere;
	}
	.vote-meta {
		grid-column: 2;
		display: flex;
		flex-wrap: wrap;
		align-items: baseline;
		gap: var(--s-2);
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.vote-outcome {
		font-weight: 600;
	}
	.vote-outcome--passed,
	.vote-outcome--failed {
		color: var(--ink-2);
	}

	.vote-group {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
		margin-top: var(--s-4);
	}
	/* Rung 3, a group in a section: the sans at --t-meta, the stem in shape and word. */
	.vote-group-head {
		display: flex;
		align-items: baseline;
		gap: var(--s-2);
		padding-bottom: var(--s-1);
		border-bottom: 1px solid var(--rule);
		font-family: var(--font-serif);
		font-size: var(--t-meta);
	}
	.vote-group-count {
		font-size: var(--t-micro);
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
	/* Also on the link NameLink renders. */
	.r-member :global(.party-name) {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		font-weight: 600;
		color: var(--ink);
	}
	.party-total {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	/* A text button: no border, the hover as a paper-2 field. */

	.ek-source {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
	.laden {
		margin: var(--s-4) 0 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-3);
	}
	.alle {
		margin: var(--s-3) 0 0;
		font-size: var(--t-meta);
	}
</style>

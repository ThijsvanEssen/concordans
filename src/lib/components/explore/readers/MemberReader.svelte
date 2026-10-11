<script lang="ts">
	import { fractieNaam, naamVan } from '$lib/bron/menselijk';
	import { bronLabel } from '$lib/vocabulary';
	import ReaderHead from './ReaderHead.svelte';
	import { formatCount } from '$lib/text/getal';
	import { vandaag } from '$lib/text/datum';
	import AlleN from '$lib/components/ui/AlleN.svelte';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import { getMember, getMemberAuthored } from '$lib/api/records';
	import BronLink from '$lib/bron/BronLink.svelte';
	import Sectie from '$lib/components/ui/Sectie.svelte';
	import { uniqueBy } from '$lib/util/unique';
	import NameLink from '$lib/bron/NameLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import Tijdlijn from '$lib/components/tijdlijn/Tijdlijn.svelte';
	import type { Neighbor } from '$lib/api/nodes';
	import type { Schema } from '$lib/api/types';
	import type { GraphNode } from '$lib/graph/types';
	import { getMemberVotes, getMemberVotesInOffice } from '$lib/components/parliamentary/data';
	import {
		careerOf,
		currentTitle,
		inYears,
		seatWord,
		yearsOf,
		type CareerEntry,
		type Signature
	} from '$lib/components/parliamentary/career';
	import { parseFilter } from '$lib/verbonden/filter';
	import { page } from '$app/state';
	import { formatDate, formatLongDate } from './_shared';
	import BewindspersoonOverzicht from '$lib/components/parliamentary/BewindspersoonOverzicht.svelte';
	import BewindspersoonKop from './BewindspersoonKop.svelte';
	import { stemmingNaam } from '$lib/components/parliamentary/stemming';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import CoalitieRegel from '$lib/components/parliamentary/CoalitieRegel.svelte';
	import { ambtZin } from '$lib/components/parliamentary/ambt';
	import StemOpen from '$lib/components/open/StemOpen.svelte';
	import { bronHref } from '$lib/bron/href';
	import { terPlekke } from '$lib/actions/klik';
	import { onControl } from '$lib/actions/outside';
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
	/** A bewindspersoon's votes in a post, asked on their own and paged (#534); null: not asked. */
	let inOffice = $state<{ votes: Vote[]; next: number | null; laden: boolean } | null>(null);
	/** The vote opened in place, by its stemming's key. */
	let openStem = $state<string | null>(null);
	const toggleStem = (key: string) => (openStem = openStem === key ? null : key);

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
		inOffice = null;
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

	// A bewindspersoon's votes in a post: all of them, page by page, not those among the newest
	// 50 (UX-toets 0.79.43, #29: "20 stemmen" of 50).
	const bewindspersoon = $derived(
		view.kind === 'loaded' && (view.member.government_functions ?? []).length > 0
	);
	$effect(() => {
		if (!bewindspersoon) return;
		const key = bronKey;
		let weg = false;
		inOffice = { votes: [], next: 0, laden: true };
		getMemberVotesInOffice(key)
			.then((v) => {
				// Only votes in a post, also from an API before 0.79.44 that ignores `in_office`.
				if (!weg) inOffice = { votes: inPost(v.votes), next: v.next_offset ?? null, laden: false };
			})
			.catch(() => {
				if (!weg) inOffice = null;
			});
		return () => {
			weg = true;
		};
	});
	const inPost = (vs: Vote[]) => vs.filter((v) => (v.in_office ?? []).length > 0);
	/** The next page of votes in a post. */
	function meerInOffice() {
		const nu = inOffice;
		if (!nu || nu.next == null || nu.laden) return;
		const key = bronKey;
		inOffice = { ...nu, laden: true };
		getMemberVotesInOffice(key, nu.next)
			.then((v) => {
				if (key !== bronKey) return;
				inOffice = {
					votes: [...nu.votes, ...inPost(v.votes)],
					next: v.next_offset ?? null,
					laden: false
				};
			})
			.catch(() => {
				if (key === bronKey) inOffice = { ...nu, laden: false };
			});
	}

	// Votes are grouped by the faction the member belonged to at the time, so a
	// switch of faction reads as separate blocks, and then by choice. A vote cast while the
	// member also held a post in a cabinet (`in_office`, API 0.79.43, #508) stands in a block
	// of its own: "VVD, als minister van Justitie en Veiligheid (kabinet-Rutte IV) en Kamerlid".
	type PartyGroup = {
		party: string | null;
		ambt: string | null;
		total: number;
		/** More votes than counted: a post's votes have another page (`next_offset`). */
		meer: boolean;
		byChoice: [string, Vote[]][];
	};
	/** The posts of a vote in the source's words, oldest first: "minister van … (kabinet-…)". */
	// In running text a post is lower case, as the status line writes it: "als minister-president".
	const ambtVan = (v: Vote) => ambtZin(v.in_office);
	const groepSleutel = (v: Vote) => `${v.party ?? ''}\u0000${ambtVan(v) ?? ''}`;
	/** The groups of the votes shown; each counts its votes among `alle`, not the preview's
	 *  (UX-toets 0.79.43, #29: "20 stemmen" of 50). */
	function groupVotes(votes: Vote[], alle: Vote[] = votes, ambtMeer = false): PartyGroup[] {
		const tel = Map.groupBy(alle, groepSleutel);
		const byParty = Map.groupBy(votes, groepSleutel);
		const rank = (choice: string) => {
			const i = CHOICE_ORDER.indexOf(choice);
			return i === -1 ? CHOICE_ORDER.length : i;
		};
		return [...byParty]
			.map(([sleutel, rows]) => ({
				party: rows[0].party ?? null,
				ambt: ambtVan(rows[0]),
				total: tel.get(sleutel)?.length ?? rows.length,
				meer: ambtMeer && !!ambtVan(rows[0]),
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

	/** A step of the career, the same in Loopbaan and in what it opens. */
	const stapId = (step: CareerEntry) =>
		step.kind + (step.kind === 'seat' ? step.factionKey : step.function) + step.from;

	// The years of the bronfilter: a step of the career outside them steps back.
	const years = $derived(parseFilter(page.url.searchParams));
</script>

<ReaderFrame>
	<div class="r-member">
		{#if view.kind === 'loading'}
			<p class="loading stil">Laden…</p>
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
				<BewindspersoonKop {m} id={node.id} />
			{:else}
				{@const titel = m.name ?? naamVan('members', m)}
				<ReaderHead
					collection="members"
					title={titel}
					acties={{
						bewaar: {
							id: node.id,
							at: '',
							kort: titel,
							voluit: m.party ? `${titel} (${m.party})` : titel,
							groep: bronLabel('members')
						}
					}}
				>
					{#snippet soort()}
						<SoortLink
							collection="members"
							lijst={(m.government_functions ?? []).length > 0 ? 'ministers' : 'members'}
							>{ekSitting && !sitting
								? 'Lid van de Eerste Kamer'
								: currentTitle(career, sitting)}</SoortLink
						>
					{/snippet}
					{#snippet status()}
						{#if m.party}
							<NameLink collection="factions" name={m.party} class="fractie-woord" />
						{:else if ek?.faction && ek.abbreviation}
							<BronLink ref={{ collection: 'factions', key: ek.faction }} class="fractie-woord"
								>{ek.abbreviation}</BronLink
							>
						{/if}
					{/snippet}
				</ReaderHead>
			{/if}

			{#if ek}
				<Sectie titel="Eerste Kamer">
					<Feiten klein>
						<Veld label="Fractie" value={ek.faction}>
							<BronLink ref={{ collection: 'factions', key: ek.faction ?? '' }}
								>{fractieNaam({ key: ek.faction, abbreviation: ek.abbreviation })}</BronLink
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
				<!-- A function's cabinet and stukken, by link, under it. -->
				{#snippet ambtOnder(id: string)}
					{@const step = career.find((c) => stapId(c) === id)}
					{#if step?.kind === 'function'}
						{#if step.cabinet}<NameLink
								collection="cabinets"
								name={step.cabinet}
							/>{/if}{#if step.count > 0}{`${step.cabinet ? ', ' : ''}${step.count} ${step.count === 1 ? 'stuk' : 'stukken'} ondertekend`}{/if}
					{/if}
				{/snippet}
				<Sectie titel="Loopbaan" id="loopbaan">
					<Tijdlijn
						perioden
						groepen={[
							{
								id: 'loopbaan',
								titel: '',
								regels: career.map((step) => ({
									id: stapId(step),
									datum: null,
									periode: { van: step.from, tot: step.to },
									teken: 'stuk' as const,
									gedimd: !inYears(step.from, step.to, years.van, years.tot),
									...(step.kind === 'seat'
										? {
												zin: `Kamerlid, ${step.faction}`,
												ref: { collection: 'factions' as const, key: step.factionKey },
												meta:
													uniqueBy(step.roles, (r) => r.role + r.from)
														.map((r) => `${r.role.toLowerCase()} ${yearsOf(r.from, r.to)}`)
														.join(', ') || null
											}
										: {
												zin: step.function.charAt(0).toUpperCase() + step.function.slice(1),
												onder: step.cabinet || step.count > 0 ? ambtOnder : null,
												hint: step.cabinet
													? null
													: 'Bekend uit ondertekende stukken; de jaren zijn die van de stukken'
											})
								}))
							}
						]}
					/>
				</Sectie>
			{/if}

			{#if (m.committees ?? []).length > 0}
				<!-- The committees they sat on (API 0.75, BE-30), those they sit on now first: the
				     seat that stands for them, its role where it is more than a seat, and the other
				     periods beside it, as Loopbaan names a role. -->
				<Sectie titel="Commissies" soort="committees" aantal={m.committees?.length}>
					<Tijdlijn
						perioden
						groepen={[
							{
								id: 'commissies',
								titel: '',
								regels: (m.committees ?? []).map((c) => ({
									id: c.key,
									datum: null,
									periode: { van: c.from_date ?? null, tot: c.to_date ?? null },
									teken: 'stuk' as const,
									gedimd: !inYears(c.from_date ?? null, c.to_date ?? null, years.van, years.tot),
									zin: `${c.name ?? naamVan('committees', c)}${seatWord(c.role, c.substitute) ? `, ${seatWord(c.role, c.substitute)}` : ''}${c.chamber === 'EK' ? ', Eerste Kamer' : ''}`,
									ref: { collection: 'committees' as const, key: c.key },
									meta:
										(c.periods ?? [])
											.filter((p) => p.from_date !== c.from_date || p.to_date !== c.to_date)
											.map(
												(p) =>
													`${seatWord(p.role, p.substitute) ?? 'lid'} ${yearsOf(p.from_date ?? null, p.to_date ?? null)}`
											)
											.join(', ') || null
								}))
							}
						]}
					/>
				</Sectie>
			{/if}

			{#if votesLaden}
				<p class="laden">Stemmen laden…</p>
			{:else if votes && votes.votes.length > 0}
				<!-- A bewindspersoon's votes in a post come on their own, all of them (#534); the
				     newest 50 give the rest. Until the first page is in, the 50 give both. -->
				{@const apart = !!inOffice && !(inOffice.laden && inOffice.votes.length === 0)}
				{@const ambt = apart ? inOffice!.votes : []}
				{@const eigen = apart ? votes.votes.filter((v) => !v.in_office?.length) : votes.votes}
				{@const alle = [...ambt, ...eigen]}
				{@const groups = groupVotes(
					showAllVotes ? alle : [...ambt.slice(0, VOTES_PREVIEW), ...eigen.slice(0, VOTES_PREVIEW)],
					alle,
					apart && inOffice!.next != null
				)}
				<!-- Their own votes on a roll-call, and their faction's while they sat in it (API
				     0.75, BE-43); a bewindspersoon's are what they voted as a Kamerlid. -->
				<Sectie
					titel={(m.government_functions ?? []).length > 0 ? 'Als Kamerlid' : 'Stemgeschiedenis'}
					soort="decisions"
					aantal={apart ? `${alle.length}${inOffice!.next != null ? '+' : ''}` : votes.count}
				>
					{#each groups as group (`${group.party}|${group.ambt}`)}
						{#if groups.length > 1 || group.ambt}
							<div class="party-head">
								<span class="party-wie"
									>{#if group.party}<NameLink
											collection="factions"
											name={group.party}
											class="party-name"
										/>{:else}<span class="party-name">Zonder fractie</span
										>{/if}{#if group.ambt}<span class="party-ambt"
											>, als {group.ambt} en Kamerlid</span
										>{/if}</span
								>
								<span class="party-total">{group.total}{group.meer ? '+' : ''} stemmen</span>
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
										{@const open = openStem === v.decision_key}
										<!-- A vote opens in place with its bar, as a row of Actueel does (UX-toets
										     10 Oct, #20); the title stays a link, the stemming one step further. -->
										<li class="vote-row" class:vote-row--open={open}>
											<!-- The button is the keyboard's way in; this only widens its target. -->
											<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
											<div
												class="vote-link"
												data-rij
												onclick={(e) => {
													if (onControl(e) || window.getSelection()?.toString()) return;
													toggleStem(v.decision_key);
												}}
											>
												<button
													type="button"
													class="vote-toggle"
													aria-expanded={open}
													aria-label="Details van {stemmingNaam(v.subject)}"
													onclick={() => toggleStem(v.decision_key)}
												></button>
												<!-- The stem beside each row as well: a long group scrolls its head away. -->
												<span class="vote-mark"><Stem keuze={choice} woord={false} /></span>
												<a
													class="vote-subject"
													href={bronHref({ collection: 'decisions', key: v.decision_key })}
													data-sveltekit-noscroll
													onclick={(e) => terPlekke(e, () => toggleStem(v.decision_key))}
													>{stemmingNaam(v.subject)}</a
												>
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
												<!-- What the coalition did (API 0.79.45, #559; Thijs, 10 Oct). -->
												{#if v.coalition}<div class="vote-coal">
														<CoalitieRegel
															coalitie={v.coalition}
															fracties={v.coalition_factions ?? []}
														/>
													</div>{/if}
											</div>
											{#if open}
												<div class="vote-open"><StemOpen decisionKey={v.decision_key} /></div>
											{/if}
										</li>
									{/each}
								</ul>
							</div>
						{/each}
					{/each}
					{#if !showAllVotes && (ambt.length > VOTES_PREVIEW || eigen.length > VOTES_PREVIEW)}
						<p class="alle">
							<!-- No number while more pages follow: the heading says "200+" (FE1, live 0.79.44). -->
							<AlleN
								aantal={apart && inOffice!.next != null ? null : alle.length}
								noun="stemmen"
								onclick={() => (showAllVotes = true)}
							/>
						</p>
					{:else if showAllVotes && apart && inOffice!.next != null}
						<p class="alle">
							<TekstLink onclick={meerInOffice}
								>{inOffice!.laden ? 'Laden…' : 'Meer stemmen als bewindspersoon'}</TekstLink
							>
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
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	.loading,
	.error {
		margin: 0;
	}

	/* The faction is a word, not a tag. */
	/* Also on the link NameLink renders. */
	.r-member :global(.fractie-woord) {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-2);
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
	.vote-link {
		position: relative;
		display: grid;
		grid-template-columns: var(--s-4) minmax(0, 1fr);
		column-gap: var(--s-2);
		row-gap: var(--s-1);
		padding: var(--s-1);
		margin: 0 calc(-1 * var(--s-1));
		border-radius: var(--r-1);
		cursor: pointer;
	}
	.vote-link:hover,
	.vote-row--open .vote-link {
		background: var(--paper-2);
	}
	.vote-link:hover .vote-subject {
		text-decoration-line: underline;
		text-underline-offset: 3px;
	}
	/* The size of the row, under its content: what the keyboard stops on. */
	.vote-toggle {
		position: absolute;
		inset: 0;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		cursor: pointer;
	}
	.vote-toggle:focus-visible {
		outline: 2px solid var(--ink);
		outline-offset: -2px;
	}
	.vote-mark,
	.vote-subject,
	.vote-meta,
	.vote-coal {
		position: relative;
	}
	.vote-coal {
		grid-column: 2;
	}
	/* Opened: the bar under the row, at the subject's edge. */
	.vote-open {
		padding: var(--s-2) var(--s-1) var(--s-3) calc(var(--s-4) + var(--s-2));
		margin: 0 calc(-1 * var(--s-1));
		background: var(--paper-2);
		border-radius: 0 0 var(--r-1) var(--r-1);
	}
	.vote-mark {
		grid-row: 1;
		grid-column: 1;
		font-size: var(--t-body-2);
		line-height: var(--lh-snug);
	}
	.vote-subject {
		grid-column: 2;
		text-decoration: none;
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
	.party-wie {
		min-width: 0;
	}
	/* The post beside the fraction: in the letter of the line, quieter than the name. */
	.party-ambt {
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		color: var(--ink-2);
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

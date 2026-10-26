<script lang="ts">
	import { outcomeWord } from '$lib/text/outcome';
	import { atLeast } from '$lib/text/getal';
	import { choiceRank } from '$lib/votes/stemming';
	import { CHAMBER_NAME } from '$lib/components/parliamentary/chamber';
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { capitalize, count, textOf } from '$lib/text/words';
	import { bewaarItem } from '$lib/map/map';
	import { fractieNaam, naamVan } from '$lib/bron/menselijk';
	import ReaderHead from './ReaderHead.svelte';
	import { atomHref } from '$lib/components/actueel/feed';
	import { formatCount } from '$lib/text/getal';
	import { korteDatum, vandaag, yearsOf } from '$lib/text/datum';
	import AlleN from '$lib/components/ui/AlleN.svelte';
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
	import {
		getMemberVotes,
		getMemberVotesInOffice,
		getMemberVotesOutOfOffice
	} from '$lib/api/members';
	import {
		careerOf,
		currentTitle,
		inYears,
		seatWord,
		type CareerEntry,
		type Signature
	} from '$lib/components/parliamentary/career';
	import { parseFilter } from '$lib/verbonden/filter';
	import { page } from '$app/state';
	import BewindspersoonOverzicht from '$lib/components/parliamentary/BewindspersoonOverzicht.svelte';
	import BewindspersoonKop from './BewindspersoonKop.svelte';
	import { stemmingNaam } from '$lib/votes/stemming';
	import Stem from '$lib/components/parliamentary/Stem.svelte';
	import CoalitieRegel from '$lib/components/parliamentary/CoalitieRegel.svelte';
	import { ambtZin } from '$lib/components/parliamentary/ambt';
	import StemOpen from '$lib/components/open/StemOpen.svelte';
	import { bronHref } from '$lib/bron/href';
	import { blockClick, terPlekke } from '$lib/actions/klik';
	import Feiten from '$lib/components/ui/Feiten.svelte';
	import Veld from '$lib/components/ui/Veld.svelte';
	import { load } from '$lib/util/load.svelte';
	import { report } from '$lib/api/errors';
	import LoadState from '$lib/components/ui/LoadState.svelte';

	let { node }: { node: GraphNode } = $props();

	const today = vandaag();

	type Vote = Schema<'MemberVoteDTO'>;

	const VOTES_PREVIEW = 20;

	/** What the person signed stukken as, and when (AUTHORED meta). */
	let signatures = $state<Signature[]>([]);
	let showAllVotes = $state(false);
	/** A bewindspersoon's votes in a post, asked on their own and paged (#534); null: not asked. */
	let inOffice = $state<{ votes: Vote[]; next: number | null; laden: boolean } | null>(null);
	/** The votes outside a post, as Kamerlid alone (`in_office=false`); null: not asked yet. */
	let outOfOffice = $state<Vote[] | null>(null);
	/** The vote opened in place, by its stemming's key. */
	let openStem = $state<string | null>(null);
	const toggleStem = (key: string) => (openStem = openStem === key ? null : key);

	// The key, not the node: the node is drawn anew with the same key once its
	// neighbourhood loads, and the records are not asked again for that.
	const bronKey = $derived(node.key);
	const member = load(
		() => bronKey,
		(key) => getMember(key),
		'Persoon'
	);
	// The votes (8.8 s on prod, 9 Oct) and the signatures (from the full node) come after
	// the person: the reader stands as soon as the person is in, and these fill in.
	const votes = load(
		() => bronKey,
		(key) => getMemberVotes(key),
		'Stemmen van het lid'
	);

	$effect(() => {
		const key = bronKey;
		let stale = false;
		showAllVotes = false;
		inOffice = null;
		outOfOffice = null;
		signatures = [];
		getMemberAuthored(key)
			.then((authored) => {
				if (!stale) signatures = authored.map(signatureOf);
			})
			.catch((e) => report('Ondertekeningen van het lid', e));
		return () => (stale = true);
	});

	// A bewindspersoon's votes in a post: all of them, page by page, not those among the newest
	// 50 (UX-toets 0.79.43, #29: "20 stemmen" of 50).
	const bewindspersoon = $derived(
		member.state.status === 'ready' && (member.state.data.government_functions ?? []).length > 0
	);
	$effect(() => {
		if (!bewindspersoon) return;
		const key = bronKey;
		let weg = false;
		// The split stands only when the API knows `in_office=false` (#921): an API that does
		// not answers with all the votes, some with a post. Then it is not drawn and the one
		// list stands, until the API does; no version to read, the answer says it.
		getMemberVotesOutOfOffice(key)
			.then((v) => {
				if (weg || !v.votes.every((x) => !x.in_office?.length)) return;
				outOfOffice = v.votes;
				inOffice = { votes: [], next: 0, laden: true };
				getMemberVotesInOffice(key)
					.then((w) => {
						if (!weg) inOffice = { votes: w.votes, next: w.next_offset ?? null, laden: false };
					})
					.catch(() => {
						if (!weg) inOffice = null;
					});
			})
			.catch((e) => report('Stemmen als Kamerlid', e));
		return () => {
			weg = true;
		};
	});
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
					votes: [...nu.votes, ...v.votes],
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
		return [...byParty]
			.map(([sleutel, rows]) => ({
				party: rows[0].party ?? null,
				ambt: ambtVan(rows[0]),
				total: tel.get(sleutel)?.length ?? rows.length,
				meer: ambtMeer && !!ambtVan(rows[0]),
				byChoice: [...Map.groupBy(rows, (v) => v.choice)].sort(
					([a], [b]) => choiceRank(a) - choiceRank(b) || a.localeCompare(b)
				)
			}))
			.sort((a, b) => b.total - a.total);
	}

	const signatureOf = (n: Neighbor): Signature => {
		const meta = (n.meta ?? {}) as Record<string, unknown>;
		return {
			function: textOf(meta.function),
			capacity: textOf(meta.capacity),
			date: textOf(n.props?.date)
		};
	};

	/** A step of the career, the same in Loopbaan and in what it opens. */
	const stapId = (step: CareerEntry) =>
		step.kind + (step.kind === 'seat' ? step.factionKey : step.function) + step.from;

	// The years of the bronfilter: a step of the career outside them steps back.
	const years = $derived(parseFilter(page.url.searchParams));
</script>

{#snippet voteGroups(groups: PartyGroup[])}
	{#each groups as group (`${group.party}|${group.ambt}`)}
		{#if groups.length > 1 || group.ambt}
			<div class="party-head">
				<span class="party-wie"
					>{#if group.party}<NameLink
							collection="factions"
							name={group.party}
							class="party-name"
						/>{:else}<span class="party-name">Zonder fractie</span>{/if}{#if group.ambt}<span
							class="party-ambt">, als {group.ambt} en Kamerlid</span
						>{/if}</span
				>
				<span class="party-total">{atLeast(group.total, !!group.meer)} stemmen</span>
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
							<div class="vote-link" data-rij use:blockClick={() => toggleStem(v.decision_key)}>
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
											>stem van de fractie{v.party ? ` (${v.party})` : ''}{(v.seats ?? 0) > 1
												? `, ${v.seats} zetels`
												: ''}</span
										>{:else}<span class="vote-seats">eigen stem, hoofdelijk</span>{/if}
									{#if v.passed != null}
										<span
											class="vote-outcome"
											class:vote-outcome--passed={v.passed}
											class:vote-outcome--failed={!v.passed}
										>
											{outcomeWord(!!v.passed)}
										</span>
									{/if}
									{#if v.date}<span class="vote-date">{korteDatum(v.date)}</span>{/if}
								</span>
								<!-- What the coalition did (API 0.79.45, #559; Thijs, 10 Oct). -->
								{#if v.coalition}<div class="vote-coal">
										<CoalitieRegel coalitie={v.coalition} fracties={v.coalition_factions ?? []} />
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
{/snippet}

<ReaderFrame state={member.state} what="Persoon" retry={member.retry}>
	{#snippet children(m)}
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
		<div class="r-member">
			{#if (m.government_functions ?? []).length > 0}
				<BewindspersoonKop {m} id={node.id} />
			{:else}
				{@const titel = m.name ?? naamVan('members', m)}
				<ReaderHead
					collection="members"
					lijst={(m.government_functions ?? []).length > 0 ? 'ministers' : 'members'}
					kindLabel={ekSitting && !sitting
						? 'Lid van de Eerste Kamer'
						: currentTitle(career, sitting)}
					title={titel}
					acties={{
						bewaar: bewaarItem(node.id, {
							kort: titel,
							voluit: m.party ? `${titel} (${m.party})` : titel
						}),
						// Volg: what the lid signs and promises, as an Atom feed (`/api/feed?member=`).
						atom: atomHref({ member: m.key })
					}}
				>
					{#snippet statusLine()}
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
				<Sectie title={CHAMBER_NAME.EK}>
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
						<BronRegel
							composedOn={ek.source.composition_date}
							dataSince={ek.source.data_since}
							label={ek.source.attribution}
							href={ek.source.url}
						/>
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
							/>{/if}{#if step.count > 0}{`${step.cabinet ? ', ' : ''}${count(step.count, 'stuk', 'stukken')} ondertekend`}{/if}
					{/if}
				{/snippet}
				<Sectie title="Loopbaan" id="loopbaan">
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
												zin: capitalize(step.function),
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
				<Sectie title="Commissies" collection="committees" aantal={m.committees?.length}>
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

			{#if votes.state.status === 'loading'}
				<p class="laden">Stemmen laden…</p>
			{:else if votes.state.status === 'error'}
				<LoadState state={votes.state} what="De stemgeschiedenis" retry={votes.retry} />
			{:else if votes.state.data.votes.length > 0}
				{@const stemmen = votes.state.data}
				<!-- A bewindspersoon's votes in a post come on their own, all of them (#534); the
				     newest 50 give the rest. Until the first page is in, the 50 give both. -->
				{@const apart =
					!!outOfOffice && !!inOffice && !(inOffice.laden && inOffice.votes.length === 0)}
				{@const ambt = apart ? inOffice!.votes : []}
				{@const eigen = apart ? outOfOffice! : stemmen.votes}
				{@const meer = apart && inOffice!.next != null}
				{@const shown = (rows: Vote[]) => (showAllVotes ? rows : rows.slice(0, VOTES_PREVIEW))}
				<!-- The votes of a bewindspersoon stand apart as such, under "Als bewindspersoon"
				     (`in_office`); the rest are what they voted as a Kamerlid alone. Null-safe
				     without it: a vote with no post in `in_office` is a Kamerlid's. -->
				{#if ambt.length > 0}
					<Sectie
						title="Als bewindspersoon"
						collection="decisions"
						aantal={atLeast(ambt.length, meer)}
					>
						{@render voteGroups(groupVotes(shown(ambt), ambt, meer))}
						{#if !showAllVotes && ambt.length > VOTES_PREVIEW}
							<!-- No number while more pages follow: the heading says "200+" (FE1, live 0.79.44). -->
							<p class="alle">
								<AlleN
									aantal={meer ? null : ambt.length}
									noun="stemmen"
									onclick={() => (showAllVotes = true)}
								/>
							</p>
						{:else if showAllVotes && meer}
							<p class="alle">
								<AlleN volgende noun="stemmen" laden={inOffice!.laden} onclick={meerInOffice} />
							</p>
						{/if}
					</Sectie>
				{/if}
				<!-- Their own votes on a roll-call, and their faction's while they sat in it (API
				     0.75, BE-43). -->
				{#if eigen.length > 0 || ambt.length === 0}
					<Sectie
						title={apart ? 'Als Kamerlid' : 'Stemgeschiedenis'}
						collection="decisions"
						aantal={apart ? eigen.length : atLeast(stemmen.count, stemmen.next_offset != null)}
					>
						{@render voteGroups(groupVotes(shown(eigen), eigen))}
						{#if !showAllVotes && eigen.length > VOTES_PREVIEW}
							<p class="alle">
								<AlleN aantal={eigen.length} noun="stemmen" onclick={() => (showAllVotes = true)} />
							</p>
						{/if}
					</Sectie>
				{/if}
			{/if}
		</div>
	{/snippet}
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

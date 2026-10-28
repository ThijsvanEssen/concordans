<script lang="ts">
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { capitalize, textOf } from '$lib/text/words';
	import { asOfDate } from '$lib/text/datum';
	import { bewaarItem } from '$lib/map/map';
	import ReaderHead from './ReaderHead.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { getCommittee, getCommitteeAllMembers } from '$lib/api/committees';
	import type { Schema } from '$lib/api/types';
	import { OUTCOME_LABEL, type Outcome } from '$lib/votes/stages';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import {
		seatsOf,
		sittingOf,
		standingWord,
		type Seats
	} from '$lib/components/parliamentary/committee';
	import TekstLink from '$lib/components/ui/TekstLink.svelte';
	import LoadState from '$lib/components/ui/LoadState.svelte';
	import { load } from '$lib/util/load.svelte';

	type Member = Schema<'MemberDTO'>;

	let { node }: { node: GraphNode } = $props();

	/** A committee is addressed by slug in `/api/committees/{slug}`; the node key is a GUID. */
	const committeeSlug = (n: GraphNode): string | null => textOf(n.raw?.props?.slug);

	const p = $derived(node.raw?.props ?? {});
	/** The day a commissie that is no more ended, from its light node (R3-L F6). */
	const endedOn = $derived(textOf(p.ended_on));
	const name = $derived(textOf(p.name) ?? node.raw?.display_name ?? node.label);
	const abbreviation = $derived(textOf(p.abbreviation));
	const kind = $derived(textOf(p.kind));

	const committee = load(
		() => committeeSlug(node),
		(slug) => (slug ? getCommittee(slug) : Promise.reject(new Error('Commissie zonder slug'))),
		'Commissie'
	);
	const detail = $derived(committee.state.status === 'ready' ? committee.state.data : null);
	/** Whether it sits, from the detail (API 0.80.15); before it, or without it, not known. */
	const sitting = $derived(sittingOf(detail));
	/** No longer sitting: by the API's word, else by the day it ended. */
	const ended = $derived(sitting === false || (sitting == null && !!endedOn));

	/** The members of the past, asked only when a committee has none today and they are asked. */
	let oudLeden = $state(false);
	const vroeger = load(
		() => (oudLeden ? committeeSlug(node) : null),
		(slug) => (slug ? getCommitteeAllMembers(slug) : Promise.resolve(null)),
		'Oud-leden'
	);
	const chamber = $derived(
		textOf(p.chamber) ??
			(committee.state.status === 'ready' ? (committee.state.data.chamber ?? null) : null)
	);
</script>

{#snippet naam(m: Member)}
	<BronLink ref={`members/${m.key}`}>{m.name}</BronLink>{#if m.ek?.abbreviation ?? m.party}<span
			class="faction">, {m.ek?.abbreviation ?? m.party}</span
		>{/if}
{/snippet}

<!-- The seats: the voorzitter and ondervoorzitter by their word, then the leden and the
     plaatsvervangers each as one run of names, so a vaste commissie of 65 seats stays a read. -->
{#snippet zetels(seats: Seats)}
	{#if seats.officers.length > 0}
		<dl class="officers">
			{#each seats.officers as m (m.key)}
				<dt>{capitalize(m.zetel)}</dt>
				<dd>{@render naam(m)}</dd>
			{/each}
		</dl>
	{/if}
	{#each [['Leden', seats.leden], ['Plaatsvervangers', seats.plaatsvervangers]] as const as [kop, groep] (kop)}
		{#if groep.length > 0}
			<section class="groep" aria-label={kop}>
				<h3 class="groep-kop">{kop}</h3>
				<p class="namen">
					{#each groep as m, i (m.key)}{@render naam(m)}{i < groep.length - 1 ? '; ' : ''}{/each}
				</p>
			</section>
		{/if}
	{/each}
{/snippet}

<ReaderFrame state={committee.state} what="Commissie" retry={committee.retry}>
	{#snippet head()}
		<!-- The header comes from the node, so a failed detail request costs the counts only. -->
		<ReaderHead
			collection="committees"
			kindParts={[chamberName(chamber), kind]}
			title={name}
			acties={{
				bewaar: bewaarItem(node.id, {
					kort: abbreviation ?? name,
					voluit: `${name}, ${chamberName(chamber)}`
				})
			}}
		>
			{#snippet statusLine()}
				{#if abbreviation && abbreviation !== name}<span class="afk">{abbreviation}</span>{/if}
				{#if ended}<span class="opgeheven">Opgeheven{endedOn ? ` ${asOfDate(endedOn)}` : ''}</span
					>{:else if sitting}<span>{standingWord(sitting)}</span>{/if}
			{/snippet}
		</ReaderHead>
	{/snippet}
	{#snippet children(c)}
		{@const dossiers = c.dossiers ?? []}
		{@const openDossiers = dossiers.filter((d) => !d.closed)}
		{@const outcomes = Object.keys(OUTCOME_LABEL) as Outcome[]}
		{@const ek = c.chamber === 'EK'}
		{@const complete = c.dossier_total == null || dossiers.length >= c.dossier_total}
		{@const seats = c.members?.length ? seatsOf(c.members) : null}
		{@const counted = complete ? outcomes.filter((o) => dossiers.some((d) => d.outcome === o)) : []}
		{@const source = c.source}
		<div class="r-committee">
			<!-- A commissie that is no more has no current leden or open dossiers to count. -->
			{#if (seats && !ended) || (!ek && !ended) || counted.length > 0}
				<ul class="stats">
					{#if seats && !ended}
						<li>
							<span class="stat-num">{seats.officers.length + seats.leden.length}</span><span
								class="stat-label">Leden</span
							>
						</li>
						{#if seats.plaatsvervangers.length > 0}
							<li>
								<span class="stat-num">{seats.plaatsvervangers.length}</span><span
									class="stat-label">Plaatsvervangers</span
								>
							</li>
						{/if}
					{/if}
					{#if !ek && !ended}
						<!-- The Eerste Kamer's committees are not yet linked to dossiers. The count is
					     the API's, the one of the list, not what the page of dossiers holds. -->
						<li>
							<span class="stat-num">{c.active_dossier_count ?? openDossiers.length}</span><span
								class="stat-label">Openstaande dossiers</span
							>
						</li>
					{/if}
					<!-- The outcomes are counted from the dossiers loaded: only where they are all. -->
					{#each counted as outcome (outcome)}
						<li>
							<span class="stat-num">{dossiers.filter((d) => d.outcome === outcome).length}</span
							><span class="stat-label">{OUTCOME_LABEL[outcome]}</span>
						</li>
					{/each}
				</ul>
			{/if}

			<!-- No seat in the data at all is not "no members": the source gives none. -->
			{#if c.members == null}
				<p class="stil">De bron geeft geen leden voor deze commissie.</p>
			{:else if seats}
				{@render zetels(seats)}
			{:else}
				<p class="stil">
					Geen huidige leden.
					{#if !oudLeden}
						<TekstLink onclick={() => (oudLeden = true)}>Toon de oud-leden</TekstLink>
					{/if}
				</p>
				{#if oudLeden}
					<LoadState state={vroeger.state} what="De oud-leden" plural retry={vroeger.retry}>
						{#snippet empty()}
							<p class="stil">De bron geeft ook geen oud-leden.</p>
						{/snippet}
						{#snippet children(oud)}
							<section class="oud" aria-label="Oud-leden">
								<h3 class="groep-kop">Oud-leden</h3>
								{@render zetels(seatsOf(oud ?? []))}
							</section>
						{/snippet}
					</LoadState>
				{/if}
			{/if}

			{#if ek && source}
				<BronRegel
					composedOn={source.composition_date}
					dataSince={source.data_since}
					label={source.attribution}
					href={source.url}
				/>
			{/if}
		</div>
	{/snippet}
</ReaderFrame>

<style>
	.r-committee {
		display: flex;
		flex-direction: column;
		/* Its step between blocks, which the head subtracts from its own (ReaderHead). */
		--lezer-stap: var(--s-4);
		gap: var(--lezer-stap);
		color: var(--ink-2);
	}
	/* A comma against the word before it: the kicker's gap only after it. */
	.officers {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		gap: var(--s-2) var(--s-4);
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-snug);
	}
	.officers dt {
		color: var(--ink-3);
	}
	.officers dt::first-letter {
		text-transform: uppercase;
	}
	.officers dd {
		margin: 0;
		color: var(--ink);
	}
	.faction {
		color: var(--ink-3);
	}
	/* A run of names under a quiet word: the leden, the plaatsvervangers, the oud-leden. */
	.groep,
	.oud {
		display: flex;
		flex-direction: column;
		gap: var(--s-1);
	}
	.oud {
		gap: var(--s-4);
	}
	.groep-kop {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		font-weight: 600;
		color: var(--ink-3);
	}
	.namen {
		margin: 0;
		font-family: var(--font-serif);
		font-size: var(--t-meta);
		line-height: var(--lh-body);
		color: var(--ink);
	}
	.opgeheven {
		color: var(--ink-3);
	}
	/* The abbreviation: a word, not a tag. */
	.afk {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}

	.stats {
		list-style: none;
		margin: 0;
		padding: 0;
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(90px, 1fr));
		gap: var(--s-2);
	}
	/* Figures, not buttons: no box, for the lists stand in the panel and a tile would ask a click. */
	.stats li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: var(--s-1);
	}
	.stat-num {
		font-family: var(--font-serif);
		font-size: var(--t-body);
		font-weight: 600;
		color: var(--ink);
	}
	.stat-label {
		font-family: var(--font-serif);
		font-size: var(--t-micro);
		color: var(--ink-3);
	}
</style>

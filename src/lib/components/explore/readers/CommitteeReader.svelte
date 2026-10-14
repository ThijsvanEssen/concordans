<script lang="ts">
	import BronRegel from '$lib/components/parliamentary/BronRegel.svelte';
	import { capitalize, joinParts, textOf } from '$lib/text/words';
	import { bewaarItem } from '$lib/map/map';
	import ReaderHead from './ReaderHead.svelte';
	import SoortLink from '$lib/bron/SoortLink.svelte';
	import BronLink from '$lib/bron/BronLink.svelte';
	import ReaderFrame from './ReaderFrame.svelte';
	import type { GraphNode } from '$lib/graph/types';
	import { bronLabel } from '$lib/vocabulary';
	import { committeeSlug, getCommittee } from '$lib/components/parliamentary/data';
	import { OUTCOME_LABEL, type Outcome } from '$lib/components/parliamentary/stages';
	import { chamberName } from '$lib/components/parliamentary/chamber';
	import { seatWord } from '$lib/components/parliamentary/career';
	import { load } from '$lib/util/load.svelte';

	let { node }: { node: GraphNode } = $props();

	const p = $derived(node.raw?.props ?? {});
	const name = $derived(textOf(p.name) ?? node.raw?.display_name ?? node.label);
	const abbreviation = $derived(textOf(p.abbreviation));
	const kind = $derived(textOf(p.kind));

	/** A seat's role as a label: `PlvLid` and `Plv. lid` alike "Plaatsvervangend lid". */
	const zetelVan = (role: string | null | undefined) => {
		const w = seatWord(role) ?? 'lid';
		return capitalize(w);
	};
	const RANG: Record<string, number> = { Voorzitter: 0, Ondervoorzitter: 1, Lid: 2 };
	const rang = (zetel: string) => RANG[zetel] ?? 3;

	const committee = load(
		() => committeeSlug(node),
		(slug) => (slug ? getCommittee(slug) : Promise.reject(new Error('Commissie zonder slug'))),
		'Commissie'
	);
	const chamber = $derived(
		textOf(p.chamber) ??
			(committee.state.status === 'ready' ? (committee.state.data.chamber ?? null) : null)
	);
</script>

<ReaderFrame state={committee.state} what="Commissie" retry={committee.retry}>
	{#snippet head()}
		<!-- The header comes from the node, so a failed detail request costs the counts only. -->
		<ReaderHead
			collection="committees"
			title={name}
			acties={{
				bewaar: bewaarItem(node.id, {
					kort: abbreviation ?? name,
					voluit: `${name}, ${chamberName(chamber)}`
				})
			}}
		>
			{#snippet soort()}
				<SoortLink collection="committees">{bronLabel('committees')}</SoortLink>{joinParts([
					'',
					chamberName(chamber),
					kind
				]) && `, ${joinParts([chamberName(chamber), kind])}`}
			{/snippet}
			{#snippet status()}
				{#if abbreviation && abbreviation !== name}<span class="afk">{abbreviation}</span>{/if}
			{/snippet}
		</ReaderHead>
	{/snippet}
	{#snippet children(c)}
		{@const dossiers = c.dossiers ?? []}
		{@const openDossiers = dossiers.filter((d) => !d.closed)}
		{@const outcomes = Object.keys(OUTCOME_LABEL) as Outcome[]}
		{@const ek = c.chamber === 'EK'}
		<!-- The members with a role, in the word of a member's page (seatWord): the
			     voorzitter first, then the ondervoorzitter, the leden and the plaatsvervangers. -->
		{@const officers = (c.members ?? [])
			.filter((m) => m.role)
			.map((m) => ({ ...m, zetel: zetelVan(m.role) }))
			.sort((a, b) => rang(a.zetel) - rang(b.zetel))}
		{@const source = c.source}
		<div class="r-committee">
			<ul class="stats">
				<li>
					<span class="stat-num">{(c.members ?? []).length}</span><span class="stat-label"
						>Leden</span
					>
				</li>
				{#if !ek}
					<!-- The Eerste Kamer's committees are not yet linked to dossiers. -->
					<li>
						<span class="stat-num">{openDossiers.length}</span><span class="stat-label"
							>Open dossiers</span
						>
					</li>
				{/if}
				{#each outcomes as outcome (outcome)}
					{@const count = dossiers.filter((d) => d.outcome === outcome).length}
					{#if count > 0}
						<li>
							<span class="stat-num">{count}</span><span class="stat-label"
								>{OUTCOME_LABEL[outcome]}</span
							>
						</li>
					{/if}
				{/each}
			</ul>

			{#if officers.length > 0}
				<dl class="officers">
					{#each officers as m (m.key)}
						<dt>{m.zetel}</dt>
						<dd>
							<BronLink ref={`members/${m.key}`}>{m.name}</BronLink>{#if m.ek?.abbreviation}<span
									class="faction">, {m.ek.abbreviation}</span
								>{/if}
						</dd>
					{/each}
				</dl>
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
	.stats li {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 2px;
		padding: var(--s-2);
		background: var(--paper-2);
		border: 1px solid var(--rule);
		border-radius: var(--r-1);
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
